// The voice: Microsoft Edge's neural voices through msedge-tts, free and with no key, one clip per
// line, with the time every word is spoken so the captions can light each one as it is said.
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { duration } from "./ff.mjs";
import { align } from "./align.mjs";

const TICKS = 1e7; // the service reports offsets in 100 ns units

/** Lines in, one clip each, with word timings matched to the words shown on screen. */
export async function speak(lines, { voice, rate, dir }) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const sub = join(dir, `line-${String(i + 1).padStart(2, "0")}`);
    mkdirSync(sub, { recursive: true });
    let r = null, lastErr = null;
    for (let attempt = 0; attempt < 3 && !r; attempt++) {
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
        r = await tts.toFile(sub, lines[i].say, rate ? { rate } : undefined);
        try { tts.close(); } catch { /* already closed */ }
      } catch (e) {
        lastErr = e;
        await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
      }
    }
    if (!r || !existsSync(r.audioFilePath)) throw new Error(`The voice did not answer for line ${i + 1}: ${lastErr?.message || lastErr || "no audio"}`);
    const spoken = r.metadataFilePath && existsSync(r.metadataFilePath)
      ? (JSON.parse(readFileSync(r.metadataFilePath, "utf8")).Metadata || [])
          .filter((m) => m.Type === "WordBoundary")
          .map((m) => ({ text: m.Data.text.Text, t0: m.Data.Offset / TICKS, t1: (m.Data.Offset + m.Data.Duration) / TICKS }))
      : [];
    const len = await duration(r.audioFilePath);
    out.push({ file: r.audioFilePath, duration: len, words: align(lines[i].show, spoken, len) });
  }
  return out;
}
