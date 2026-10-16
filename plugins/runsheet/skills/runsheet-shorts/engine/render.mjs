#!/usr/bin/env node
/*
  Renders one YouTube Short from a script, on the creator's own computer.

    node render.mjs short.json

  short.json:
    {
      "out": "C:/Users/me/Videos/shorts/2026-10-20 one-sentence-month",   folder for everything it writes
      "title": "Plan a month of YouTube in one sentence",                   the video's title (the cover uses the hook)
      "brand": { "name": "Runsheet", "handle": "@runsheet" },              the pill at the top and the end card
      "theme": "dark",                                                      dark or light
      "accent": "#ff4d2e",                                                  the highlight colour
      "voice": "en-US-EmmaMultilingualNeural",                              any Edge neural voice
      "rate": "+4%",                                                        optional speaking rate
      "lines": [                                                            3 to 14 lines, the first is the hook
        "Your channel posts when you *remember*.",
        { "say": "Twenty videos, one week.", "show": "20 videos, *one week*.", "image": "C:/path/screen.png" }
      ],
      "end": { "title": "Runsheet", "sub": "Free plan, no card" },          the last card
      "background": { "type": "plain" },                                    plain, image (path) or video (path, muted)
      "music": { "path": "C:/path/bed.mp3", "volume": 0.12 }                optional, under the voice
    }

  Writes short.mp4 (1080x1920, 30 fps, H.264 and AAC, loudness about -14 LUFS), cover.png (a frame at
  the end of the hook, for the thumbnail), sheet.png (eight frames tiled, to check by eye) and
  timeline.json, then prints a JSON summary on stdout.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { ff, duration } from "./lib/ff.mjs";
import { findBrowser } from "./lib/browser.mjs";
import { speak } from "./lib/voice.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30, W = 1080, H = 1920;
const LEAD = 0.35, GAP = 0.22, END = 1.9;

const THEMES = {
  dark: { bg: "#0b0b10", fg: "#f6f5f2", muted: "#b9b8c3", pill: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.14)" },
  light: { bg: "#f6f5f2", fg: "#111114", muted: "#55545f", pill: "rgba(0,0,0,.05)", line: "rgba(0,0,0,.12)" },
};

function fail(msg) { process.stderr.write(`render: ${msg}\n`); process.exit(1); }

function readSpec(path) {
  const base = dirname(resolve(path));
  const s = JSON.parse(readFileSync(path, "utf8"));
  const abs = (p) => (p ? (isAbsolute(p) ? p : resolve(base, p)) : p);
  if (!Array.isArray(s.lines) || s.lines.length < 2 || s.lines.length > 14) fail("lines must be 2 to 14 entries; the first is the hook.");
  const lines = s.lines.map((l, i) => {
    const o = typeof l === "string" ? { show: l } : { ...l };
    o.show = String(o.show ?? o.say ?? "").trim();
    o.say = String(o.say ?? o.show).replace(/\*/g, "").trim();
    if (!o.show || !o.say) fail(`line ${i + 1} is empty.`);
    if (o.show.length > 160) fail(`line ${i + 1} is ${o.show.length} characters; keep each line under 160 so it fits on screen.`);
    if (o.image) { o.image = abs(o.image); if (!existsSync(o.image)) fail(`line ${i + 1}: image not found: ${o.image}`); }
    return o;
  });
  const bg = s.background && s.background.type !== "plain" ? { type: s.background.type, path: abs(s.background.path) } : { type: "plain" };
  if (bg.type !== "plain" && !existsSync(bg.path || "")) fail(`background not found: ${bg.path}`);
  const music = s.music && s.music.path ? { path: abs(s.music.path), volume: Number(s.music.volume ?? 0.12) } : null;
  if (music && !existsSync(music.path)) fail(`music not found: ${music.path}`);
  const out = abs(s.out || join(base, "short-out"));
  return {
    out, lines, bg, music,
    title: String(s.title || lines[0].say),
    brand: { name: String(s.brand?.name || "My channel"), handle: s.brand?.handle ? String(s.brand.handle) : "" },
    theme: THEMES[s.theme === "light" ? "light" : "dark"],
    accent: /^#[0-9a-f]{6}$/i.test(s.accent || "") ? s.accent : "#ff4d2e",
    voice: String(s.voice || "en-US-EmmaMultilingualNeural"),
    rate: s.rate ? String(s.rate) : null,
    end: { title: String(s.end?.title || s.brand?.name || ""), sub: s.end?.sub ? String(s.end.sub) : s.brand?.handle ? `Follow ${s.brand.handle}` : "" },
  };
}

