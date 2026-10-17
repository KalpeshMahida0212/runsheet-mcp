#!/usr/bin/env node
/*
  Watches a finished video on the creator's own computer, so their Claude can write its title, description, chapters
  and tags from what is really in it, and makes a thumbnail from one of its own frames. Nothing leaves the computer.

    node watch.mjs look <video> [--out <folder>] [--language en] [--frames 12]
    node watch.mjs frame <video> <seconds> <out.jpg>
    node watch.mjs thumb thumb.json

  LOOK writes into --out (by default a folder named "<video name> watch" beside the video):
    video.json        its length, size, frame rate, whether it has sound, and whether YouTube will treat it as a Short
    transcript.txt    one sentence a line with when it starts and ends (minutes:seconds), heard by Whisper on this
                      computer (npm install in this engine's stt folder once, about 470 MB; the model downloads once)
    transcript.json   every word with its start and end, in seconds
    frames.png        frames across the video, left to right then down, at the times the summary lists
  and prints a JSON summary. A transcript already made for the same file is reused. --no-speech skips the listening
  (a video with no sound track skips it anyway).

  FRAME saves one full size picture from the video, to look at closely or to use as a thumbnail.

  THUMB makes a thumbnail from a picture and a few words:
    {
      "image": "C:/Videos/episode-12 watch/frame-312.jpg",   a frame from FRAME, or any picture of the creator's
      "text": "The *one* setting I changed",                 3 to 6 words, *stars* on the word to set in the accent
      "accent": "#ff4a36",
      "side": "left",                                        where the words go: left, right or bottom (keep faces clear)
      "focus": "70% 40%",                                    optional: the point of the picture to keep in view
      "shape": "16x9",                                       16x9 for a long video, 9x16 for a Short
      "out": "C:/Videos/episode-12 watch/thumbnail.jpg"
    }
  It refuses words that cannot be read at phone size before it draws anything.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve, isAbsolute, parse } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { ff, probe } from "./lib/ff.mjs";
import { findBrowser } from "./lib/browser.mjs";
import { sentences } from "./lib/words.mjs";
import { hear, stamp } from "./lib/hear.mjs";
import { themeOf } from "./lib/scenes.mjs";
import { tokens } from "./lib/align.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
function fail(msg) { process.stderr.write(`watch: ${msg}\n`); process.exit(1); }
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const clock = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : `${Math.floor(s / 60)}`) + `:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------------------------------------------------------------- look

async function look(video) {
  if (!video || !existsSync(video)) fail(`no video at ${video}`);
  video = resolve(video);
  const out = resolve(arg("--out") || join(dirname(video), `${parse(video).name} watch`));
  mkdirSync(out, { recursive: true });
  const began = Date.now();
  const info = await probe(video).catch((e) => fail(e.message));
  const vertical = info.height > info.width;
  /*
    A Short, as YouTube decides it: square or vertical and three minutes at most (since 15 Oct 2024). A longer
    vertical video uploads as a regular video.
  */
  const short = info.height >= info.width && info.seconds <= 180;

  let words = [];
  if (info.audio && !process.argv.includes("--no-speech")) {
    ({ words } = await hear(video, join(out, "transcript.json"), { language: arg("--language"), log: (m) => process.stderr.write(`watch: ${m}\n`) }).catch((e) => fail(e.message)));
  }
  const said = sentences(words);
  writeFileSync(join(out, "transcript.txt"), [
    `${parse(video).base}, ${stamp(info.seconds)}, ${words.length} words. Times are minutes:seconds into the video.`, "",
    ...(said.length ? said.map((s) => `[${stamp(s.t0)} - ${stamp(s.t1)}] ${s.text}`) : [info.audio ? "No speech was heard: music or other sound only." : "This video has no sound track."]),
  ].join("\n") + "\n");

  // frames across the video, small enough to read as one sheet: what is on screen, who, and what text is shown
  const n = Math.max(4, Math.min(24, Number(arg("--frames")) || (short ? 8 : 12)));
  const times = Array.from({ length: n }, (_, i) => Number(((i + 0.5) * info.seconds / n).toFixed(2)));
  const work = join(out, "frames-work");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const cell = vertical ? "scale=270:-2" : "scale=480:-2";
  for (const [i, t] of times.entries()) await ff(["-ss", String(t), "-i", video, "-frames:v", "1", "-vf", cell, join(work, `f-${String(i).padStart(2, "0")}.jpg`)]);
  const cols = vertical ? Math.min(n, 6) : 4;
  const frames = join(out, "frames.png");
  await ff(["-i", join(work, "f-%02d.jpg"), "-vf", `tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=0x222222`, "-frames:v", "1", frames]);
  rmSync(work, { recursive: true, force: true });

  const meta = {
    file: video, seconds: Number(info.seconds.toFixed(2)), length: clock(info.seconds), width: info.width, height: info.height, fps: info.fps,
    sound: info.audio, vertical, short, words: words.length, sentences: said.length,
  };
  writeFileSync(join(out, "video.json"), JSON.stringify(meta, null, 2));
  process.stdout.write(JSON.stringify({
    ok: true, ...meta, folder: out, transcript: join(out, "transcript.txt"), frames,
    frameTimes: times.map(clock), frameLayout: `${cols} across, left to right then down`,
    secondsTaken: Math.round((Date.now() - began) / 1000),
  }, null, 2) + "\n");
}

