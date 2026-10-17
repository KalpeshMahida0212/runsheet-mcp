#!/usr/bin/env node
/*
  Cuts YouTube Shorts out of a long video, on the creator's own computer.

    node clip.mjs transcribe <video> [--out <folder>] [--language en]
    node clip.mjs render clip.json

  TRANSCRIBE finds every word and when it is said, with Whisper running on this computer (transformers.js: run
  `npm install` in this engine's stt folder once, about 470 MB; the model, about 290 MB, downloads on the first run).
  Into --out (by default a folder beside the video) it writes:
    transcript.json   every word with its start and end, in seconds
    transcript.txt    one sentence a line with its start and end, to read and choose from
    frames.png        eight frames across the video, to choose how to frame it
  and prints a JSON summary. A transcript already made for the same file is reused.

  RENDER makes one Short from clip.json:
    {
      "source": "C:/Videos/episode-12.mp4",
      "transcript": "C:/Videos/episode-12 clips/transcript.json",
      "start": 754.2, "end": 801.9,          seconds in the source; the cut snaps to the first and last word inside
      "text": "The one thing that *changed* how I upload ...",
                                             the words exactly as said, misheard ones corrected; *stars* mark accent words
      "frame": "crop",                       crop fills the frame (a person on camera); fit keeps the whole picture, blurred behind
      "x": 0.42,                             crop only: where the vertical window sits, 0 the left edge, 1 the right
      "headline": "Why I *stopped* posting daily",   optional, at the top the whole time
      "accent": "#ff4d2e",
      "out": "C:/Videos/Runsheet Shorts/2026-10-20 stopped-daily",
      "pass": "..."                          this clip's pass, from runsheet_start_short (style "studio"): see lib/pass.mjs
    }
  Writes short.mp4 (1080x1920, 30 fps, H.264 and AAC, -14 LUFS), cover.png, sheet.png (captions across the clip,
  tiled, to check by eye) and timeline.json, then prints a JSON summary.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve, isAbsolute, parse } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { FFMPEG, ff, duration } from "./lib/ff.mjs";
import { findBrowser } from "./lib/browser.mjs";
import { align } from "./lib/align.mjs";
import { windows, appendWindow, tidy, sentences, group } from "./lib/words.mjs";
import { DEV, usePass, markMade } from "./lib/pass.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30, W = 1080, H = 1920;
const MODEL = "onnx-community/whisper-base_timestamped";

function fail(msg) { process.stderr.write(`clip: ${msg}\n`); process.exit(1); }
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const stamp = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;

// ---------------------------------------------------------------- transcribe

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

async function transcribe(video) {
  if (!video || !existsSync(video)) fail(`no video at ${video}`);
  video = resolve(video);
  const out = resolve(arg("--out") || join(dirname(video), `${parse(video).name} clips`));
  mkdirSync(out, { recursive: true });
  const st = statSync(video);
  const jsonPath = join(out, "transcript.json");
  const seconds = await duration(video);
  const began = Date.now();
  let words = null;
  if (existsSync(jsonPath)) {
    const old = JSON.parse(readFileSync(jsonPath, "utf8"));
    if (old.source === video && old.size === st.size && old.mtime === st.mtimeMs) words = old.words;
  }
  if (!words) {
    let tf;
    try { tf = createRequire(join(HERE, "stt", "package.json"))("@huggingface/transformers"); }
    catch { fail(`the speech-to-text part is not installed yet. Run npm install --prefix "${join(HERE, "stt")}" once (about 470 MB), then run this again.`); }
    tf.env.cacheDir = join(HERE, "stt", "models");
    process.stderr.write(`clip: listening to ${stamp(seconds)} of sound (about a fifth of that on most computers; the model downloads once)\n`);
    const asr = await tf.pipeline("automatic-speech-recognition", MODEL, { dtype: "fp32" });
    const lang = arg("--language");
    const audio = await samples(video), pieces = [], wins = windows(audio);
    for (const [i, [a, b]] of wins.entries()) {
      const r = await asr(audio.subarray(a, b), { return_timestamps: "word", task: "transcribe", ...(lang ? { language: lang } : {}) });
      appendWindow(pieces, (r.chunks || []).filter((c) => c.timestamp?.[0] != null)
        .map((c) => ({ text: c.text, timestamp: [c.timestamp[0] + a / 16000, (c.timestamp[1] ?? c.timestamp[0] + 0.3) + a / 16000] })));
      if (i % 10 === 9) process.stderr.write(`clip: ${stamp(b / 16000)} of ${stamp(seconds)} heard\n`);
    }
    words = tidy(pieces);
    if (!words.length) fail("no speech was found in this video.");
    writeFileSync(jsonPath, JSON.stringify({ source: video, size: st.size, mtime: st.mtimeMs, seconds, words }));
  }
  const said = sentences(words);
  const txt = join(out, "transcript.txt");
  writeFileSync(txt, [`${parse(video).base}, ${stamp(seconds)}, ${words.length} words. Times are minutes:seconds into the video.`, "",
    ...said.map((s) => `[${stamp(s.t0)} - ${stamp(s.t1)}] ${s.text}`)].join("\n") + "\n");

  // eight frames across the video, to see whether it is a person on camera, a screen or several people
  const work = join(out, "frames");
  mkdirSync(work, { recursive: true });
  for (let i = 0; i < 8; i++) {
    await ff(["-ss", ((i + 0.5) * seconds / 8).toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=480:-2", join(work, `f-${i}.jpg`)]);
  }
  const frames = join(out, "frames.png");
  await ff(["-i", join(work, "f-%d.jpg"), "-vf", "tile=4x2:padding=6:color=0x222222", "-frames:v", "1", frames]);
  rmSync(work, { recursive: true, force: true });

  process.stdout.write(JSON.stringify({
    ok: true, transcript: jsonPath, text: txt, frames, seconds: +seconds.toFixed(1), words: words.length, sentences: said.length,
    secondsTaken: Math.round((Date.now() - began) / 1000),
  }, null, 2) + "\n");
}

// ---------------------------------------------------------------- render

function readClip(path) {
  const base = dirname(resolve(path));
  const abs = (p) => (p ? (isAbsolute(p) ? p : resolve(base, p)) : p);
  const s = JSON.parse(readFileSync(path, "utf8"));
  const c = {
    source: abs(s.source), transcript: abs(s.transcript), out: abs(s.out || join(base, "clip-out")),
    start: Number(s.start), end: Number(s.end), text: s.text ? String(s.text) : null,
    frame: s.frame === "fit" ? "fit" : "crop", x: Math.min(1, Math.max(0, Number(s.x ?? 0.5))),
    headline: s.headline ? String(s.headline).trim() : null,
    accent: /^#[0-9a-f]{6}$/i.test(s.accent || "") ? s.accent : "#ff4d2e",
    pass: s.pass ? String(s.pass) : null,
  };
  if (!existsSync(c.source || "")) fail(`source not found: ${c.source}`);
  if (!existsSync(c.transcript || "")) fail(`transcript not found: ${c.transcript}. Run: node clip.mjs transcribe "${c.source}"`);
  if (!(c.end > c.start)) fail("end must be after start.");
  return c;
}

async function render(specPath) {
  if (!specPath) fail("usage: node clip.mjs render clip.json");
  const C = readClip(specPath);
  const began = Date.now();
  const T = JSON.parse(readFileSync(C.transcript, "utf8"));
  const inside = T.words.filter((w) => w.t0 >= C.start - 0.25 && w.t1 <= C.end + 0.25);
  if (!inside.length) fail(`no words between ${stamp(C.start)} and ${stamp(C.end)}.`);
  const srcLen = await duration(C.source);
  const cutStart = Math.max(0, inside[0].t0 - 0.15);
  const cutEnd = Math.min(srcLen, inside[inside.length - 1].t1 + 0.4);
  const len = cutEnd - cutStart;
  if (len < 3 || len > 180) fail(`the cut is ${len.toFixed(1)} s; a Short is 3 seconds to 3 minutes (20 to 59 s works best).`);

  // the words on screen, timed against the words heard
  const heard = inside.map((w) => ({ text: w.text, t0: w.t0 - cutStart, t1: w.t1 - cutStart }));
  const shown = align(C.text || inside.map((w) => w.text).join(" "), heard, len);
  const unheard = shown.filter((w) => !w.heard).length;
  const groups = group(shown);
  if (!DEV) await usePass(C.pass, "studio").catch((e) => fail(e.message));

  mkdirSync(C.out, { recursive: true });
  const work = join(C.out, "work");
  mkdirSync(work, { recursive: true });
  const timeline = {
    w: W, h: H, fps: FPS, duration: len, accent: C.accent, headline: C.headline,
    captionY: C.frame === "fit" ? 1480 : 1330,
    groups: groups.map((g) => ({ start: g.start, end: g.end, until: g.until, words: g.words.map((w) => ({ text: w.text, emph: w.emph, t0: w.t0, t1: w.t1 })) })),
  };
  writeFileSync(join(C.out, "timeline.json"), JSON.stringify({ source: C.source, cutStart, cutEnd, ...timeline }, null, 1));

  const browser = await chromium.launch({ executablePath: findBrowser(), args: ["--allow-file-access-from-files", "--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, "template", "captions.html")).href);
  await page.evaluate((tl) => window.load(tl), timeline);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const long = (await page.evaluate(() => window.rows)).map((n, i) => (n > 2 ? i : -1)).filter((i) => i >= 0);
  if (long.length) {
    await browser.close();
    fail(`caption ${long.map((i) => `"${groups[i].words.map((w) => w.text).join(" ")}"`).join(", ")} takes more than two rows: shorten the long word or split it.`);
  }

  // the sound: the cut's own audio, measured, then brought to -14 LUFS as one gain
  const LOUD = "loudnorm=I=-14:TP=-1.5:LRA=11";
  const cut = ["-ss", cutStart.toFixed(3), "-t", len.toFixed(3), "-i", C.source];
  const m = JSON.parse((await ff([...cut, "-vn", "-af", `${LOUD}:print_format=json`, "-f", "null", "-"])).match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  const audio = `[0:a]${LOUD}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,` +
    `aresample=48000,afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, len - 0.1).toFixed(3)}:d=0.1[a]`;

  // the picture: the cut made vertical, then the captions laid over it
  const picture = C.frame === "fit"
    ? "[0:v]fps=30,split=2[s1][s2];" +
      "[s1]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=18:2,scale=1080:1920,eq=brightness=-0.12[bg];" +
      "[s2]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=x=(W-w)/2:y='max(0,min(H-h,860-h/2))',setsar=1[base]"
    : `[0:v]fps=30,crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-min(iw,ih*9/16))*${C.x}':y='(ih-min(ih,iw*16/9))/2',scale=1080:1920,setsar=1[base]`;
  const video = join(C.out, "short.mp4");
  const frames = Math.ceil(len * FPS);
  await ff([
    ...cut,
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-filter_complex", `${picture};[base][1:v]overlay=0:0:format=auto,format=yuv420p[v];${audio}`,
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-t", len.toFixed(3), "-movflags", "+faststart", video,
  ], {
    input: async (stdin) => {
      for (let f = 0; f < frames; f++) {
        await page.evaluate((x) => window.seek(x), f / FPS);
        const png = await page.screenshot({ type: "png", omitBackground: true });
        if (!stdin.write(png)) await new Promise((ok) => stdin.once("drain", ok));
        if (f % 150 === 0) process.stderr.write(`clip: frame ${f} of ${frames}\n`);
      }
      stdin.end();
    },
  });
  await browser.close();

  // the cover (the end of the first caption, with the headline) and up to ten captions across the clip, to check
  const cover = join(C.out, "cover.png");
  await ff(["-ss", Math.min(len - 0.1, groups[0].until - 0.08).toFixed(3), "-i", video, "-frames:v", "1", cover]);
  for (const f of readdirSync(work)) if (/^sheet-\d+\.jpg$/.test(f)) rmSync(join(work, f));
  const picks = [...new Set(Array.from({ length: Math.min(10, groups.length) }, (_, i) => Math.round(i * (groups.length - 1) / Math.max(1, Math.min(10, groups.length) - 1))))];
  for (const [i, gi] of picks.entries()) {
    const at = Math.max(0, Math.min(len - 0.1, groups[gi].until - 0.08));
    await ff(["-ss", at.toFixed(3), "-i", video, "-frames:v", "1", "-q:v", "3", join(work, `sheet-${String(i).padStart(2, "0")}.jpg`)]);
  }
  const sheet = join(C.out, "sheet.png");
  await ff(["-i", join(work, "sheet-%02d.jpg"), "-vf", `scale=270:480,tile=${Math.ceil(picks.length / 2)}x2:padding=6:color=0x222222`, "-frames:v", "1", sheet]);

  const warnings = [];
  if (unheard > shown.length * 0.25) warnings.push(`${unheard} of ${shown.length} words on screen were not heard in the cut: the text should follow what is said, word for word.`);
  const seconds = Number((await duration(video)).toFixed(2));
  await markMade(C.pass, seconds);
  process.stdout.write(JSON.stringify({
    ok: true, video, cover, sheet, seconds,
    from: stamp(cutStart), to: stamp(cutEnd), captions: groups.length, wordsNotHeard: unheard, warnings,
    renderSeconds: Math.round((Date.now() - began) / 1000),
  }, null, 2) + "\n");
}

const [cmd, target] = process.argv.slice(2);
(cmd === "transcribe" ? transcribe(target) : cmd === "render" ? render(target) : Promise.reject(new Error("usage: node clip.mjs transcribe <video> | node clip.mjs render clip.json")))
  .catch((e) => fail(e?.stack || e?.message || String(e)));
