#!/usr/bin/env node
/*
  Renders one YouTube Short, or a long video, as motion graphics, on the creator's own computer.

    node render.mjs short.json

  short.json (the scene types and their fields are in ../SCENES.md):
    {
      "out": "C:/Users/me/Videos/shorts/2026-10-20 three-rules",   folder for everything it writes
      "title": "Three rules for a shared login",                     the video's title
      "brand": { "name": "Coauth", "handle": "@coauth", "logo": "C:/path/logo.png" },   logo optional
      "theme": "light",                                              light or dark: the usual ground
      "accent": "#d6a85f",                                           the brand colour
      "voice": "en-US-AndrewNeural", "rate": "+6%",                  any Edge neural voice, optional rate
      "music": "auto",                                               auto (the made-up bed), none, or { "path", "volume" }
      "style": "studio",                                             the look: studio (free) or one of the plan's styles
      "pass": "...",                                                 this video's pass, from runsheet_start_video
      "shape": "9x16",                                               9x16 for a Short (the default), 16x9 for a long video
      "captions": true,                                              words lit on screen as they are said (a long video's
                                                                     default is false: it gets captions.srt for YouTube)
      "scenes": [
        { "type": "hook", "say": "Sharing one login with your team? Three rules.", "text": "One login, three *rules*", "kicker": "team passwords" },
        { "type": "list", "say": "...", "text": "The *rules*", "items": ["Never paste it in chat", "..."] },
        { "type": "end", "say": "Coauth. Free on the Chrome Web Store.", "sub": "chrome web store", "stamp": "Free for 3" }
      ]
    }

  Every scene's length is its line's: the voice is spoken first, every word timed, and each thing on screen arrives
  on the word that names it.

  Every video needs a pass (lib/pass.mjs). Writes short.mp4 (a Short, 1080x1920) or video.mp4 (a long video,
  1920x1080), 30 fps, H.264 and AAC at -14 LUFS; cover.png (the opening, settled, with no captions: the thumbnail);
  sheet.png (every scene once it has settled, tiled, to check by eye; a long video gets sheet-1.png, sheet-2.png...);
  captions.srt (every spoken word, timed, for YouTube's captions); chapters.txt (a long video's chapters, from its
  chapter scenes, in YouTube's format); and timeline.json, then prints a JSON summary.

  The frames go straight from each browser tab into its own encoder, a run of the video each, and the runs are joined
  at the end without encoding again, so a ten minute video never sits on the disk as eighteen thousand pictures.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { cpus } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { FFMPEG, ff, duration } from "./lib/ff.mjs";
import { findBrowser } from "./lib/browser.mjs";
import { speak } from "./lib/voice.mjs";
import { readScenes, themeOf, plan, chaptersOf } from "./lib/scenes.mjs";
import { mixSound } from "./lib/sound.mjs";
import { DEV, usePass, markMade } from "./lib/pass.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
/** A Short is at most three minutes (YouTube, since 15 Oct 2024); a long video here at most ten, which keeps the
 *  sound mixer, which holds the whole mix in memory, well inside an ordinary computer's. */
const MAX_SECONDS = { "9x16": 180, "16x9": 600 };

function fail(msg) { process.stderr.write(`render: ${msg}\n`); process.exit(1); }
const say = (msg) => process.stderr.write(`render: ${msg}\n`);

function readSpec(path) {
  const base = dirname(resolve(path));
  const s = JSON.parse(readFileSync(path, "utf8"));
  const abs = (p) => (p ? (isAbsolute(p) ? p : resolve(base, p)) : p);
  const shape = s.shape === "16x9" ? "16x9" : "9x16";
  const { scenes, errors } = readScenes(s, abs, { long: shape === "16x9" });
  if (errors.length) fail(errors.join("\n         "));
  for (const sc of scenes) if (sc.type === "image" && !existsSync(sc.src)) fail(`scene ${scenes.indexOf(sc) + 1}: no file at ${sc.src}`);
  const logo = s.brand?.logo ? abs(s.brand.logo) : null;
  if (logo && !existsSync(logo)) fail(`brand logo not found: ${logo}`);
  const music = s.music === "none" ? "none" : s.music?.path ? { path: abs(s.music.path), volume: Number(s.music.volume ?? 0.5) } : "auto";
  if (music.path && !existsSync(music.path)) fail(`music not found: ${music.path}`);
  return {
    out: abs(s.out || join(base, "short-out")), scenes, music,
    title: String(s.title || scenes[0].say || ""),
    brand: { name: String(s.brand?.name || "My channel"), handle: s.brand?.handle ? String(s.brand.handle) : "", logo },
    theme: s.theme === "dark" ? "dark" : "light",
    accent: /^#[0-9a-f]{6}$/i.test(s.accent || "") ? s.accent : "#ff4a36",
    voice: String(s.voice || "en-US-EmmaMultilingualNeural"),
    rate: s.rate ? String(s.rate) : null,
    style: /^[a-z][a-z0-9-]{1,30}$/.test(s.style || "") ? s.style : "studio",
    pass: s.pass ? String(s.pass) : null,
    shape, W: shape === "16x9" ? 1920 : 1080, H: shape === "16x9" ? 1080 : 1920,
    captions: s.captions == null ? shape === "9x16" : s.captions !== false,
  };
}