// ---------------------------------------------------------------- frame

async function frame(video, at, file) {
  if (!video || !existsSync(video)) fail(`no video at ${video}`);
  if (!(Number(at) >= 0)) fail("usage: node watch.mjs frame <video> <seconds> <out.jpg>");
  file = resolve(file || join(dirname(resolve(video)), `${parse(video).name} frame ${Math.round(Number(at))}.jpg`));
  mkdirSync(dirname(file), { recursive: true });
  await ff(["-ss", String(Number(at)), "-i", resolve(video), "-frames:v", "1", "-q:v", "2", file]);
  process.stdout.write(JSON.stringify({ ok: true, file, at: clock(Number(at)) }) + "\n");
}

// ---------------------------------------------------------------- thumb

async function thumb(specPath) {
  if (!specPath || !existsSync(specPath)) fail("usage: node watch.mjs thumb thumb.json");
  const base = dirname(resolve(specPath));
  const abs = (p) => (p ? (isAbsolute(p) ? p : resolve(base, p)) : p);
  const s = JSON.parse(readFileSync(specPath, "utf8"));
  const image = abs(s.image);
  if (!image || !existsSync(image)) fail(`no picture at ${image}`);
  const words = tokens(s.text || "");
  if (words.length < 1 || words.length > 6) fail("a thumbnail takes 1 to 6 words: fewer, bigger words read on a phone.");
  const tall = s.shape === "9x16";
  const W = tall ? 1080 : 1280, H = tall ? 1920 : 720;
  const side = ["left", "right", "bottom"].includes(s.side) ? s.side : tall ? "bottom" : "left";
  const out = abs(s.out || join(dirname(image), "thumbnail.jpg"));
  const th = themeOf(s.accent);
  const font = (f) => pathToFileURL(join(HERE, "fonts", f)).href;
  const shade = side === "left" ? "90deg" : side === "right" ? "270deg" : "0deg";
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Inter Tight"; src: url("${font("InterTight.woff2")}") format("woff2"); font-weight: 600 900; }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
#bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${/^[\d.]+% [\d.]+%$/.test(s.focus || "") ? s.focus : "50% 40%"}; filter: saturate(1.12) contrast(1.06); }
#shade { position: absolute; inset: 0; background: linear-gradient(${shade}, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.68) ${side === "bottom" ? 34 : 42}%, rgba(0,0,0,0) ${side === "bottom" ? 66 : 78}%); }
#words { position: absolute; display: flex; flex-direction: column; gap: 0.06em; font-family: "Inter Tight", system-ui, sans-serif; font-weight: 900;
  text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.92; color: #fff; text-shadow: 0 0.05em 0.18em rgba(0,0,0,0.55);
  -webkit-text-stroke: 0.04em rgba(0,0,0,0.5); paint-order: stroke fill; }
