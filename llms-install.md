# Installing runsheet-mcp

`runsheet-mcp` is a stdio MCP server. It runs with `npx -y runsheet-mcp`, needs Node 20 or newer,
and has no dependencies to install.

## 1. Get an API key

The server needs one environment variable, `RUNSHEET_API_KEY`.

1. Ask the user to sign in at https://runsheet.buildifyapp.in and open **Settings**, then
   **API keys**.
2. Create a key. To upload videos, the **Upload from this machine** permission must be ticked. Other
   permissions (write, generate, image) enable the matching forwarded tools. New keys are read only
   unless more is ticked.
3. The key starts with `rsk_live_` and is shown once. Ask the user to paste it; do not guess one.

## 2. Add the server

### Claude Code

```sh
claude mcp add --env RUNSHEET_API_KEY=rsk_live_... --transport stdio runsheet -- npx -y runsheet-mcp
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "runsheet": {
      "command": "npx",
      "args": ["-y", "runsheet-mcp"],
      "env": { "RUNSHEET_API_KEY": "rsk_live_..." }
    }
  }
}
```

### Claude Desktop

Add the same `mcpServers` block to `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Then restart Claude Desktop.

### Cline and other clients

Use the same command (`npx`), arguments (`["-y", "runsheet-mcp"]`) and `env` block. On Windows, if
`npx` cannot be launched directly, use `"command": "cmd"` with
`"args": ["/c", "npx", "-y", "runsheet-mcp"]`.

## 3. Check it works

List the tools. `runsheet_list_local_videos` and `runsheet_upload_video` always appear. The hosted
Runsheet tools appear too when the key is valid. If only the two local tools show, the key is wrong
or revoked.

## Notes

- Uploads always go up private. A `publish_at` at least fifteen minutes in the future makes YouTube
  publish it at that time; without one it stays a private draft.
- Until Runsheet's YouTube compliance audit clears, uploads are capped at 25 a day per account and
  80 a day across Runsheet. A channel connected with its own Google client is exempt.
- The video file is streamed from this machine straight to YouTube and never reaches Runsheet's
  servers.
- `ffprobe` (part of ffmpeg) is optional and lets the server tell Shorts from long videos by their
  dimensions.
