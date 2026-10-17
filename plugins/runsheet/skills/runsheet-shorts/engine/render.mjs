#!/usr/bin/env node
/*
  Renders one YouTube Short as motion graphics, on the creator's own computer.

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
      "pass": "...",                                                 this video's pass, from runsheet_start_short
      "scenes": [
        { "type": "hook", "say": "Sharing one login with your team? Three rules.", "text": "One login, three *rules*", "kicker": "team passwords" },
        { "type": "list", "say": "...", "text": "The *rules*", "items": ["Never paste it in chat", "..."] },
        { "type": "end", "say": "Coauth. Free on the Chrome Web Store.", "sub": "chrome web store", "stamp": "Free for 3" }
      ]
    }

  Every scene's length is its line's: the voice is spoken first, every word timed, and each thing on screen arrives
  on the word that names it.

  Every video needs a pass (lib/pass.mjs). Writes short.mp4 (1080x1920, 30 fps, H.264 and AAC, -14 LUFS), cover.png,
  sheet.png (every scene once it has settled, tiled, to check by eye) and timeline.json, then prints a JSON summary.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { cpus } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { ff, duration } from "./lib/ff.mjs";
import { findBrowser } from "./lib/browser.mjs";
import { speak } from "./lib/voice.mjs";
import { readScenes, themeOf, plan } from "./lib/scenes.mjs";
import { mixSound } from "./lib/sound.mjs";
import { DEV, usePass, markMade } from "./lib/pass.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30, W = 1080, H = 1920;

function fail(msg) { process.stderr.write(`render: ${msg}\n`); process.exit(1); }
const say = (msg) => process.stderr.write(`render: ${msg}\n`);

function readSpec(path) {
  const base = dirname(resolve(path));
  const s = JSON.parse(readFileSync(path, "utf8"));
  const abs = (p) => (p ? (isAbsolute(p) ? p : resolve(base, p)) : p);
  const { scenes, errors } = readScenes(s, abs);
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
function writePage(work, style) {
  const url = (f) => pathToFileURL(f).href;
  const face = (f, dir) => `@font-face { font-family: "${f.family}"; src: url("${url(join(dir, f.file))}") format("woff2"); font-weight: ${f.weight}; font-style: ${f.style || "normal"}; }`;
  const page = `<!doctype html><html><head><meta charset="utf-8" /><style>
${CORE_FONTS.map((f) => face(f, join(HERE, "fonts"))).join("\n")}
${(style.meta.fonts ?? []).map((f) => face(f, style.fontDir)).join("\n")}
html, body { margin: 0; padding: 0; width: 1080px; height: 1920px; overflow: hidden; background: #f8f6f3; }
body { font-family: "Inter Tight", "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
#stage { position: absolute; inset: 0; overflow: hidden; }
#cam { position: absolute; inset: 0; transform-origin: 540px 960px; }
.scene { position: absolute; inset: 0; overflow: hidden; display: none; isolation: isolate; }
#caps { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; pointer-events: none; }
</style></head><body>
<div id="stage"><div id="cam"></div><div id="caps"></div></div>
<script src="${url(join(HERE, "template", "icons.js"))}"></script>
<script src="${url(join(HERE, "template", "core.js"))}"></script>
<script src="${url(style.js)}"></script>
</body></html>`;
  const file = join(work, "page.html");
  writeFileSync(file, page);
  return pathToFileURL(file).href;
}

async function openPage(browser, timeline, pageUrl) {
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
  const framesDir = join(work, "frames");
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  // 0. the pass and the style, before anything is spent on this video
  const style = await styleFor(S, work);
  const pageUrl = writePage(work, style);

  // 1. the voice: one clip a scene, every word timed
  const spoken = S.scenes.map((sc, i) => (sc.say ? i : -1)).filter((i) => i >= 0);
  const said = await speak(spoken.map((i) => ({ show: S.scenes[i].say, say: S.scenes[i].say })), { voice: S.voice, rate: S.rate, dir: work });
  const clips = S.scenes.map(() => null);
  spoken.forEach((i, k) => { clips[i] = said[k]; });

  // 2. the plan: every scene's start and length, every cue, the captions, the camera's hits
  const P = plan(S.scenes, clips, { theme: S.theme });
  const url = (p) => (p ? pathToFileURL(p).href : null);
  const timeline = {
    w: W, h: H, fps: FPS, duration: P.total,
    theme: themeOf(S.accent),
    brand: { name: S.brand.name, handle: S.brand.handle, logo: url(S.brand.logo) },
    scenes: P.scenes.map((s) => (s.type === "image" ? { ...s, src: url(s.src) } : s)),
    captions: P.captions, hits: P.hits,
  };
  writeFileSync(join(S.out, "timeline.json"), JSON.stringify(timeline, null, 1));

  // 3. the layout, checked before a single frame is drawn
  const browser = await chromium.launch({ executablePath: findBrowser(), args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"] });
  const first = await openPage(browser, timeline, pageUrl);
  const problems = await first.evaluate(() => window.problems);
  if (problems.length) { await browser.close(); fail(problems.join("\n         ")); }

  // 4. the sound: the voice, the score and the hits, at -14 LUFS
  say("mixing the sound");
  const mix = join(work, "mix.wav");
  mixSound({ plan: P, voices: P.scenes.filter((s, i) => clips[i]).map((s) => ({ file: clips[s.no - 1].file, at: s.start + s.voiceAt })), music: S.music, out: mix, work, profile: style.meta.sound ?? {} });

  // 5. the frames, on a few tabs at once
  const frames = Math.ceil(P.total * FPS);
  const tabs = Math.max(1, Math.min(4, cpus().length - 2));
  const pages = [first];
  for (let k = 1; k < tabs; k++) pages.push(await openPage(browser, timeline, pageUrl));
  let done = 0;
  await Promise.all(pages.map(async (page, k) => {
    const a = Math.floor((k * frames) / tabs), b = Math.floor(((k + 1) * frames) / tabs);
    for (let f = a; f < b; f++) {
      await page.evaluate((x) => window.seek(x), f / FPS);
      await page.screenshot({ path: join(framesDir, `f-${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
      if (++done % 150 === 0) say(`frame ${done} of ${frames}`);
    }
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
    await first.screenshot({ path: join(work, `sheet-${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 90 });
  }
  await browser.close();
  const sheet = join(S.out, "sheet.png");
  const n = P.scenes.length, cols = n <= 4 ? n : Math.ceil(n / 2);
  await ff(["-i", join(work, "sheet-%02d.jpg"), "-vf", `scale=270:480,tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=0x222222`, "-frames:v", "1", sheet]);

  // 7. the video: the frames and the mix, BT.709 in TV range like every upload YouTube expects
  const video = join(S.out, "short.mp4");
  say("encoding");
  await ff([
    "-framerate", String(FPS), "-i", join(framesDir, "f-%05d.jpg"), "-i", mix,
    "-vf", "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS), "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", video,
  ]);
  rmSync(framesDir, { recursive: true, force: true });
  rmSync(join(work, "style"), { recursive: true, force: true });

  const len = await duration(video);
  await markMade(S.pass, Number(len.toFixed(2)));
  process.stdout.write(JSON.stringify({
    ok: true, video, cover, sheet, style: style.meta.name, seconds: Number(len.toFixed(2)), frames,
    scenes: P.scenes.map((s) => ({ type: s.type, start: Number(s.start.toFixed(2)), seconds: Number(s.len.toFixed(2)), say: s.say })),
    renderSeconds: Math.round((Date.now() - t0) / 1000),
  }, null, 2) + "\n");
}

main().catch((e) => fail(e?.stack || e?.message || String(e)));