.line { display: flex; gap: 0.22em; white-space: nowrap; }
.w { display: inline-block; }
.w.e { background: ${th.accentFill}; color: #fff; padding: 0.06em 0.14em 0.02em; text-shadow: none; -webkit-text-stroke: 0; transform: rotate(-1.5deg); }
</style></head><body><img id="bg" src="${pathToFileURL(image).href}"><div id="shade"></div><div id="words"></div></body></html>`;

  const browser = await chromium.launch({ executablePath: findBrowser(), args: ["--allow-file-access-from-files"] });
  try {
    const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const tmp = join(dirname(out), `.thumb-${process.pid}.html`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(tmp, page);
    await tab.goto(pathToFileURL(tmp).href);
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForFunction(() => document.getElementById("bg").complete);
    // words into one line or two balanced ones, then as big as the room allows
    const fit = await tab.evaluate(({ words, W, H, side, tall }) => {
      const box = document.getElementById("words");
      const pad = tall ? 70 : 56;
      const room = side === "bottom" ? { w: W - pad * 2, h: H * (tall ? 0.34 : 0.42) } : { w: W * 0.56, h: H - pad * 2 };
      const chars = (ws) => ws.reduce((n, w) => n + w.text.length, 0) + ws.length - 1;
      const splits = [[words]];
      for (let k = 1; k < words.length; k++) splits.push([words.slice(0, k), words.slice(k)]);
      const best = splits.filter((l) => l.length === 1 ? chars(words) <= 14 : true)
        .sort((a, b) => Math.max(...a.map(chars)) - Math.max(...b.map(chars)))[0];
      box.innerHTML = "";
      for (const line of best) {
        const l = document.createElement("div");
        l.className = "line";
        for (const w of line) { const s = document.createElement("span"); s.className = `w${w.emph ? " e" : ""}`; s.textContent = w.text; l.appendChild(s); }
        box.appendChild(l);
      }
      let size = tall ? 200 : 170;
      box.style.fontSize = `${size}px`;
      while ((box.offsetWidth > room.w || box.offsetHeight > room.h) && size > 40) { size -= 4; box.style.fontSize = `${size}px`; }
      if (side === "left") { box.style.left = `${pad}px`; box.style.top = `${(H - box.offsetHeight) / 2}px`; }
      else if (side === "right") { box.style.right = `${pad}px`; box.style.top = `${(H - box.offsetHeight) / 2}px`; box.style.alignItems = "flex-end"; }
      else { box.style.left = `${pad}px`; box.style.bottom = `${tall ? 260 : pad}px`; }
      return { size, lines: best.length };
    }, { words, W, H, side, tall });
    /*
      LEGIBLE AT PHONE SIZE. A thumbnail is seen at about 170 pixels wide in a phone's list, so the words have to be
      at least an eighth of the picture's height (90 px of 720) to be read there at all.
    */
    const min = tall ? 150 : 90;
    if (fit.size < min) fail(`"${s.text}" only fits at ${fit.size} px, too small to read on a phone. Use fewer or shorter words (3 to 5 is best).`);
    let q = 90;
    await tab.screenshot({ path: out, type: "jpeg", quality: q });
    while (statSync(out).size > 2 * 1024 * 1024 && q > 50) { q -= 10; await tab.screenshot({ path: out, type: "jpeg", quality: q }); }
    rmSync(tmp, { force: true });
    process.stdout.write(JSON.stringify({ ok: true, file: out, width: W, height: H, textSize: fit.size, lines: fit.lines, kilobytes: Math.round(statSync(out).size / 1024) }, null, 2) + "\n");
  } finally {
    await browser.close();
  }
}

const [cmd, a, b, c] = process.argv.slice(2);
const run = cmd === "look" ? look(a) : cmd === "frame" ? frame(a, b, c) : cmd === "thumb" ? thumb(a)
  : Promise.reject(new Error("usage: node watch.mjs look <video> | node watch.mjs frame <video> <seconds> <out.jpg> | node watch.mjs thumb thumb.json"));
run.catch((e) => fail(e?.stack || e?.message || String(e)));
