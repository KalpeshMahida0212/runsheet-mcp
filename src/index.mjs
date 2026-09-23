#!/usr/bin/env node
/*
  Runsheet's LOCAL MCP server. stdio transport.

  WHY A LOCAL SERVER EXISTS AT ALL, GIVEN THERE IS ALREADY A REMOTE ONE.

  One reason: uploading. MCP carries JSON-RPC messages and has no file channel, and a remote server
  has no access to the caller's disk, so "upload this video" is impossible over the hosted endpoint
  no matter how it is built. A process running on the creator's own machine has both. That is the
  entire justification, and everything else here exists to make that one capability usable.

  THE BYTES STILL NEVER TOUCH RUNSHEET. This asks Runsheet for a YouTube resumable upload session,
  then streams the file from local disk straight to Google. Runsheet sees the metadata and a session
  URL; it never sees a frame of video. That is exactly what the browser does, and it is why
  "0 bytes of your video stored by Runsheet, ever" stays literally true even with automation.

  EVERYTHING ELSE IS PROXIED, NOT REIMPLEMENTED. Channel reads, the text tools, the writing tools
  and the scheduling tools all forward to the hosted /api/mcp endpoint with the same key. There is
  one implementation of each tool and one place where quotas are counted, so a creator's daily
  allowance is one number whether they used the website, the hosted server or this.

  WHY NO SDK DEPENDENCY. stdio MCP is newline-delimited JSON-RPC on stdin and stdout. That is about
  sixty lines of transport, and this package's entire value is that `npx -y runsheet-mcp` works
  instantly with nothing to install. Adding a dependency tree to save sixty lines would trade the
  thing people actually want for tidiness.

  USAGE, in an MCP client's config:

    {
      "mcpServers": {
        "runsheet": {
          "command": "npx",
          "args": ["-y", "runsheet-mcp"],
          "env": { "RUNSHEET_API_KEY": "rsk_live_..." }
        }
      }
    }
*/

import { createReadStream, statSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const API_KEY = process.env.RUNSHEET_API_KEY ?? "";
const BASE = (process.env.RUNSHEET_URL ?? "https://runsheet.buildifyapp.in").replace(/\/$/, "");
const PROTOCOL_VERSION = "2025-06-18";

/*
  Anything written to stdout that is not a JSON-RPC message corrupts the stream and the client
  disconnects with no useful error. So every diagnostic goes to stderr, which clients either show or
  ignore, and nothing in this file may use console.log.
*/
const log = (...args) => process.stderr.write(`[runsheet-mcp] ${args.join(" ")}\n`);

// ---------------------------------------------------------------- local-only tools

const UPLOAD_TOOL = {
  name: "runsheet_upload_video",
  description:
    "Upload a video file from THIS machine to YouTube through Runsheet, and schedule it. The file is read from local disk and streamed straight to YouTube; it is never sent to Runsheet's servers. " +
    "The upload always goes up PRIVATE and can never be published immediately: either give it a publish_at at least fifteen minutes in the future, in which case YouTube publishes it itself at that time, or leave it out and it stays a private draft. " +
    "Short versus long is detected from the file's dimensions when ffprobe is available, so you usually do not need to pass `kind`. If a thumbnail image sits next to the video with the same name, or is named thumbnail.png, it is picked up automatically. " +
    "IMPORTANT: until Runsheet's YouTube compliance audit clears, uploads are capped at 25 a day per account and 80 a day across all of Runsheet, so a large batch stops partway through with a message saying when the allowance returns. A channel connected with its own Google client spends its own allowance instead.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute path to the video file on this machine." },
      title: { type: "string", description: "The YouTube title. Under 100 characters, no angle brackets." },
      description: { type: "string", description: "The YouTube description. Under 5000 characters." },
      tags: { type: "array", items: { type: "string" }, description: "Up to 60 tags." },
      publish_at: {
        type: "string",
        description:
          "ISO 8601 timestamp at least fifteen minutes from now, for example 2026-09-24T18:00:00Z. Omit to leave it as a private draft.",
      },
      kind: { type: "string", enum: ["short", "long"], description: "Overrides the detected format." },
      thumbnail_path: { type: "string", description: "Absolute path to a thumbnail image. Under 2MB." },
    },
    required: ["path", "title"],
  },
};

