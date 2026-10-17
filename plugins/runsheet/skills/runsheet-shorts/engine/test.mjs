// node test.mjs: checks the word logic that captions depend on. Needs no install, no browser and no network.
import assert from "node:assert/strict";
import { align } from "./lib/align.mjs";
import { windows, appendWindow, tidy, group } from "./lib/words.mjs";
import { readScenes, plan, themeOf, chaptersOf } from "./lib/scenes.mjs";
import { parseReport } from "./lib/ff.mjs";

// a corrected name and a web address that was heard as six words do not pull the words after them out of step
{
  const heard = "Here's how to connect Clod to your YouTube channel Name it Run Sheet then paste this address Runsheet.buildifyaptit and slash API slash MCP Choose Add then Connect"
    .split(" ").map((text, i) => ({ text, t0: i * 0.3, t1: i * 0.3 + 0.25 }));
  const shown = align("Here's how to connect *Claude* to your YouTube channel. Name it Runsheet, then paste this address: runsheet.buildifyapp.in/api/mcp. Choose Add, then Connect.", heard, 12);
  const at = (w) => shown.find((x) => x.text.startsWith(w));
  assert.equal(at("Choose").t0, heard.find((x) => x.text === "Choose").t0);
  assert.equal(at("Connect.").t0, heard.find((x) => x.text === "Connect").t0);
  assert.equal(at("Claude").heard, false);
  assert.equal(at("Claude").emph, true);
  const c = shown.findIndex((x) => x.text === "Claude");
  assert.ok(shown[c].t0 >= shown[c - 1].t1 && shown[c].t1 <= shown[c + 1].t0 + 1e-9);
  assert.ok(shown.every((w, i) => i === 0 || w.t0 >= shown[i - 1].t0));
}

// caption groups: at most five words, never one word left alone after its phrase
{
  const words = "Now just ask, what's going out this week? Claude reads your running order.".split(" ").map((text, i) => ({ text, t0: i * 0.3, t1: i * 0.3 + 0.25 }));
  const groups = group(words).map((g) => g.words.map((w) => w.text).join(" "));
  assert.deepEqual(groups, ["Now just ask,", "what's going out", "this week?", "Claude reads your", "running order."]);
  assert.ok(group(words).every((g, i, all) => i === all.length - 1 || g.until <= all[i + 1].start));
}

// pieces become words: ".in" carries on the word before it, and times only move forward
{
  const words = tidy([
    { text: " Start", timestamp: [1.0, 1.2] }, { text: " free", timestamp: [1.2, 1.4] }, { text: " at", timestamp: [1.4, 1.5] },
    { text: " Runsheet", timestamp: [1.5, 1.9] }, { text: ".buildifyapp", timestamp: [1.9, 2.4] }, { text: ".in", timestamp: [2.4, 2.5] },
    { text: " now", timestamp: [2.45, 2.7] },
  ]);
  assert.deepEqual(words.map((w) => w.text), ["Start", "free", "at", "Runsheet.buildifyapp.in", "now"]);
  assert.equal(words[3].t1, 2.5);
  assert.ok(words.every((w, i) => i === 0 || w.t0 >= words[i - 1].t1));
  // a sentence's last word said again as a sentence of its own is dropped; "no, no." in a sentence is kept
  const again = tidy([{ text: " pick", timestamp: [82.1, 82.3] }, { text: " a", timestamp: [82.3, 82.4] }, { text: " time.", timestamp: [82.6, 82.98] },
    { text: " time.", timestamp: [82.9, 83.26] }, { text: " No,", timestamp: [84, 84.2] }, { text: " no.", timestamp: [84.2, 84.5] }]);
  assert.deepEqual(again.map((w) => w.text), ["pick", "a", "time.", "No,", "no."]);
}

// a word heard again at the start of the next window is dropped, a real repeat later on is kept
{
  const pieces = [{ text: " a", timestamp: [80.0, 80.4] }, { text: " time.", timestamp: [80.4, 81.0] }];
  appendWindow(pieces, [{ text: " time.", timestamp: [81.1, 81.4] }, { text: " Tomorrow", timestamp: [81.5, 82.0] }]);
  assert.deepEqual(pieces.map((p) => p.text.trim()), ["a", "time.", "Tomorrow"]);
  appendWindow(pieces, [{ text: " Tomorrow", timestamp: [90.0, 90.5] }]);
  assert.equal(pieces.length, 4);
}

