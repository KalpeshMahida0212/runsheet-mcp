// node test.mjs: checks the word logic that captions depend on. Needs no install, no browser and no network.
import assert from "node:assert/strict";
import { align } from "./lib/align.mjs";
import { windows, appendWindow, tidy, group } from "./lib/words.mjs";

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

console.log("ok: align, group, tidy, appendWindow, windows");