const LIST_FILES_TOOL = {
  name: "runsheet_list_local_videos",
  description:
    "List video files in a folder on THIS machine, with their size, duration and whether each is vertical or landscape. Use this before runsheet_upload_video to see what is there and to spot the matching thumbnail files. Reads nothing except file metadata.",
  inputSchema: {
    type: "object",
    properties: {
      folder: { type: "string", description: "Absolute path to a folder." },
      recursive: { type: "boolean", description: "Look in subfolders too. Default false." },
    },
    required: ["folder"],
  },
};

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

/*
  Probe a video for dimensions and duration.

  ffprobe is optional. It ships with ffmpeg, which anybody editing video already has, but a creator
  automating uploads of already-rendered files might not. So a missing ffprobe degrades to "unknown"
  and the caller passes `kind` explicitly, rather than the tool refusing to work at all.
*/
function probe(file) {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file,
      ],
      { encoding: "utf8", timeout: 15_000 },
    )
      .trim()
      .split(/\r?\n/);
    const width = Number(out[0]);
    const height = Number(out[1]);
    const duration = Number(out[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height, duration: Number.isFinite(duration) ? duration : null };
  } catch {
    return null;
  }
}

/**
 * Decide short or long the way the product does.
 *
 * Portrait OR under three minutes, the same rule Runsheet applies to videos it finds on a channel,
 * so a file uploaded here is classified identically to one adopted by a sync. Dimensions win over
 * duration when both are known, because a portrait four minute video is still a Short's shape.
 */
function detectKind(meta) {
  if (!meta) return null;
  /*
    DIMENSIONS DECIDE IT OUTRIGHT WHEN THEY ARE KNOWN, and duration is only a fallback, which is
    Runsheet's rule exactly: `portrait ?? seconds <= 180`.

    The first version checked portrait and then fell THROUGH to duration for landscape files, which
    classified a 24 second 1920x1080 wide cut as a Short. That is wrong in a way that matters: a
    landscape file marked as a Short would be filed, measured and compared against the wrong group
    for the rest of its life.
  */
  if (meta.width > 0 && meta.height > 0) return meta.height > meta.width ? "short" : "long";
  if (meta.duration !== null && meta.duration <= 180) return "short";
  return "long";
}

