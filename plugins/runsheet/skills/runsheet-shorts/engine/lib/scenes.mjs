// The script in, the plan out: which scene types there are and what each needs, the colours from the accent, and
// the clock, with every element of every scene timed to the word the voice says.
import { align, tokens } from "./align.mjs";

/*
  THE SCENE TYPES. Each takes `say` (the voice-over line, one or two sentences) and these fields. Text marked with
  *stars* is drawn in the accent colour, in a serif italic.
*/
export const TYPES = {
  hook: { need: ["text"], may: ["kicker", "icon"] },
  text: { need: ["text"], may: ["icon"] },
  list: { need: ["text", "items"], may: [] },
  checklist: { need: ["text", "items"], may: [] },
  steps: { need: ["text", "items"], may: [] },
  compare: { need: ["text", "left", "right"], may: [] },
  stat: { need: ["value", "text"], may: ["icon"] },
  slam: { need: ["text"], may: [] },
  punch: { need: ["text"], may: ["icon"] },
  quote: { need: ["quote"], may: ["by", "text"] },
  chat: { need: ["messages"], may: ["text"] },
  image: { need: ["src", "text"], may: [] },
  strike: { need: ["wrong"], may: ["right"] },
  // a long video's section card: its title becomes a YouTube chapter at the moment it appears
  chapter: { need: ["text"], may: ["kicker"] },
  end: { need: [], may: ["text", "sub", "stamp"] },
};

/** How many scenes a video may have: a Short is under a minute of lines, a long video up to about twelve minutes. */
export const SCENE_COUNT = { short: [2, 14], long: [6, 160] };
const COMMON = ["type", "say", "ground", "enter"];
const GROUNDS = ["light", "dark", "punch"];
const ENTERS = ["slide", "flood", "dome", "zoom", "cut"];

const LEAD = 0.35, GAP = 0.3, PRE = 0.15, TAIL = 0.7, OVERLAP = 0.45, END_SILENT = 2.2;

// ---------------------------------------------------------------- the script

/**
 * The scenes of a spec, checked. The old format (`lines`, a list of sentences, and `end`) becomes a hook, plain text
 * scenes and an end card, so a script written for the first engine still renders.
 */
export function readScenes(s, abs, { long = false } = {}) {
  const errors = [];
  let scenes = s.scenes;
  if (!Array.isArray(scenes)) {
    if (!Array.isArray(s.lines)) return { errors: ["the script needs `scenes` (see SCENES.md)."] };
    scenes = s.lines.map((l, i) => {
      const o = typeof l === "string" ? { show: l } : l;
      const show = String(o.show ?? o.say ?? "");
      return { type: i === 0 ? "hook" : o.image ? "image" : "text", say: String(o.say ?? show).replace(/\*/g, ""), text: show, ...(o.image ? { src: o.image } : {}) };
    });
    scenes.push({ type: "end", text: "", sub: s.end?.sub || (s.brand?.handle ? `Follow ${s.brand.handle}` : "") });
  }
  const [lo, hi] = SCENE_COUNT[long ? "long" : "short"];
  if (scenes.length < lo || scenes.length > hi) errors.push(`a ${long ? "long video" : "Short"} has ${lo} to ${hi} scenes; this one has ${scenes.length}.`);
  if (!long && scenes.some((sc) => sc.type === "chapter")) errors.push(`chapter scenes are for long videos ("shape": "16x9"); a Short has no chapters.`);
  const out = scenes.map((raw, i) => {
    const sc = { ...raw }, no = i + 1, type = sc.type;
    const bad = (m) => errors.push(`scene ${no} (${type}): ${m}`);
    if (!TYPES[type]) { bad(`unknown type. Use one of: ${Object.keys(TYPES).join(", ")}.`); return sc; }
    for (const k of TYPES[type].need) if (sc[k] == null || sc[k] === "" || (Array.isArray(sc[k]) && !sc[k].length)) bad(`needs "${k}".`);
    for (const k of Object.keys(sc)) if (!COMMON.includes(k) && !TYPES[type].need.includes(k) && !TYPES[type].may.includes(k)) bad(`"${k}" is not a field of this type.`);
    sc.say = String(sc.say ?? "").trim();
    if (!sc.say && type !== "end") bad(`needs "say", the line the voice speaks.`);
    if (sc.say.split(/\s+/).length > 32) bad(`"say" is ${sc.say.split(/\s+/).length} words; keep it to two short sentences.`);
    if (sc.ground != null && !GROUNDS.includes(sc.ground)) bad(`ground is light, dark or punch.`);
    if (sc.enter != null && !ENTERS.includes(sc.enter)) bad(`enter is ${ENTERS.join(", ")}.`);
    for (const k of ["items"]) if (sc[k] != null) {
      if (!Array.isArray(sc[k]) || sc[k].length < 2 || sc[k].length > 4) bad(`"items" is 2 to 4 entries.`);
      else sc[k] = sc[k].map((it) => (typeof it === "string" ? { text: it } : { text: String(it.text ?? ""), icon: it.icon }));
    }
    if (type === "compare") for (const side of ["left", "right"]) {
      const v = sc[side];
      if (!v || !v.label || !Array.isArray(v.lines) || v.lines.length < 1 || v.lines.length > 3) bad(`"${side}" is { "label": "...", "lines": [1 to 3 short lines] }.`);
    }
    if (type === "chat" && Array.isArray(sc.messages)) {
      if (sc.messages.length < 2 || sc.messages.length > 4) bad(`"messages" is 2 to 4 entries.`);
      sc.messages = sc.messages.map((m) => ({ from: m.from === "me" ? "me" : "them", text: String(m.text ?? "") }));
    }
    if (type === "stat" && !/\d/.test(String(sc.value ?? ""))) bad(`"value" is a number as shown, like "3x", "47%" or "$1,200".`);
    if (type === "slam" && String(sc.text ?? "").split(/\s+/).length > 2) bad(`a slam is one or two words.`);
    // a chapter's name is a YouTube chapter label and a line in the styles' contents lists
    if (type === "chapter" && String(sc.text ?? "").split(/\s+/).filter(Boolean).length > 6) bad(`a chapter's name is six words at most.`);
    if (type === "image") { sc.src = abs(sc.src); }
    return sc;
  });
  if (out[0] && out[0].type !== "hook") errors.push(`scene 1 is the hook: make it "type": "hook".`);
  return { scenes: out, errors };
}

