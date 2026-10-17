#!/usr/bin/env node
/*
  What one job needs on this computer, and only that. Run it before the first video of a kind; it installs nothing
  itself and needs nothing installed to run.

    node preflight.mjs shorts            making a Short from a script: Node, Chrome or Edge, and the engine
                                         (ffmpeg, the browser driver and the voice, about 90 MB)
    node preflight.mjs long              making a long video from a script: the same as a Short
    node preflight.mjs clips             cutting Shorts from a long video: the same, plus the speech part
    node preflight.mjs watch <video>     watching a finished video to write its copy: the engine, plus the speech
                                         part only when the video has a sound track (a silent or music-only file
                                         can skip it with look --no-speech)

  The speech part is the big one (about 470 MB, and the model it downloads on its first listen, about 290 MB), so
  it is asked for only by the jobs that hear speech. Prints what is ready and, for anything missing, the one command
  that installs it, its size and why it is needed. Exits 0 when ready, 2 when there is something to install, 1 when
  the creator has to fix something by hand (Node or the browser).
*/
import { existsSync, statfsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findBrowser } from "./lib/browser.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STT = join(HERE, "stt");
const [job, video] = process.argv.slice(2);
if (!["shorts", "long", "clips", "watch"].includes(job)) {
  process.stderr.write("usage: node preflight.mjs shorts | long | clips | watch <video>\n");
  process.exit(1);
}

const ready = [], install = [], fix = [];
const has = (dir, pkg) => existsSync(join(dir, "node_modules", ...pkg.split("/"), "package.json"));

// Node 20 or newer: every script here is a modern ES module
const node = Number(process.versions.node.split(".")[0]);
if (node >= 20) ready.push(`Node ${process.versions.node}`);
else fix.push(`Node ${process.versions.node} is too old. Install Node 20 or newer from https://nodejs.org, then run this again.`);

// the engine: ffmpeg encodes and reads video, the browser driver draws frames, the voice is for scripted Shorts
const voiced = job === "shorts" || job === "long";
const base = ["ffmpeg-static", "playwright-core", ...(voiced ? ["msedge-tts"] : [])];
const missing = base.filter((p) => !has(HERE, p));
let ffmpeg = null;
if (!missing.includes("ffmpeg-static")) {
  ffmpeg = (await import(pathToFileURL(join(HERE, "node_modules", "ffmpeg-static", "index.js")).href)).default;
  // the package installs, then downloads its program; a blocked download leaves the package without it
  if (!ffmpeg || !existsSync(ffmpeg)) missing.push("ffmpeg-static (its program did not download)");
}
if (!missing.length) ready.push("the engine (ffmpeg, the browser driver" + (voiced ? ", the voice" : "") + ")");
else install.push({ what: "the engine", why: `missing ${missing.join(", ")}`, command: `npm install --prefix "${HERE}"`, size: "about 90 MB, once" });

// the creator's own Chrome or Edge draws every frame, so no browser is downloaded
try { ready.push(`a browser to draw with (${findBrowser()})`); }
catch (e) { fix.push(`${e.message} (needed to draw the frames${job === "watch" ? " of a thumbnail" : ""}).`); }

// the speech part, only for jobs that hear speech
let speech = job === "clips";
if (job === "watch") {
  if (!video || !existsSync(video)) fix.push(`no video at ${video ?? "(none given)"}: usage node preflight.mjs watch <video>`);
  else if (!ffmpeg) install.push({ what: "then run this check again", why: "to see whether this video needs the speech part, the engine has to read it first", command: `node "${join(HERE, "preflight.mjs")}" watch "${resolve(video)}"`, size: "" });
  else {
    const { probe } = await import(pathToFileURL(join(HERE, "lib", "ff.mjs")).href);
    const info = await probe(resolve(video)).catch(() => null);
    if (!info) fix.push(`could not read ${video} as a video.`);
    else if (!info.audio) ready.push("no speech part needed: this video has no sound track");
    else speech = true;
  }
}
if (speech) {
  if (has(STT, "@huggingface/transformers")) ready.push(`the speech part (Whisper)${existsSync(join(STT, "models")) ? "" : ", whose model downloads on its first listen, about 290 MB"}`);
  else install.push({ what: "the speech part (Whisper, on this computer)", why: job === "clips" ? "to hear every word of the long video" : "to hear what is said in this video", command: `npm install --prefix "${STT}"`, size: "about 470 MB once, plus the model on its first listen, about 290 MB" });
}

// room on the disk for what is still to come
const need = install.reduce((mb, i) => mb + (i.command.includes(STT) ? 800 : i.what === "the engine" ? 120 : 0), 0);
try {
  const fs = statfsSync(HERE);
  const free = Math.round((Number(fs.bavail) * Number(fs.bsize)) / 1048576);
  if (need && free < need + 500) fix.push(`only ${free} MB free where the engine lives; installing needs about ${need} MB and room to work.`);
} catch { /* statfs is missing on very old Node; the install will say so itself */ }

const lines = [`Ready: ${ready.join("; ") || "nothing yet"}.`];
if (fix.length) lines.push("", "Fix first, by hand:", ...fix.map((f) => `  - ${f}`));
if (install.length) lines.push("", "Install, in this order, then run this check again:", ...install.map((i, n) => `  ${n + 1}. ${i.what}${i.size ? ` (${i.size})` : ""}, ${i.why}:\n     ${i.command}`));
if (!fix.length && !install.length) lines.push("Everything this job needs is here.");
process.stdout.write(lines.join("\n") + "\n");
process.exit(fix.length ? 1 : install.length ? 2 : 0);
