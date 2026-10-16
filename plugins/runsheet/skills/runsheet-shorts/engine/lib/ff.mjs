// ffmpeg, from the ffmpeg-static package (a pinned build downloaded once at npm install), or FFMPEG_PATH.
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

export const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic;

/** Runs ffmpeg and resolves with its stderr; rejects with the last lines of it when it fails. */
export function ff(args, { input } = {}) {
  return new Promise((ok, fail) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-y", ...args], { stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 200_000) err = err.slice(-100_000); });
    p.on("error", fail);
    p.on("close", (code) => (code === 0 ? ok(err) : fail(new Error(`ffmpeg failed (${code}): ${err.split("\n").slice(-8).join("\n")}`))));
    if (input) input(p.stdin);
  });
}

/** A media file's length in seconds, read from ffmpeg's own report. */
export async function duration(file) {
  const out = await new Promise((ok) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-i", file], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", () => ok(err));
  });
  const m = out.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`could not read the length of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
