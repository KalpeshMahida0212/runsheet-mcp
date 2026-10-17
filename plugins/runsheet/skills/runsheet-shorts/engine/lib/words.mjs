// Words heard in a long video: where Whisper's windows are cut, how its pieces become words, sentences to read and
// caption groups to show. Pure functions; test.mjs checks them.

/*
  WINDOWS CUT AT PAUSES. Whisper hears 30 seconds at a time. Its own long-audio mode overlaps the windows and stitches
  them together, and on a test video it wrote a sentence twice where two windows met. Here each window ends in a pause
  between 15 and 30 seconds in: the quietest 100 ms there, or a later one nearly as quiet, so windows stay long. A
  search that started at 20 seconds found no pause in fast speech once, cut a word in two, and Whisper made up a word.
  ponytail: the whole sound is held in memory, about 230 MB an hour; read it in pieces if multi-hour streams matter.
*/
export function windows(audio, rate = 16000) {
  const hop = rate / 10;
  const energy = (i) => { let e = 0; for (let k = i; k < i + hop; k++) e += audio[k] * audio[k]; return e / hop; };
  const out = [];
  for (let start = 0; start < audio.length; ) {
    if (audio.length - start <= 30 * rate) { out.push([start, audio.length]); break; }
    const frames = [];
    for (let i = start + 15 * rate; i + hop <= start + 30 * rate; i += hop) frames.push([i, energy(i)]);
    const low = Math.min(...frames.map((f) => f[1]));
    const cut = frames.filter((f) => f[1] <= low * 2 + 1e-9).pop()[0] + hop / 2;
    out.push([start, cut]);
    start = cut;
  }
  return out;
}

const key = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** One window's pieces after the last, minus a word heard twice where they meet ("time." twice on a test video). */
export function appendWindow(pieces, said) {
  const last = pieces[pieces.length - 1];
  const rest = last && said[0] && key(said[0].text) === key(last.text) && said[0].timestamp[0] - last.timestamp[1] < 0.6 ? said.slice(1) : said;
  pieces.push(...rest);
  return pieces;
}

/*
  Whisper's pieces as clean { text, t0, t1 }. A piece that does not start with a space carries on the word before it
  (".in" after "buildifyapp"), and a word can start a moment before the last one ended; times only move forward.
*/
export function tidy(chunks) {
  const words = [];
  for (const c of chunks) {
    const raw = String(c.text ?? "");
    const [a, b] = c.timestamp || [];
    if (!raw.trim() || a == null) continue;
    const last = words[words.length - 1];
    if (last && !/^\s/.test(raw)) { last.text += raw.trim(); last.t1 = Math.max(last.t1, b ?? last.t1); continue; }
    words.push({ text: raw.trim(), t0: a, t1: b ?? a + 0.3 });
  }
  for (let i = 1; i < words.length; i++) {
    if (words[i].t0 < words[i - 1].t1) words[i].t0 = words[i - 1].t1;
    if (words[i].t1 < words[i].t0 + 0.05) words[i].t1 = words[i].t0 + 0.05;
  }
  // Whisper can say a sentence's last word again as a sentence of its own ("a time. time."), which speech never does
  const end = /[.?!]["')]*$/;
  return words
    .filter((w, i) => !(i && end.test(w.text) && end.test(words[i - 1].text) && key(w.text) === key(words[i - 1].text) && w.t0 - words[i - 1].t1 < 0.3))
    .map((w) => ({ text: w.text, t0: +w.t0.toFixed(2), t1: +w.t1.toFixed(2) }));
}

/** Sentences to read: a sentence ends at . ? or !, at a pause over a second, or at 40 words. */
export function sentences(words) {
  const out = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || /[.?!]["')]*$/.test(w.text) || next.t0 - w.t1 > 1.0 || cur.length >= 40) {
      out.push({ t0: cur[0].t0, t1: w.t1, text: cur.map((x) => x.text).join(" ") });
      cur = [];
    }
  });
  return out;
}

/*
  CAPTION GROUPS, A FEW WORDS AT A TIME. The words split first into phrases (after punctuation, or at a pause), then
  each phrase into even pieces of at most five words and about 20 letters (one row at caption size), so no word is
  left alone on its own screen
  ("week?" after "what's going out this").
*/
export function group(words) {
  const phrases = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || /[.?!,;:]["')]*$/.test(w.text) || next.t0 - w.t1 > 0.45) { phrases.push(cur); cur = []; }
  });
  const out = [];
  for (const ph of phrases) {
    const letters = ph.reduce((n, w) => n + w.text.length + 1, -1);
    const n = Math.max(Math.ceil(ph.length / 5), Math.ceil(letters / 20));
    for (let k = 0, at = 0; k < n; k++) {
      const size = Math.ceil((ph.length - at) / (n - k));
      if (size > 0) out.push(ph.slice(at, at + size));
      at += size;
    }
  }
  return out.map((ws, i, all) => {
    const start = ws[0].t0, end = ws[ws.length - 1].t1;
    const nextStart = all[i + 1] ? all[i + 1][0].t0 : Infinity;
    return { start, end, until: Math.min(nextStart - 0.04, end + 0.7), words: ws };
  });
}