/** A thumbnail sitting beside the video: same basename, or a plain thumbnail.* in the folder. */
function findThumbnail(videoPath) {
  const dir = dirname(videoPath);
  const stem = basename(videoPath, extname(videoPath));
  const candidates = [
    ...IMAGE_EXTENSIONS.map((e) => join(dir, stem + e)),
    // A common export name for the landscape thumbnail.
    ...IMAGE_EXTENSIONS.map((e) => join(dir, "thumbnail_16x9" + e)),
    ...IMAGE_EXTENSIONS.map((e) => join(dir, "thumbnail" + e)),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

// ---------------------------------------------------------------- talking to Runsheet

async function api(path, init) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text.slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Forward a JSON-RPC message to the hosted endpoint, so hosted tools work unchanged.
 *
 * ALWAYS RETURNS A JSON-RPC SHAPED BODY. The hosted route answers a bad key with a plain
 * `{ error: "string" }` and a 401 before it ever reads the JSON-RPC message, and an unreachable
 * network throws. Both are normalised to `{ error: { message } }` here, so the callers can read
 * `error.message` without guessing, and a request always gets a reply instead of hanging the client.
 */
async function remote(method, params) {
  try {
    const { ok, status, body } = await api("/api/mcp", {
      method: "POST",
      headers: { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL_VERSION },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (body?.error && typeof body.error !== "object") return { error: { message: String(body.error) } };
    if (!ok && !body?.error) return { error: { message: `Runsheet answered ${status}.` } };
    return body;
  } catch (e) {
    return { error: { message: `Could not reach ${BASE}: ${e instanceof Error ? e.message : String(e)}` } };
  }
}

// ---------------------------------------------------------------- the upload itself

async function uploadVideo(args) {
  const path = resolve(String(args.path ?? ""));
  if (!path || !existsSync(path)) return textResult(`No file at ${path}`, true);

  const stat = statSync(path);
  if (!stat.isFile()) return textResult(`${path} is not a file.`, true);

  const meta = probe(path);
  const kind = args.kind ?? detectKind(meta) ?? "long";

  const thumbPath = args.thumbnail_path ? resolve(String(args.thumbnail_path)) : findThumbnail(path);
  let thumbnailBase64 = null;
  if (thumbPath && existsSync(thumbPath)) {
    const bytes = readFileSync(thumbPath);
    if (bytes.length > 2 * 1024 * 1024) {
      log(`thumbnail ${thumbPath} is over 2MB, skipping it`);
    } else {
      thumbnailBase64 = bytes.toString("base64");
    }
  }

  // 1. Ask Runsheet to open a YouTube session. This is the only part Runsheet is involved in.
  const opened = await api("/api/v1/upload/session", {
    method: "POST",
    body: JSON.stringify({
      title: String(args.title ?? ""),
      description: String(args.description ?? ""),
      tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
      kind,
      sizeBytes: stat.size,
      mimeType: "video/*",
      publishAt: args.publish_at ? String(args.publish_at) : null,
    }),
  });
  if (!opened.ok) return textResult(opened.body?.error ?? `Runsheet refused the upload (${opened.status}).`, true);

  const { id, uploadUrl, scheduledFor } = opened.body;

  /*
    2. Stream the bytes to Google. Not Runsheet.

    `duplex: "half"` is required by undici when the body is a stream, and omitting it fails with an
    error that does not mention streams at all.
  */
  log(`uploading ${basename(path)} (${(stat.size / 1024 / 1024).toFixed(1)}MB) to YouTube`);
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Length": String(stat.size), "Content-Type": "video/*" },
    body: createReadStream(path),
    duplex: "half",
  });
  const putText = await put.text();
  if (!put.ok) {
    return textResult(
      `YouTube rejected the upload (${put.status}). ${putText.slice(0, 300)}\nThe Runsheet row ${id} is left in "uploading" so it can be retried.`,
      true,
    );
  }
  const created = JSON.parse(putText);

  // 3. Tell Runsheet it landed, and hand over the thumbnail.
  const done = await api("/api/v1/upload/complete", {
    method: "POST",
    body: JSON.stringify({ videoId: id, ytVideoId: created.id, thumbnailBase64 }),
  });
  if (!done.ok) {
    return textResult(
      `Uploaded to YouTube as ${created.id}, but recording it in Runsheet failed: ${done.body?.error}. The video exists on YouTube.`,
      true,
    );
  }

  const lines = [
    `Uploaded ${basename(path)} as ${created.id}.`,
    scheduledFor
      ? `Private until ${scheduledFor}, when YouTube publishes it itself.`
      : "Private draft with no publish time. Give it one with runsheet_schedule_video, or publish it yourself in Studio.",
    `Detected as a ${kind}${meta ? ` (${meta.width}x${meta.height}${meta.duration ? `, ${Math.round(meta.duration)}s` : ""})` : ""}.`,
    thumbnailBase64 ? `Thumbnail set from ${basename(thumbPath)}.` : "No thumbnail found next to the file.",
    ...(done.body?.warnings ?? []),
  ];
  return textResult(lines.join("\n"), false);
}

function listLocalVideos(args) {
  const folder = resolve(String(args.folder ?? ""));
  if (!existsSync(folder)) return textResult(`No folder at ${folder}`, true);

  const found = [];
  const walk = (dir, depth) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (args.recursive && depth < 3) walk(full, depth + 1);
        continue;
      }
      if (!VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      const stat = statSync(full);
      const meta = probe(full);
      found.push({
        path: full,
        mb: (stat.size / 1024 / 1024).toFixed(1),
        kind: detectKind(meta) ?? "unknown",
        dims: meta ? `${meta.width}x${meta.height}` : "?",
        seconds: meta?.duration ? Math.round(meta.duration) : null,
        thumb: findThumbnail(full) ? "yes" : "no",
      });
    }
  };
  walk(folder, 0);

  if (!found.length) return textResult(`No video files in ${folder}.`, false);
  const rows = found.map(
    (f) =>
      `${f.kind.padEnd(7)} ${String(f.mb).padStart(7)}MB  ${f.dims.padEnd(10)} ${String(f.seconds ?? "?").padStart(4)}s  thumb:${f.thumb.padEnd(3)}  ${f.path}`,
  );
  return textResult([`${found.length} video file(s) in ${folder}:`, ...rows].join("\n"), false);
}

const textResult = (text, isError) => ({ content: [{ type: "text", text }], isError: Boolean(isError) });

// ---------------------------------------------------------------- stdio JSON-RPC

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id = null, method, params = {} } = msg;

  // A notification has no id and expects no response at all.
  if (id === null && typeof method === "string" && method.startsWith("notifications/")) return;

  if (method === "initialize") {
    return reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "runsheet-local", title: "Runsheet (local)", version: "1.0.1" },
      instructions:
        "Runsheet's local toolkit. runsheet_upload_video reads a file from this machine and streams it " +
        "straight to YouTube: the file is never sent to Runsheet. Uploads are always private and can " +
        "never be published immediately; give a publish time at least fifteen minutes out and YouTube " +
        "publishes it itself. Uploads are capped at 25 a day per account and 80 a day across all of " +
        "Runsheet until its YouTube compliance audit clears, so do not attempt large batches. Every " +
        "other tool is forwarded to Runsheet's hosted server.",
    });
  }

  if (method === "ping") return reply(id, {});

  if (method === "tools/list") {
    /*
      The hosted list plus the two local ones. Asking the hosted server rather than hardcoding means
      a tool added there appears here without this package being republished, which matters because
      npx caches and people do not upgrade.
    */
    const remoteList = await remote("tools/list", {});
    const hosted = remoteList?.result?.tools ?? [];
    if (remoteList?.error) log(`hosted tools unavailable, listing only the local ones: ${remoteList.error.message}`);
    return reply(id, { tools: [...hosted, LIST_FILES_TOOL, UPLOAD_TOOL] });
  }

  if (method === "tools/call") {
    const name = params.name;
    const args = params.arguments ?? {};
    try {
      if (name === UPLOAD_TOOL.name) return reply(id, await uploadVideo(args));
      if (name === LIST_FILES_TOOL.name) return reply(id, listLocalVideos(args));
      const out = await remote("tools/call", params);
      if (out?.error) return reply(id, textResult(out.error.message, true));
      return reply(id, out?.result ?? textResult("The hosted server returned nothing.", true));
    } catch (e) {
      // A thrown error is a tool failure, not a protocol failure, so it goes back as a result the
      // model can read rather than an error it can only give up on.
      return reply(id, textResult(`${name} failed: ${e instanceof Error ? e.message : String(e)}`, true));
    }
  }

  return fail(id, -32601, `Method not found: ${method}`);
}

// ---------------------------------------------------------------- main

if (!API_KEY) {
  log(
    "RUNSHEET_API_KEY is not set. Make a key at https://runsheet.buildifyapp.in/app/settings under API keys, " +
      "with the 'Upload from this machine' permission ticked if you want to upload.",
  );
  process.exit(1);
}

log(`ready, talking to ${BASE}`);

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  /*
    Messages are newline delimited and MUST NOT contain embedded newlines, per the stdio transport
    spec, so splitting on newline is safe. The trailing fragment is kept because a message can
    arrive split across two chunks.
  */
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      log(`ignoring unparseable line: ${line.slice(0, 120)}`);
      continue;
    }
    void handle(msg).catch((e) => log(`handler threw: ${e?.message ?? e}`));
  }
});

process.stdin.on("end", () => process.exit(0));