/*
  THE STYLE, AND THE PASS THAT LETS IT RUN. Studio is in this folder. Every other style comes from Runsheet with the
  pass: { style: { name, fonts: [{ family, file, weight, style }], sound }, js, fonts: { file: base64 } }, written into
  the work folder for this render only.
*/
async function styleFor(S, work) {
  if (DEV && process.env.RUNSHEET_SHORTS_STYLES_DIR && S.style !== "studio") {
    const dir = join(process.env.RUNSHEET_SHORTS_STYLES_DIR, S.style);
    if (!existsSync(join(dir, "style.js"))) fail(`no style "${S.style}" in ${process.env.RUNSHEET_SHORTS_STYLES_DIR}`);
    return { meta: JSON.parse(readFileSync(join(dir, "style.json"), "utf8")), js: join(dir, "style.js"), fontDir: join(dir, "fonts") };
  }
  const studio = { meta: STUDIO, js: join(HERE, "template", "styles", "studio.js"), fontDir: null };
  if (DEV && S.style === "studio") return studio;
  const body = await usePass(S.pass, S.style).catch((e) => fail(e.message));
  if (S.style === "studio") return studio;
  const dir = join(work, "style");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "fonts"), { recursive: true });
  writeFileSync(join(dir, "style.js"), body.js);
  for (const [file, b64] of Object.entries(body.fonts ?? {})) writeFileSync(join(dir, "fonts", file.replace(/[^A-Za-z0-9._-]/g, "")), Buffer.from(b64, "base64"));
  return { meta: body.style, js: join(dir, "style.js"), fontDir: join(dir, "fonts") };
}