// windows end inside a pause, the latest of two equally quiet ones, and nothing is left out
{
  const rate = 16000, len = 70 * rate, audio = new Float32Array(len);
  let seed = 7;
  for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; audio[i] = (seed / 2147483648 - 0.5) * 0.6; }
  const pauses = [18, 26, 47, 55];
  for (const p of pauses) audio.fill(0, p * rate, (p + 0.4) * rate);
  const w = windows(audio, rate);
  assert.equal(w[0][0], 0);
  assert.equal(w[w.length - 1][1], len);
  for (let i = 1; i < w.length; i++) assert.equal(w[i][0], w[i - 1][1]);
  for (const [, end] of w.slice(0, -1)) assert.ok(pauses.some((p) => end > p * rate && end < (p + 0.4) * rate), `cut at ${end / rate} s is not in a pause`);
  assert.equal(Math.floor(w[0][1] / rate), 26);
  assert.ok(w.every(([a, b]) => b - a <= 30 * rate));
}

// the script is checked: unknown types, missing fields and over-long lists are refused with the scene's number
{
  const bad = readScenes({ scenes: [{ type: "list", say: "x", text: "t", items: ["a"] }, { type: "wobble", say: "y" }] }, (p) => p);
  assert.ok(bad.errors.some((e) => e.includes("scene 1 is the hook")));
  assert.ok(bad.errors.some((e) => e.startsWith("scene 1 (list)") && e.includes("2 to 4")));
  assert.ok(bad.errors.some((e) => e.startsWith("scene 2 (wobble)")));
  const old = readScenes({ lines: ["First *line*.", "Second line."], end: { sub: "@me" } }, (p) => p);
  assert.deepEqual(old.scenes.map((s) => s.type), ["hook", "text", "end"]);
}

// the plan: things land on their words, a slam keeps the scene before it on, a late landing gets a beat
{
  const clip = (text, dur = 2) => ({ duration: dur, words: text.split(" ").map((t, i) => ({ text: t, t0: 0.1 + i * 0.3, t1: 0.35 + i * 0.3 })) });
  const scenes = readScenes({ scenes: [
    { type: "hook", say: "Three rules for a shared login.", text: "Three *rules*" },
    { type: "list", say: "Never paste it. Update everyone. Remove leavers.", text: "The rules", items: ["Never paste it", "Update everyone", "Remove leavers"] },
    { type: "slam", say: "Done.", text: "Done" },
    { type: "end", say: "Follow for more.", sub: "@me" },
  ] }, (p) => p).scenes;
  const P = plan(scenes, scenes.map((s) => clip(s.say, s.type === "list" ? 3 : 1.5)));
  const [hook, list, slam] = P.scenes;
  assert.ok(list.items.every((it, k) => k === 0 || it.at > list.items[k - 1].at), "list items land in order");
  assert.ok(Math.abs(list.items[1].at - (list.voiceAt + 0.1 + 3 * 0.3 - 0.05)) < 0.01, "an item lands on its first word");
  assert.equal(hook.overlap, 0.45);
  assert.ok(list.overlap > slam.len, "the scene before a slam stays on under it");
  assert.ok(P.scenes.every((s, i) => i === 0 || Math.abs(s.start - (P.scenes[i - 1].start + P.scenes[i - 1].len)) < 1e-9), "scenes follow on");
  assert.ok(P.captions.length > 0 && P.hits.some((h) => Math.abs(h.t - (slam.start + slam.cues.slam)) < 1e-9));
}

// items that start alike land on their own words, in order, not on the first word they share
{
  const clip = (text, dur = 6) => ({ duration: dur, words: text.split(" ").map((t, i) => ({ text: t, t0: 0.1 + i * 0.3, t1: 0.35 + i * 0.3 })) });
  const say = "Good ideas come from what already worked, what viewers ask, and what breaks out nearby.";
  const scenes = readScenes({ scenes: [
    { type: "hook", say: "Three places.", text: "Three *places*" },
    { type: "list", say, text: "Where ideas come from", items: ["What already worked", "What viewers ask", "What breaks out nearby"] },
    { type: "end", say: "Follow.", sub: "@me" },
  ] }, (p) => p).scenes;
  const P = plan(scenes, scenes.map((s) => clip(s.say, s.type === "list" ? 6 : 1.5)));
  const list = P.scenes[1], words = say.split(" ");
  const said = (n) => list.voiceAt + 0.1 + words.findIndex((w, i) => /^what/i.test(w) && words.slice(0, i).filter((x) => /^what/i.test(x)).length === n) * 0.3 - 0.05;
  list.items.forEach((it, k) => assert.ok(Math.abs(it.at - said(k)) < 0.01, `item ${k + 1} lands on its own "what" (${it.at.toFixed(2)} vs ${said(k).toFixed(2)})`));
}

