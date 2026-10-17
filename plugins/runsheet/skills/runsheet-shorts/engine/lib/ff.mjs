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

/** ffmpeg's own report on a file (its stderr for `-i`), which names the length and every stream. */
function report(file) {
  return new Promise((ok) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-i", file], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", () => ok(err));
  });
}

/** A media file's length in seconds, read from ffmpeg's own report. */
export async function duration(file) {
  const m = (await report(file)).match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`could not read the length of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * A video's length and shape as it plays: a phone clip stored sideways with a rotation flag reports its size turned,
 * so the width and height are swapped back. `audio` is whether there is any sound track at all.
 */
export const probe = async (file) => {
  try { return parseReport(await report(file)); } catch { throw new Error(`could not read ${file} as a video`); }
};

/** The same, from the text of ffmpeg's report: pure, for the tests. */
export function parseReport(out) {
  const d = out.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = out.match(/Stream #\d+:\d+[^\n]*Video:[^\n]*?, (\d{2,5})x(\d{2,5})[^\n]*/);
  if (!d || !v) throw new Error("not a video");
  const fps = Number((v[0].match(/, ([\d.]+) fps/) || [])[1]) || null;
  const turned = /rotat\w* of -?90|rotate\s*:\s*-?(90|270)/.test(out);
  const [w, h] = turned ? [Number(v[2]), Number(v[1])] : [Number(v[1]), Number(v[2])];
  return { seconds: Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]), width: w, height: h, fps, audio: /Stream #\d+:\d+[^\n]*Audio:/.test(out) };
}
