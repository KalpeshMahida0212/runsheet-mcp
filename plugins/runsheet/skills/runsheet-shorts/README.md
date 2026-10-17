# runsheet-shorts

Claude makes YouTube Shorts for your channel and schedules them with Runsheet. It reads your channel,
writes each script, renders the Short on your computer (a voice, captions lit word by word as they
are spoken, your colors or your own clips), checks the frames and schedules it into your open days.
It also cuts Shorts out of your own long videos, with captions that follow what you say.
Your Claude does all the writing. Runsheet supplies your channel's data, uploads and schedules.

## Install

1. In Runsheet, open Settings, API keys, and make a key with **Read**, **Write**, **Write copy** and
   **Upload from this machine** ticked.
2. In Claude Code:

   ```
   /plugin marketplace add KalpeshMahida0212/runsheet-mcp
   /plugin install runsheet@runsheet
   ```

   Paste the key when it asks. Installed from a shell instead, set it with `/plugin configure runsheet`.
3. Ask: **"Fill next week's Shorts."**

It needs Node 20 or newer and Chrome or Edge. The first run installs the engine's three packages
(ffmpeg, the voice client and the browser driver), about 80 MB, once.

## Settings

`~/.runsheet-shorts.json`, made on the first run:

| Key | Default | What it does |
|---|---|---|
| `perWeek` | 7 | How many Shorts a run schedules (one a day at most) |
| `time` | `10:00` | The time of day each one goes public, in `timeZone` |
| `timeZone` | yours | An IANA zone, such as `America/New_York` |
| `theme` | `dark` | `dark` or `light` |
| `accent` | `#ff4d2e` | The highlight color |
| `voice` | `en-US-EmmaMultilingualNeural` | Any Microsoft Edge neural voice |
| `folder` | `~/Videos/Runsheet Shorts` | Where each Short and its files are kept |
| `topics` | from the channel | What the channel is about, one line. Used when the library is too small |
| `clips` | none | A folder of your own vertical clips or pictures to use behind the words |
| `longVideos` | none | A folder of your own long videos; each run cuts Shorts from the newest one not cut yet |

## Shorts from your long videos

Give it a long video ("Cut Shorts from C:/Videos/episode-12.mp4"), or set `longVideos` and let the
weekly run take the newest one. It hears every word on your computer (Whisper, run locally), reads
the whole transcript, picks moments that stand on their own, frames a face or keeps the whole screen,
lights each caption word as it is said, checks the frames and schedules them like any other Short.
`CLIPS.md` has the steps it follows.

It needs one more install, once: `npm install --prefix engine/stt` (about 470 MB). The speech model
downloads on the first run (about 290 MB). In testing, 7.5 minutes of video took about a minute to
hear, and each clip about 90 seconds to render.

## Every week, with no one there

### The Claude desktop app (simplest)

Open Code, then Routines, then New routine. Choose **Local**, set it to weekly, and give it this:

```
Use the runsheet-shorts skill to fill next week's Shorts.
```

It runs on your computer while the app is open and the computer is awake.

### Any system scheduler, with `claude -p`

1. Run `claude setup-token` once. It prints a long-lived token for your Claude plan. Give it to the
   job as `CLAUDE_CODE_OAUTH_TOKEN`. Leave `ANTHROPIC_API_KEY` unset for the job, or it is used instead.
2. The command:

   ```
   claude -p "Use the runsheet-shorts skill to fill next week's Shorts" --permission-mode dontAsk --allowedTools "Read" "Write" "Edit" "Glob" "Grep" "Bash(node *)" "Bash(npm install*)" "mcp__plugin_runsheet_runsheet" --max-turns 200
   ```

   `mcp__plugin_runsheet_runsheet` allows the plugin's Runsheet tools. If `/mcp` shows the server
   under another name, use that one.
3. Schedule it:
   - **Windows:**
     `schtasks /create /sc weekly /d SUN /st 09:00 /tn "Runsheet Shorts" /tr "cmd /c claude -p ..."`
   - **macOS or Linux (cron):** `0 9 * * 0 claude -p ...`

## What keeps it safe

- **Lead time:** every Short is scheduled at least 24 hours ahead, and YouTube keeps it private until
  then.
- **A notice for each one:** Runsheet emails you for every video scheduled through your key, with a
  link to watch it, move it or pull it.
- **Variety:** one Short a day at most, no topic that repeats a recent title, and a mix of shapes.
  YouTube does not pay for mass-produced, repetitive videos.
- **Honest content:** a natural voice over words and your own footage. No realistic fake people,
  places or events, and no copied voices.
- **Plan limits:** the uploads count against your Runsheet plan (Free is one video a week). Runsheet
  refuses the rest, and the run stops and says so.

## The engine on its own

```
cd engine && npm install
node render.mjs path/to/short.json
```

The format of `short.json` is at the top of `engine/render.mjs`. It writes `short.mp4` (1080x1920,
30 fps, -14 LUFS), `cover.png` and `sheet.png`, and prints a JSON summary.

For clips from a long video (after `npm install --prefix engine/stt`):

```
node clip.mjs transcribe path/to/video.mp4 --out path/to/folder
node clip.mjs render path/to/clip.json
```

The format of `clip.json` is at the top of `engine/clip.mjs`. `npm test` in `engine` checks the word
timing and caption logic in a second, with nothing to install.
