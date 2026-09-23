# runsheet-mcp

The local MCP server for [Runsheet](https://runsheet.buildifyapp.in), a YouTube scheduling app.
It connects Claude, Cursor or any MCP client to your YouTube channel, and uploads videos from your
own machine straight to YouTube.

```sh
npx -y runsheet-mcp
```

Published on npm as [`runsheet-mcp`](https://www.npmjs.com/package/runsheet-mcp). No install step,
no dependencies, Node 20 or newer.

## What it does

- **Uploads a video file from your disk to YouTube and schedules it.** The file is streamed from
  your machine straight to Google. It never touches Runsheet's servers.
- **Lists the video files in a folder**, with size, duration, orientation and whether a thumbnail
  sits next to each one, so the model can see what there is to upload.
- **Forwards every other Runsheet tool** to the hosted server with the same key: reading your
  channel and running order, writing titles, descriptions, tags and chapters, thumbnails, and
  scheduling.

### Why a local server as well as the hosted one

Runsheet also has a hosted MCP server at `https://runsheet.buildifyapp.in/api/mcp`. For reading
your channel, writing copy and scheduling, that is the simpler option: nothing to run on your
machine. Setup is at https://runsheet.buildifyapp.in/mcp.

This package exists for the one thing a hosted server cannot do. MCP carries JSON-RPC messages and
has no file channel, and a remote server cannot read your disk, so uploading a video is impossible
over a hosted endpoint. A process running on your own machine can do both.

### Your video never touches Runsheet's servers

To upload, this server asks Runsheet to open a YouTube resumable upload session, then streams the
file from your disk directly to Google. Runsheet sees the title, description, tags and a session
URL. It never receives a byte of the video. That is the same path the upload in Runsheet's website
takes.

## Setup

### 1. Make an API key

Sign in at https://runsheet.buildifyapp.in, open **Settings**, then **API keys**, and create a key.

- To upload, tick the **Upload from this machine** permission. Without it, uploads are refused.
- Tick any other permissions you want the forwarded tools to have. New keys are read only unless
  you tick more.
- The key starts with `rsk_live_` and is shown once. Permissions are fixed when a key is made, so a
  leaked read-only key can never gain write access. To change permissions, make a new key.

### 2. Add the server to your client

The key goes in the `RUNSHEET_API_KEY` environment variable.

**Claude Code**

```sh
claude mcp add runsheet --env RUNSHEET_API_KEY=rsk_live_your_key_here -- npx -y runsheet-mcp
```

**Cursor**: add this to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project).

**Claude Desktop**: add this to `claude_desktop_config.json`, found through Settings, Developer,
Edit Config. It lives at `~/Library/Application Support/Claude/` on macOS and `%APPDATA%\Claude\` on
Windows. Restart Claude Desktop afterwards.

```json
{
  "mcpServers": {
    "runsheet": {
      "command": "npx",
      "args": ["-y", "runsheet-mcp"],
      "env": { "RUNSHEET_API_KEY": "rsk_live_your_key_here" }
    }
  }
}
```

Any other MCP client that can launch a stdio server takes the same command, arguments and
environment variable.

The tool list is fetched from Runsheet when the server starts, so a tool added to Runsheet appears
here without a new version of this package.

### Requirements

- Node 20 or newer.
- `ffprobe` is optional. It ships with ffmpeg. With it, Short versus long video is detected from
  the file's dimensions. Without it, pass `kind` yourself.

## Tools

Local, only in this package:

| Tool | What it does |
|---|---|
| `runsheet_list_local_videos` | Lists video files in a folder with size, duration, orientation and whether a thumbnail sits next to each |
| `runsheet_upload_video` | Streams a file from your disk to YouTube, private, with an optional publish time and thumbnail |

A thumbnail is picked up automatically if an image sits next to the video with the same name, or is
named `thumbnail` or `thumbnail_16x9` (`.png`, `.jpg`, `.jpeg` or `.webp`, under 2MB).

Forwarded to the hosted server, subject to your key's permissions:

- Reading your channel, running order, library and playlists
- Character counting, line breaks and bold text
- Titles, hooks, descriptions, channel descriptions, tags and chapters
- Typeset thumbnails, and generated thumbnail artwork with its own permission
- Scheduling, retitling, retagging, playlist filing, and saving ideas to the Ideas list

## Two things it will not do

**It cannot publish anything immediately.** An upload always goes up private. Either you give it a
publish time at least fifteen minutes away and YouTube publishes it itself at that moment, or it
stays a private draft. This is enforced on Runsheet's server, not by a prompt, because a model that
publishes the wrong file to a real audience cannot take it back.

**It cannot delete anything.** There is no tool for it.

## Upload limits

Until Runsheet's YouTube API compliance audit clears, uploads are capped at:

- **25 a day per Runsheet account**, and
- **80 a day across all of Runsheet**.

A large batch uploads up to the limit and then stops, with a message saying when the allowance
returns. YouTube's quota resets at midnight Pacific time.

A channel connected with its own Google client, under Advanced on Runsheet's connect screen, spends
its own YouTube allowance and is exempt from both limits.

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `RUNSHEET_API_KEY` | yes | none |
| `RUNSHEET_URL` | no | `https://runsheet.buildifyapp.in` |

`RUNSHEET_URL` exists for development against a local copy of Runsheet. You will not need it. Your
key is sent to whatever address it names, so never point it at a server you do not trust.

## Troubleshooting

**"RUNSHEET_API_KEY is not set"**: the key is not reaching the process. Most clients need it under
`env` in the server config rather than in your shell.

**"This API key does not have the upload permission"**: make a new key with **Upload from this
machine** ticked. Existing keys cannot be upgraded.

**"That API key is not valid, or it has been revoked"**: the key was mistyped or deleted. Make a new
one under Settings, API keys.

**The client shows no tools**: check your client's MCP logs. This server writes its diagnostics to
stderr and never to stdout, because anything on stdout that is not a JSON-RPC message corrupts the
stream.

**`npx` is not found on Windows**: some clients cannot launch `npx` directly. Use
`"command": "cmd"` and `"args": ["/c", "npx", "-y", "runsheet-mcp"]`.

## Links

- Runsheet: https://runsheet.buildifyapp.in
- MCP setup guide: https://runsheet.buildifyapp.in/mcp
- Issues: https://github.com/KalpeshMahida0212/runsheet-mcp/issues

## License

MIT. See [LICENSE](LICENSE).