const STUDIO = { name: "studio", title: "Studio", fonts: [], sound: { kit: "studio" } };
const CORE_FONTS = [
  { family: "Inter Tight", file: "InterTight.woff2", weight: "600 900", style: "normal" },
  { family: "Instrument Serif", file: "InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  { family: "JetBrains Mono", file: "JetBrainsMono.woff2", weight: "500 700", style: "normal" },
  { family: "Instrument Sans", file: "InstrumentSans.woff2", weight: "400 700", style: "normal" },
];

/** The page a style draws on: the core fonts and the style's, the icons, the core, then the style. */
function writePage(work, style, { shape, W, H }) {
  const url = (f) => pathToFileURL(f).href;
  const face = (f, dir) => `@font-face { font-family: "${f.family}"; src: url("${url(join(dir, f.file))}") format("woff2"); font-weight: ${f.weight}; font-style: ${f.style || "normal"}; }`;
  const page = `<!doctype html><html><head><meta charset="utf-8" /><style>
${CORE_FONTS.map((f) => face(f, join(HERE, "fonts"))).join("\n")}
${(style.meta.fonts ?? []).map((f) => face(f, style.fontDir)).join("\n")}
html, body { margin: 0; padding: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #f8f6f3; }
body { font-family: "Inter Tight", "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
#stage { position: absolute; inset: 0; overflow: hidden; }
#cam { position: absolute; inset: 0; transform-origin: ${W / 2}px ${H / 2}px; }
.scene { position: absolute; inset: 0; overflow: hidden; display: none; isolation: isolate; }
#caps { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; pointer-events: none; }
</style></head><body>
<div id="stage"><div id="cam"></div><div id="caps"></div></div>
<script>window.RS_SHAPE = "${shape}";</script>
<script src="${url(join(HERE, "template", "icons.js"))}"></script>
<script src="${url(join(HERE, "template", "core.js"))}"></script>
<script src="${url(style.js)}"></script>
</body></html>`;
  const file = join(work, "page.html");
  writeFileSync(file, page);
  return pathToFileURL(file).href;
}

async function openPage(browser, timeline, pageUrl, { W, H }) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(pageUrl);
  await page.evaluate((tl) => window.load(tl), timeline);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  return page;
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) fail("usage: node render.mjs short.json");
  const S = readSpec(specPath);
  const t0 = Date.now();
  mkdirSync(S.out, { recursive: true });
  const work = join(S.out, "work");
  const segDir = join(work, "segments");
  rmSync(segDir, { recursive: true, force: true });
  mkdirSync(segDir, { recursive: true });
  const { W, H } = S;

  // 0. the pass and the style, before anything is spent on this video
  const style = await styleFor(S, work);
  const pageUrl = writePage(work, style, S);

  // 1. the voice: one clip a scene, every word timed
  const spoken = S.scenes.map((sc, i) => (sc.say ? i : -1)).filter((i) => i >= 0);
  const said = await speak(spoken.map((i) => ({ show: S.scenes[i].say, say: S.scenes[i].say })), { voice: S.voice, rate: S.rate, dir: work });
  const clips = S.scenes.map(() => null);
  spoken.forEach((i, k) => { clips[i] = said[k]; });

  // 2. the plan: every scene's start and length, every cue, the captions, the camera's hits
  const P = plan(S.scenes, clips, { theme: S.theme });
  const url = (p) => (p ? pathToFileURL(p).href : null);
  if (P.total > MAX_SECONDS[S.shape]) {
    fail(S.shape === "9x16"
      ? `this Short runs ${Math.round(P.total)} s; YouTube makes anything over three minutes a regular video. Shorten it, or make it a long video ("shape": "16x9").`
      : `this video runs ${Math.round(P.total / 60)} minutes; ten is the most this engine makes in one go. Split it into two videos.`);
  }
  const timeline = {
    w: W, h: H, fps: FPS, duration: P.total, shape: S.shape,
    theme: themeOf(S.accent),
    brand: { name: S.brand.name, handle: S.brand.handle, logo: url(S.brand.logo) },
    scenes: P.scenes.map((s) => (s.type === "image" ? { ...s, src: url(s.src) } : s)),
    captions: S.captions ? P.captions : [], hits: P.hits,
  };
  writeFileSync(join(S.out, "timeline.json"), JSON.stringify(timeline, null, 1));

  // 3. the layout, checked before a single frame is drawn
  const browser = await chromium.launch({ executablePath: findBrowser(), args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"] });
  const first = await openPage(browser, timeline, pageUrl, S);
  const problems = await first.evaluate(() => window.problems);
  if (problems.length) { await browser.close(); fail(problems.join("\n         ")); }

  // 4. the sound: the voice, the score and the hits, at -14 LUFS
  say("mixing the sound");
  const mix = join(work, "mix.wav");
  mixSound({ plan: P, voices: P.scenes.filter((s, i) => clips[i]).map((s) => ({ file: clips[s.no - 1].file, at: s.start + s.voiceAt })), music: S.music, out: mix, work, profile: style.meta.sound ?? {} });

  // 5. the frames, on a few tabs at once, each tab's run piped straight into its own encoder
  const frames = Math.ceil(P.total * FPS);
  const tabs = Math.max(1, Math.min(4, cpus().length - 2));
  const pages = [first];
  for (let k = 1; k < tabs; k++) pages.push(await openPage(browser, timeline, pageUrl, S));
  let done = 0;
  const segments = await Promise.all(pages.map(async (page, k) => {
    const a = Math.floor((k * frames) / tabs), b = Math.floor(((k + 1) * frames) / tabs);
    const file = join(segDir, `run-${k}.mp4`);
    const enc = spawn(FFMPEG, ["-hide_banner", "-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-vf", "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p",
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS), "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      file], { stdio: ["pipe", "ignore", "pipe"] });
    let err = "";
    enc.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    const closed = once(enc, "close");
    for (let f = a; f < b; f++) {
      await page.evaluate((x) => window.seek(x), f / FPS);
      const shot = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!enc.stdin.write(shot)) await once(enc.stdin, "drain");
      if (++done % 300 === 0) say(`frame ${done} of ${frames}`);
    }
    enc.stdin.end();
    const [code] = await closed;
    if (code !== 0) throw new Error(`the encoder for frames ${a} to ${b} failed: ${err.trim().split("\n").slice(-4).join(" ")}`);
    return file;
  }));

  // 6. the cover: the hook once its confetti has settled, without the caption, for a clean thumbnail
  const hook = P.scenes[0];
  const coverAt = hook.start + Math.min(hook.len - 0.15, Math.max(hook.settle, (hook.cues.icon ?? 0) + 1.6));
  // display, not visibility: a style whose caption layer sets visibility on its own children would show through
  await first.evaluate(async (x) => { document.getElementById("caps").style.display = "none"; await window.seek(x); }, coverAt);
  const cover = join(S.out, "cover.png");
  await first.screenshot({ path: cover, type: "png" });
  await first.evaluate(() => { document.getElementById("caps").style.display = ""; });
  // and every scene once it has settled, to check by eye
  for (const f of readdirSync(work)) if (/^sheet-\d+\.jpg$/.test(f)) rmSync(join(work, f));
  for (const [i, s] of P.scenes.entries()) {
    await first.evaluate((x) => window.seek(x), s.start + s.settle);
    await first.screenshot({ path: join(work, `sheet-${String(i).padStart(3, "0")}.jpg`), type: "jpeg", quality: 90 });
  }
  await browser.close();
  const wide = S.shape === "16x9", PAGE = wide ? 20 : 14;
  const sheets = [];
  for (let p = 0; p * PAGE < P.scenes.length; p++) {
    const n = Math.min(PAGE, P.scenes.length - p * PAGE), cols = wide ? Math.min(n, 4) : n <= 4 ? n : Math.ceil(n / 2);
    const file = join(S.out, P.scenes.length > PAGE ? `sheet-${p + 1}.png` : "sheet.png");
    await ff(["-start_number", String(p * PAGE), "-i", join(work, "sheet-%03d.jpg"), "-frames:v", "1", "-vf", `${wide ? "scale=480:270" : "scale=270:480"},tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=0x222222`, "-update", "1", file]);
    sheets.push(file);
  }
  const sheet = sheets[0];

  // 7. the video: the runs joined as they are (BT.709 in TV range, as YouTube expects) and the mix laid under them
  const video = join(S.out, S.shape === "16x9" ? "video.mp4" : "short.mp4");
  say("joining the runs and the sound");
  const list = join(segDir, "runs.txt");
  writeFileSync(list, segments.map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  await ff(["-f", "concat", "-safe", "0", "-i", list, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", video]);
  rmSync(segDir, { recursive: true, force: true });
  rmSync(join(work, "style"), { recursive: true, force: true });
  // the mix and the sheet frames are made again on every render, and a ten minute mix is over 200 MB
  for (const f of readdirSync(work)) if (/^(mix(-raw)?\.wav|sheet-\d+\.jpg)$/.test(f)) rmSync(join(work, f));

  // 8. the captions as a file for YouTube, and a long video's chapters in YouTube's format
  const srtClock = (t) => { const ms = Math.max(0, Math.round(t * 1000)); return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  const captionsFile = join(S.out, "captions.srt");
  writeFileSync(captionsFile, P.captions.map((c, i) => `${i + 1}\n${srtClock(c.a)} --> ${srtClock(Math.max(c.end, c.a + 0.3))}\n${c.words.map((w) => w.t).join(" ")}\n`).join("\n"));
  const chapters = chaptersOf(P.scenes, P.total);
  let chaptersFile = null;
  if (chapters.lines.length) { chaptersFile = join(S.out, "chapters.txt"); writeFileSync(chaptersFile, chapters.lines.join("\n") + "\n"); }

  const len = await duration(video);
  await markMade(S.pass, Number(len.toFixed(2)));
  process.stdout.write(JSON.stringify({
    ok: true, video, cover, sheet, ...(sheets.length > 1 ? { sheets } : {}), style: style.meta.name, shape: S.shape, seconds: Number(len.toFixed(2)), frames,
    captions: captionsFile, ...(chaptersFile ? { chapters: chapters.lines, chaptersFile, ...(chapters.problem ? { chaptersProblem: chapters.problem } : {}) } : {}),
    scenes: P.scenes.map((s) => ({ type: s.type, start: Number(s.start.toFixed(2)), seconds: Number(s.len.toFixed(2)), say: s.say })),
    renderSeconds: Math.round((Date.now() - t0) / 1000),
  }, null, 2) + "\n");
}

main().catch((e) => fail(e?.stack || e?.message || String(e)));
