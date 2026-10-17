/*
  EVERY VIDEO HAS A PASS, from Runsheet's runsheet_start_video: one video on a free account, the plan's monthly
  number on a paid one. A pass is good for two hours and six renders while the video is fixed. It is also what
  fetches a paid style, which lives on Runsheet and not in this repository. No pass, no video.
*/
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

export const RUNSHEET = process.env.RUNSHEET_URL || "https://runsheet.buildifyapp.in";

// Runsheet's own developers render without a pass while they build styles; only the hash of their key is here.
export const DEV = createHash("sha256").update(process.env.RUNSHEET_SHORTS_DEV || "").digest("hex") === "e0e1c7bbf9fe64a1bb3501bfbc2d92b4581b4a92e3cb33e7b97b06ad49156170";

/*
  node:http with no keep-alive rather than fetch: on Windows, Node 24 aborts with a libuv assertion (exit 127) when
  the process exits right after a fetch, which is exactly what a refused pass does.
*/
function call(method, path, body) {
  const url = new URL(path, RUNSHEET);
  return new Promise((ok, no) => {
    const req = (url.protocol === "http:" ? httpRequest : httpsRequest)(url, {
      method, agent: false, headers: body ? { "content-type": "application/json" } : {},
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => {
        let json = {};
        try { json = JSON.parse(text); } catch { /* not JSON: the status says enough */ }
        ok({ status: res.statusCode, body: json });
      });
    });
    req.on("error", no);
    req.setTimeout(60000, () => req.destroy(new Error("Runsheet did not answer within a minute")));
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

/** One render on the pass. Resolves Runsheet's answer (a paid style's files come with it); throws with its reason. */
export async function usePass(pass, style) {
  if (!pass) throw new Error(`this video has no pass. Ask Runsheet for one with runsheet_start_video (style "${style}") and put it in the spec as "pass".`);
  let r;
  try {
    r = await call("GET", `/api/v1/shorts/pass?id=${encodeURIComponent(pass)}&style=${encodeURIComponent(style)}`);
  } catch (e) {
    throw new Error(`could not reach Runsheet to check the pass: ${e.message}`);
  }
  if (r.status !== 200 || !r.body.ok) throw new Error(r.body.error || `Runsheet refused the pass (HTTP ${r.status}).`);
  return r.body;
}

/** The finished video counts against the plan once; later renders on the same pass (fixes) do not. */
export async function markMade(pass, seconds) {
  if (!pass) return;
  try {
    await call("POST", "/api/v1/shorts/pass", { id: pass, seconds });
  } catch {
    // the video is made either way; the pass simply stays open until it expires
  }
}