// colours: white text on the fill and the accent text on cream stay readable, even from a pale accent
{
  const th = themeOf("#f5d76e");
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  assert.ok(ratio(th.accentFill, "#ffffff") >= 3, "white on the fill");
  assert.ok(ratio(th.accentText, th.paper) >= 3.2, "accent text on cream");
}

// a video's shape as it plays: a phone clip stored sideways is turned back, and a silent file says so
{
  const wide = [
    "  Duration: 00:01:02.06, start: 0.000000",
    "  Stream #0:0[0x1](und): Video: h264 (High), yuv420p(tv), 1920x1080 [SAR 1:1 DAR 16:9], 30 fps, 30 tbr",
    "  Stream #0:1[0x2](und): Audio: aac (LC), 48000 Hz, stereo",
  ].join("\n");
  assert.deepEqual(parseReport(wide), { seconds: 62.06, width: 1920, height: 1080, fps: 30, audio: true });
  const phone = [
    "  Duration: 00:00:41.50, start: 0.000000",
    "  Stream #0:0[0x1](und): Video: hevc (Main), yuv420p(tv), 1920x1080, 29.97 fps",
    "      Side data:",
    "        displaymatrix: rotation of -90.00 degrees",
    "  Stream #0:1[0x2](und): Audio: aac",
  ].join("\n");
  assert.deepEqual(parseReport(phone), { seconds: 41.5, width: 1080, height: 1920, fps: 29.97, audio: true });
  const silent = ["  Duration: 00:00:09.00, start: 0.000000", "  Stream #0:0: Video: h264, yuv420p, 1080x1920, 30 fps"].join("\n");
  assert.equal(parseReport(silent).audio, false);
  assert.throws(() => parseReport(["  Duration: N/A", "  Stream #0:0: Audio: mp3"].join("\n")));
}

// a long video's chapters: YouTube's format, a short opening folded into the first chapter, and the rules checked
{
  const sc = (start, type, text) => ({ start, type, text });
  assert.deepEqual(chaptersOf([sc(0, "hook", "h"), sc(4, "chapter", "The plan"), sc(19, "chapter", "The week"), sc(40, "chapter", "Keep *it* going")], 54),
    { lines: ["0:00 The plan", "0:19 The week", "0:40 Keep it going"], problem: null });
  assert.deepEqual(chaptersOf([sc(0, "hook", "h"), sc(25, "chapter", "A"), sc(80, "chapter", "B"), sc(3700, "chapter", "C")], 3800).lines,
    ["0:00 Intro", "0:25 A", "1:20 B", "1:01:40 C"]);
  assert.match(chaptersOf([sc(0, "hook", "h"), sc(30, "chapter", "A")], 60).problem, /at least 3/);
  assert.match(chaptersOf([sc(0, "hook", "h"), sc(12, "chapter", "A"), sc(30, "chapter", "B"), sc(36, "chapter", "C")], 90).problem, /shorter than ten seconds/);
  assert.deepEqual(chaptersOf([sc(0, "hook", "h")], 60), { lines: [], problem: null });
  // a Short has no chapters, and a long video takes many more scenes than a Short
  const twenty = Array.from({ length: 20 }, (_, i) => ({ type: i ? "text" : "hook", say: "A line.", text: "A line" }));
  assert.ok(readScenes({ scenes: twenty }, (p) => p).errors.some((e) => /2 to 14 scenes/.test(e)));
  assert.deepEqual(readScenes({ scenes: twenty }, (p) => p, { long: true }).errors, []);
  assert.ok(readScenes({ scenes: [twenty[0], { type: "chapter", say: "Part one.", text: "Part one" }] }, (p) => p).errors.some((e) => /chapter scenes are for long videos/.test(e)));
}

console.log("ok: align, group, tidy, appendWindow, windows, readScenes, plan, themeOf, parseReport, chaptersOf");