/** A second colour for the soft glow behind the words: the accent with its hue turned 150 degrees, a little darker. */
function accent2(hex) {
  const n = parseInt(hex.slice(1), 16);
  let [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  }
  h = (h * 60 + 150 + 360) % 360;
  return `hsl(${Math.round(h)} ${Math.round(Math.min(1, s) * 80)}% ${Math.round(Math.min(0.5, l) * 90)}%)`;
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) fail("usage: node render.mjs short.json");
  const S = readSpec(specPath);
  mkdirSync(S.out, { recursive: true });
  const work = join(S.out, "work");
  mkdirSync(work, { recursive: true });
  const t0 = Date.now();

  // 1. the voice, one clip per line, with word timings
  const clips = await speak(S.lines, { voice: S.voice, rate: S.rate, dir: work });

  // 2. the timeline, every time in seconds from the start
  let t = LEAD;
  const lines = S.lines.map((l, i) => {
    const c = clips[i];
    const line = {
      start: t, end: t + c.duration, hook: i === 0,
      image: l.image ? pathToFileURL(l.image).href : null,
      words: c.words.map((w) => ({ text: w.text, emph: w.emph, t0: t + w.t0, t1: t + w.t1 })),
    };
    t = line.end + GAP;
    return line;
  });
  const endStart = t + 0.05;
  const total = endStart + END;
  const timeline = {
    w: W, h: H, fps: FPS, duration: total,
    theme: { ...S.theme, accent: S.accent, accent2: accent2(S.accent) },
    brand: S.brand,
    background: S.bg.type === "plain" ? { type: "plain" } : { type: S.bg.type, src: pathToFileURL(S.bg.path).href },
    lines,
    end: { start: endStart, title: S.end.title, sub: S.end.sub },
  };
  writeFileSync(join(S.out, "timeline.json"), JSON.stringify(timeline, null, 1));

  // 3. the sound: every line at its start, then loudness to about -14 LUFS; music under it if given
  const voiceWav = join(work, "voice.wav");
  const inputs = clips.flatMap((c) => ["-i", c.file]);
  const delays = clips.map((c, i) => `[${i}:a]adelay=${Math.round(lines[i].start * 1000)}:all=1[a${i}]`).join(";");
  const mix = `${delays};${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11[v]`;
  await ff([...inputs, "-filter_complex", mix, "-map", "[v]", "-ar", "48000", "-ac", "2", voiceWav]);
  let soundtrack = voiceWav;
  if (S.music) {
    soundtrack = join(work, "mix.wav");
    const fadeAt = Math.max(0, total - 1.2).toFixed(2);
    await ff(["-i", voiceWav, "-stream_loop", "-1", "-i", S.music.path, "-filter_complex",
      `[1:a]volume=${S.music.volume},atrim=0:${total.toFixed(3)},afade=t=out:st=${fadeAt}:d=1.2[m];[0:a][m]amix=inputs=2:normalize=0:duration=first[o]`,
      "-map", "[o]", "-ar", "48000", "-ac", "2", soundtrack]);
  }

  // 4. the frames: the scene in the creator's own browser, one picture per frame, straight into ffmpeg
  const browser = await chromium.launch({ executablePath: findBrowser(), args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, "template", "short.html")).href);
  await page.evaluate((tl) => window.load(tl), timeline);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });

  const video = join(S.out, "short.mp4");
  const frames = Math.ceil(total * FPS);
  let written = 0;
  await ff([
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-i", soundtrack,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", video,
  ], {
    input: async (stdin) => {
      for (let f = 0; f < frames; f++) {
        await page.evaluate((x) => window.seek(x), f / FPS);
        const jpg = await page.screenshot({ type: "jpeg", quality: 92 });
        if (!stdin.write(jpg)) await new Promise((ok) => stdin.once("drain", ok));
        written++;
        if (f % 150 === 0) process.stderr.write(`render: frame ${f} of ${frames}\n`);
      }
      stdin.end();
    },
  });

  // 5. the cover: the hook, fully on screen
  const hook = lines[0];
  await page.evaluate((x) => window.seek(x), Math.min(hook.end - 0.05, hook.words[hook.words.length - 1].t1 + 0.25));
  const cover = join(S.out, "cover.png");
  await page.screenshot({ path: cover, type: "png" });
  await browser.close();

  // 6. eight frames tiled, so the result can be checked by eye before it goes anywhere
  const sheet = join(S.out, "sheet.png");
  await ff(["-i", video, "-vf", `fps=${(8 / total).toFixed(5)},scale=270:480,tile=4x2:padding=6:color=0x222222`, "-frames:v", "1", sheet]);

  const len = await duration(video);
  process.stdout.write(JSON.stringify({
    ok: true, video, cover, sheet, seconds: Number(len.toFixed(2)), frames: written,
    lines: lines.map((l, i) => ({ text: S.lines[i].show, start: Number(l.start.toFixed(2)), end: Number(l.end.toFixed(2)) })),
    renderSeconds: Math.round((Date.now() - t0) / 1000),
  }, null, 2) + "\n");
}

main().catch((e) => fail(e?.stack || e?.message || String(e)));
