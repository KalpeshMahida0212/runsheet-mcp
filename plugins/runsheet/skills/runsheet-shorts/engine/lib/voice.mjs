// The voice: Microsoft Edge's neural voices through msedge-tts, free and with no key, one clip per
// line, with the time every word is spoken so the captions can light each one as it is said.
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { duration } from "./ff.mjs";

const TICKS = 1e7; // the service reports offsets in 100 ns units
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

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

/*
  The words on screen keep their punctuation and the speech service's do not, so they are matched in
  order on letters and digits. A word the service split or spelled differently (a number, a hyphenated
  word) takes its time from its neighbours, so every word on screen has a moment to light up.
*/
export function align(show, spoken, len) {
  // *a word* or *a few words* in the script is drawn in the accent colour for the whole line
  let inEm = false;
  const tokens = show.split(/\s+/).filter(Boolean).map((raw) => {
    const starts = raw.startsWith("*");
    const ends = /\*[.,!?;:'")]*$/.test(raw) && (raw.length > 1 || !starts);
    const emph = inEm || starts;
    if (starts && !ends) inEm = true;
    if (ends) inEm = false;
    return { text: raw.replace(/\*/g, ""), emph };
  });
  let k = 0;
  for (const tk of tokens) {
    const n = norm(tk.text);
    for (let j = k; j < Math.min(spoken.length, k + 4); j++) {
      if (n && (norm(spoken[j].text) === n || n.startsWith(norm(spoken[j].text)) || norm(spoken[j].text).startsWith(n))) {
        tk.t0 = spoken[j].t0; tk.t1 = spoken[j].t1; k = j + 1; break;
      }
    }
  }
  // fill the unmatched ones between their neighbours, or across the clip when nothing matched
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].t0 != null) continue;
    const prev = [...tokens.slice(0, i)].reverse().find((t) => t.t1 != null);
    const next = tokens.slice(i + 1).find((t) => t.t0 != null);
    const a = prev ? prev.t1 : 0.05, b = next ? next.t0 : Math.max(a + 0.2, len - 0.1);
    const gap = tokens.slice(i).findIndex((t) => t.t0 != null);
    const count = gap === -1 ? tokens.length - i : gap;
    const step = (b - a) / Math.max(1, count);
    tokens[i].t0 = a; tokens[i].t1 = a + step;
  }
  return tokens;
}
