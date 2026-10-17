/*
  What is said in a video, and when: Whisper running on this computer (transformers.js, installed once with
  `npm install` in the engine's stt folder, about 470 MB; the model, about 290 MB, downloads on the first run).
  The words are cached in a JSON file beside the other notes, keyed by the video's size and time, so looking at the
  same file again is instant. Nothing is sent anywhere.
*/
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FFMPEG, duration } from "./ff.mjs";
import { windows, appendWindow, tidy } from "./words.mjs";

const ENGINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "onnx-community/whisper-base_timestamped";
export const stamp = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;

/** The sound as 16 kHz mono samples, the way Whisper hears it. */
function samples(video) {
  return new Promise((ok, no) => {
    const p = spawn(FFMPEG, ["-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { stdio: ["ignore", "pipe", "pipe"] });
    const parts = [];
    let err = "";
    p.stdout.on("data", (d) => parts.push(d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", no);
    p.on("close", (code) => {
      if (code) return no(new Error(`could not read the sound of ${video}: ${err.slice(-300)}`));
      const b = Buffer.concat(parts);
      ok(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4)));
    });
  });
}

/**
 * Every word with its start and end in seconds. `cache` is the JSON file to keep them in. Throws, with the command to
 * run, when the speech part is not installed yet.
 */
export async function hear(video, cache, { language = null, log = () => {} } = {}) {
  const st = statSync(video);
  const seconds = await duration(video);
  if (existsSync(cache)) {
    const old = JSON.parse(readFileSync(cache, "utf8"));
    if (old.source === video && old.size === st.size && old.mtime === st.mtimeMs) return { words: old.words, seconds };
  }
  let tf;
  try { tf = createRequire(join(ENGINE, "stt", "package.json"))("@huggingface/transformers"); }
  catch { throw new Error(`the speech-to-text part is not installed yet. Run npm install --prefix "${join(ENGINE, "stt")}" once (about 470 MB), then run this again.`); }
  tf.env.cacheDir = join(ENGINE, "stt", "models");
  log(`listening to ${stamp(seconds)} of sound (about a fifth of that on most computers; the model downloads once)`);
  const asr = await tf.pipeline("automatic-speech-recognition", MODEL, { dtype: "fp32" });
  const audio = await samples(video), pieces = [], wins = windows(audio);
  for (const [i, [a, b]] of wins.entries()) {
    const r = await asr(audio.subarray(a, b), { return_timestamps: "word", task: "transcribe", ...(language ? { language } : {}) });
    appendWindow(pieces, (r.chunks || []).filter((c) => c.timestamp?.[0] != null)
      .map((c) => ({ text: c.text, timestamp: [c.timestamp[0] + a / 16000, (c.timestamp[1] ?? c.timestamp[0] + 0.3) + a / 16000] })));
    if (i % 10 === 9) log(`${stamp(b / 16000)} of ${stamp(seconds)} heard`);
  }
  const words = tidy(pieces);
  writeFileSync(cache, JSON.stringify({ source: video, size: st.size, mtime: st.mtimeMs, seconds, words }));
  return { words, seconds };
}