// ---------------------------------------------------------------- colours

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = (rgb) => {
  const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hue = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
/** Darken (or lighten) toward `to` until the colour reads `need`:1 against `bg`. */
const reach = (rgb, bg, need, to) => { let c = rgb; for (let k = 0; k < 40 && contrast(c, bg) < need; k++) c = mixRgb(c, to, 0.06); return c; };

/** Every colour the scenes use, from the one accent: fills that carry white text, text that reads on cream and on ink. */
export function themeOf(accentHex) {
  const a = hex(/^#[0-9a-f]{6}$/i.test(accentHex || "") ? accentHex : "#ff4a36");
  const paper = [248, 246, 243], ink = [15, 15, 19], white = [255, 255, 255], black = [0, 0, 0];
  const fill = reach(a, white, 3, black);
  const warm = hue(a) < 70 || hue(a) > 300;
  const cool = warm ? [150, 138, 255] : [255, 150, 118];
  return {
    accent: toHex(a), paper: toHex(paper),
    accentFill: toHex(fill), accentText: toHex(reach(a, paper, 3.2, black)), accentSoft: toHex(reach(a, ink, 5, white)),
    accentLight: toHex(mixRgb(fill, white, 0.22)), accentDeep: toHex(mixRgb(fill, black, 0.1)), accentShadow: `rgba(${fill.map(Math.round).join(",")},0.35)`,
    glowWarm: mixRgb(a, white, 0.3).map(Math.round), glowWarm2: mixRgb(a, white, 0.5).map(Math.round), glowCool: cool, glowWarmDeep: mixRgb(a, white, 0.15).map(Math.round),
    darkGlowA: a.map(Math.round), darkGlowB: warm ? [130, 86, 255] : [255, 120, 80],
    ok: "#12946b", bad: "#e5484d", stamp: "#cdf95a", stampOn: "#141a00",
  };
}

// ---------------------------------------------------------------- the clock

const words = (s) => tokens(s).map((t) => ({ text: t.text, emph: t.emph }));

/** Where a phrase is said in a scene: the times of its words, and whether most of it was heard. */
function sayAt(text, spoken, len) {
  const tk = align(String(text), spoken, len);
  const heard = tk.filter((t) => t.heard).length;
  return { tk, heard: tk.length ? heard / tk.length : 0, first: tk.find((t) => t.heard) };
}

/**
 * The plan of the whole Short. `clips[i]` is scene i's voice ({ duration, words: [{ text, t0, t1 }] } from the voice,
 * times from the clip's start), null for a silent end card. Returns the scenes with their start, length and cues (all
 * in seconds, local to the scene), the captions and the camera's hits.
 */
export function plan(scenes, clips, { theme = "light" } = {}) {
  const base = theme === "dark" ? "dark" : "light";
  let voiceAt = LEAD;
  const out = [];
  scenes.forEach((sc, i) => {
    const c = clips[i];
    const s = { ...sc, no: i + 1, mood: i % 4 };
    s.ground = sc.type === "slam" ? "dark" : sc.ground ?? (sc.type === "stat" || sc.type === "punch" ? "punch" : sc.type === "chapter" ? "dark" : base);
    const prev = out[i - 1];
    s.enter = sc.enter ?? (i === 0 ? "cut" : sc.type === "slam" ? "zoom" : s.ground === "punch" ? "flood" : s.ground === "dark" && prev?.ground !== "dark" ? "dome" : s.ground === "light" && prev && prev.ground !== "light" ? "flood" : "slide");
    // a riser needs a beat before the accent floods in
    if (i > 0 && s.ground === "punch" && prev?.ground !== "punch") voiceAt += 0.18;
    s.start = i === 0 ? 0 : voiceAt - PRE;
    s.voiceAt = c ? voiceAt - s.start : null;
    s.words = c ? c.words.map((w) => ({ text: w.text, emph: w.emph, t0: w.t0 + s.voiceAt, t1: w.t1 + s.voiceAt })) : [];
    s.speechEnd = c ? s.voiceAt + c.duration : 0.4;
    if (c) voiceAt += c.duration + GAP;
    out.push(s);
  });
  out.forEach((s, i) => {
    const next = out[i + 1];
    s.len = next ? next.start - s.start : s.words.length ? s.speechEnd + TAIL : END_SILENT;
    s.overlap = next ? OVERLAP : 0;
    cue(s);
  });
  /*
    A SCENE WHOSE LAST THING LANDS ON ITS LAST WORD GETS A BEAT TO BE SEEN. A strike drawn on the line's final word, or
    a card that flies in as the voice stops, would otherwise be cut away as it lands; up to 0.8 s more before the next
    scene, which moves everything after it along (their cues are their own, so nothing else changes).
  */
  let shift = 0;
  out.forEach((s, i) => {
    s.start += shift;
    const next = out[i + 1];
    if (!next || !s.words.length) return;
    const last = Math.max(...[...s.head, ...(s.items ?? []), ...(s.messages ?? []), ...(s.wrongHead ?? []), ...(s.rightHead ?? [])].map((x) => x.at).concat(Object.values(s.cues)).filter(Number.isFinite), 0);
    const extra = Math.min(0.8, Math.max(0, last + 1.0 - (s.speechEnd + GAP + PRE)));
    s.len += extra;
    shift += extra;
  });
  out.forEach((s) => cue(s));
  // a slam lands over the scene before it, so that scene stays on, dimmed, until the slam is gone
  out.forEach((s, i) => { if (out[i + 1]?.type === "slam") s.overlap = out[i + 1].len + OVERLAP; });
  const total = out.reduce((m, s) => Math.max(m, s.start + s.len), 0);
  return { scenes: out, total, captions: captions(out), hits: hits(out) };
}

/** When each thing in a scene appears, from the words of its line. */
function cue(s) {
  const sp = s.words, len = s.len, firstSaid = sp[0]?.t0 ?? 0.2, lastSaid = sp.length ? sp[sp.length - 1].t1 : s.speechEnd;
  const head = (text, from = 0.12) => {
    if (!text) return [];
    const { tk, heard } = sayAt(text, sp, len);
    if (heard >= 0.5) {
      const ats = tk.map((t) => Math.max(0.06, t.t0 - 0.03));
      // a scene with nothing on it for half a second is dead air: a headline whose first word is said late rises at once
      if (ats[0] > 0.55) ats.forEach((a, k) => { ats[k] = Math.min(a, 0.25 + 0.09 * k); });
      return tk.map((t, k) => ({ text: t.text, emph: t.emph, at: ats[k] }));
    }
    return words(text).map((t, k) => ({ ...t, at: from + k * 0.1 }));
  };
  const spread = (texts, a, b) => {
    const at = texts.map((tx, k) => {
      const m = sayAt(tx, sp, len);
      return m.first && m.heard > 0 ? m.first.t0 - 0.05 : null;
    });
    const n = texts.length;
    return at.map((v, k) => (v != null ? v : a + ((b - a) * (k + 0.2)) / n));
  };
  const monotone = (xs, min = 0.25) => { for (let k = 1; k < xs.length; k++) xs[k] = Math.max(xs[k], xs[k - 1] + min); return xs; };
  const end = (tk) => (tk.length ? Math.max(...tk.map((t) => t.at)) + 0.43 : 0.2);
  s.cues = {};
  switch (s.type) {
    case "hook": case "text": case "punch": {
      s.head = head(s.text);
      const em = s.head.find((t) => t.emph);
      s.cues.icon = Math.min(Math.max(end(s.head) - 0.1, 0.5), Math.max(0.5, lastSaid - 0.3));
      s.cues.land = em ? em.at + 0.1 : end(s.head) - 0.2;
      break;
    }
    case "list": case "checklist": case "steps": {
      s.head = head(s.text);
      const from = s.type === "checklist" ? end(s.head) + 0.2 : Math.max(end(s.head) - 0.15, 0.3);
      const ats = monotone(spread(s.items.map((it) => it.text), from, Math.max(from + 0.5, lastSaid - 0.2)).map((v) => Math.max(v, from)));
      s.items = s.items.map((it, k) => ({ ...it, at: ats[k] }));
      break;
    }
    case "compare": {
      s.head = head(s.text);
      const [l, r] = spread([`${s.left.label} ${s.left.lines.join(" ")}`, `${s.right.label} ${s.right.lines.join(" ")}`], Math.max(end(s.head) - 0.1, 0.3), lastSaid - 0.3);
      s.cues.left = Math.max(0.3, Math.min(l, end(s.head)));
      s.cues.right = Math.max(s.cues.left + 0.6, r);
      break;
    }
    case "stat": {
      s.head = head(s.text, 0.5);
      const digits = String(s.value).replace(/[^0-9.]/g, "");
      const w = sp.find((x) => digits && x.text.replace(/[^0-9.]/g, "") === digits) ?? sp.find((x) => /\d/.test(x.text));
      s.cues.value = Math.max(0.75, w ? w.t0 : firstSaid + (lastSaid - firstSaid) * 0.3);
      break;
    }
    case "slam": {
      const m = sayAt(s.text, sp, len);
      s.cues.slam = Math.max(0.12, m.first && m.heard >= 0.5 ? m.first.t0 - 0.02 : firstSaid);
      break;
    }
    case "quote": {
      s.head = head(s.text ?? "");
      s.cues.type = Math.max(0.35, end(s.head) - 0.1);
      s.cues.typeEnd = Math.max(s.cues.type + 0.8, lastSaid - 0.15);
      break;
    }
    case "chat": {
      s.head = head(s.text ?? "");
      const from = Math.max(end(s.head) - 0.1, 0.35);
      const ats = monotone(spread(s.messages.map((m) => m.text), from, Math.max(from + 0.6, lastSaid - 0.2)).map((v) => Math.max(v, from)), 0.5);
      s.messages = s.messages.map((m, k) => ({ ...m, at: ats[k] }));
      break;
    }
    case "image": {
      s.head = head(s.text);
      break;
    }
    case "chapter": {
      s.head = head(s.text, 0.35);
      s.cues.land = Math.max(0.3, end(s.head) - 0.2);
      break;
    }
    case "strike": {
      s.wrongHead = head(s.wrong);
      const m = sayAt(s.wrong, sp, len), heardEnd = m.tk.filter((t) => t.heard).pop();
      s.cues.strike = heardEnd ? heardEnd.t1 + 0.05 : firstSaid + (lastSaid - firstSaid) * 0.45;
      s.cues.strike = Math.max(s.cues.strike, end(s.wrongHead));
      s.rightHead = s.right ? head(s.right, s.cues.strike + 0.4).map((t) => ({ ...t, at: Math.max(t.at, s.cues.strike + 0.3) })) : null;
      break;
    }
    case "end": {
      s.head = head(s.text ?? "");
      s.cues.mark = Math.max(0.2, Math.min(end(s.head) - 0.2, 1.2));
      if (s.stamp) {
        const m = sayAt(s.stamp, sp, len);
        s.cues.stamp = Math.max(s.cues.mark + 0.7, m.first && m.heard >= 0.5 ? m.first.t0 - 0.03 : s.cues.mark + 0.9);
      }
      break;
    }
  }
  s.head = s.head ?? [];
  // the moment everything in the scene is on screen and still, for the check sheet
  const ats = [...s.head, ...(s.items ?? []), ...(s.messages ?? []), ...(s.wrongHead ?? []), ...(s.rightHead ?? [])].map((x) => x.at).concat(Object.values(s.cues)).filter(Number.isFinite);
  s.settle = Math.max(0.5, Math.min((ats.length ? Math.max(...ats) : 0.3) + 0.75, s.len - 0.1));
}

/*
  THE CAPTIONS: three or four words at a time, cut at punctuation and at about 24 letters, each chunk on until the
  next one starts (or a moment after its last word when the scene ends first).
*/
function captions(scenes) {
  const out = [];
  for (const s of scenes) {
    const ws = s.words.map((w) => ({ t: w.text, a: s.start + w.t0, b: s.start + w.t1 }));
    let cur = [];
    const flush = () => { if (cur.length) out.push({ words: cur, a: cur[0].a, end: 0, scene: s.no, ground: s.ground, sceneEnd: s.start + s.len }); cur = []; };
    ws.forEach((w, i) => {
      cur.push(w);
      const chars = cur.map((x) => x.t).join(" ").length, next = ws[i + 1];
      if (cur.length >= 4 || /[.?!]$/.test(w.t) || (/,$/.test(w.t) && cur.length >= 2) || (next && chars + 1 + next.t.length > 24)) flush();
    });
    flush();
  }
  out.forEach((c, i) => {
    const nx = out[i + 1], last = c.words[c.words.length - 1];
    c.end = nx && nx.scene === c.scene ? nx.a : Math.min(c.sceneEnd, last.b + 0.27);
  });
  return out;
}

/** The camera's jolts: on a slam, a number landing, a punch, a dome opening, the stamp. */
function hits(scenes) {
  const out = [];
  for (const s of scenes) {
    if (s.type === "slam") out.push({ t: s.start + s.cues.slam, amp: 12, decay: 5 });
    if (s.type === "stat") out.push({ t: s.start + s.cues.value, amp: 12, decay: 5 });
    if (s.type === "punch") out.push({ t: s.start + s.cues.land, amp: 6, decay: 5 });
    if (s.enter === "dome" || s.enter === "flood") out.push({ t: s.start + 0.07, amp: 5, decay: 5 });
    if (s.type === "end" && s.cues.stamp != null) out.push({ t: s.start + s.cues.stamp, amp: 7, decay: 4 });
    if (s.type === "hook" && s.icon) out.push({ t: s.start + s.cues.icon, amp: 4, decay: 4 });
    if (s.type === "chapter") out.push({ t: s.start + s.cues.land, amp: 5, decay: 5 });
  }
  return out;
}

/*
  A LONG VIDEO'S CHAPTERS, from its chapter scenes, in YouTube's own format (Help, "Add video chapters"): the first
  at 0:00, at least three, in order, each at least ten seconds. The opening before the first chapter card is the
  first chapter, named by `intro`. Returns the lines to paste into the description and, when YouTube would ignore
  them, the reason.
*/
export function chaptersOf(scenes, total, intro = "Intro") {
  const marks = scenes.filter((s) => s.type === "chapter").map((s) => ({ t: s.start, title: String(s.text).replace(/\*/g, "").trim() }));
  if (!marks.length) return { lines: [], problem: null };
  // an opening under ten seconds belongs to the first chapter; a longer one is a chapter of its own
  if (marks[0].t >= 10) marks.unshift({ t: 0, title: intro });
  marks[0].t = 0;
  const clock = (t) => { const x = Math.floor(t); return x >= 3600 ? `${Math.floor(x / 3600)}:${String(Math.floor((x % 3600) / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}` : `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`; };
  const lines = marks.map((m) => `${clock(m.t)} ${m.title}`);
  const ends = marks.map((m, i) => (marks[i + 1]?.t ?? total) - m.t);
  const problem = marks.length < 3 ? `only ${marks.length} chapters: YouTube needs at least 3, so add chapter scenes or leave chapters out.`
    : ends.some((d) => d < 10) ? `a chapter is shorter than ten seconds, which YouTube does not allow: move or merge its chapter scene.` : null;
  return { lines, problem };
}
