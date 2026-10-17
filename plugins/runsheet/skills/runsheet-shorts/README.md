# runsheet-shorts

Claude makes YouTube Shorts for your channel and schedules them with Runsheet. It reads your channel,
writes each script as scenes and renders the Short on your computer as motion graphics in the style
you pick: a voice, headlines and type that land as they are said, cards, checklists, numbers and slams
that hit on their words, scenes that slide, wipe, flood and open in, music made for the video and a
sound for every move. Then it checks the frames and schedules it into your open days.
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

It needs Node 20 or newer and Chrome or Edge. Before the first video of each kind, Claude runs
`node engine/preflight.mjs shorts` (or `clips`, or `watch <video>`), which lists only what that job needs
and is missing, and installs just that:

| Job | Installs once |
|---|---|
| A Short from a script | the engine: ffmpeg, the browser driver and the voice, about 90 MB |
| Shorts cut from a long video | the engine, plus the speech part: about 470 MB, and its model on the first listen, about 290 MB |
| Watching a finished video to write its copy | the engine, plus the speech part only when the video has a sound track |

Nothing else is downloaded: the frames are drawn in your own Chrome or Edge.

## Settings

`~/.runsheet-shorts.json`, made on the first run:

| Key | Default | What it does |
|---|---|---|
| `perWeek` | 7 | How many Shorts a run schedules (one a day at most) |
| `time` | `10:00` | The time of day each one goes public, in `timeZone` |
| `timeZone` | yours | An IANA zone, such as `America/New_York` |
| `style` | `studio` | The look of every Short: `studio`, `kinetic`, `neon`, `pop` or `editorial` (see below) |
| `theme` | `light` | `light` (cream) or `dark` (ink): the usual ground |
| `accent` | `#ff4a36` | Your brand color; every other color is worked out from it |
| `voice` | `en-US-EmmaMultilingualNeural` | Any Microsoft Edge neural voice |
| `rate` | `+8%` | How fast the voice speaks |
| `music` | `auto` | `auto` (music made for each Short), `none`, or the path of your own track |
| `logo` | none | Your square logo, for the top of each scene and the end card |
| `folder` | `~/Videos/Runsheet Shorts` | Where each Short and its files are kept |
| `topics` | from the channel | What the channel is about, one line. Used when the library is too small |
| `clips` | none | A folder of your own pictures or clips to show in picture scenes |
| `longVideos` | none | A folder of your own long videos; each run cuts Shorts from the newest one not cut yet |
| `links` | none | Lines for the foot of every long video's description, such as your site; nothing else is ever added |

## Styles

| Style | The look | Plan |
|---|---|---|
| Studio | Cream, ink or accent grounds, white cards, headlines that rise word by word, caption pills | Free and paid |
| Kinetic | No captions: huge type stretched to the frame, slamming in word by word, wipes and hard hits | Paid |
| Neon | Dark and electric: a synthwave grid, glass panels, glowing type typed in, glitch cuts | Paid |
| Pop | Bright and playful: sticker cards with thick outlines, bouncy type, doodles and marker highlights | Paid |
| Editorial | A calm magazine page: big serif type set line by line, hairlines, numerals and whitespace | Paid |

Set one in the settings, or name it when you ask ("Make this week's Shorts in Neon"). Every style has its own
transitions, music and sounds, so channels that use different styles never look alike.

**What each plan makes.** A free Runsheet account makes one Short with this skill, in Studio. Starter makes
15 Shorts a month, Creator 60 and Network 250, in every style. Each video gets a pass from Runsheet before it
renders, and the paid styles come from Runsheet with that pass. A pass covers one video for two hours and
six renders, so Claude can check and fix it before it is scheduled.

## Shorts from your long videos

Give it a long video ("Cut Shorts from C:/Videos/episode-12.mp4"), or set `longVideos` and let the
weekly run take the newest one. It hears every word on your computer (Whisper, run locally), reads
the whole transcript, picks moments that stand on their own, frames a face or keeps the whole screen,
lights each caption word as it is said, checks the frames and schedules them like any other Short.
`CLIPS.md` has the steps it follows.

It needs the speech part, once, which `node engine/preflight.mjs clips` asks for: about 470 MB, and the
speech model downloads on the first run (about 290 MB). In testing, 7.5 minutes of video took about a
minute to hear, and each clip about 90 seconds to render.

## Videos you made yourself

Give Claude a finished video ("Upload episode-12.mp4 for Thursday at 6pm") and the `runsheet-upload` skill
watches it first, on your computer: it hears every word with its time and looks at frames from across it.
Then it writes the title, the description with chapters at the real moments, tags and hashtags by
YouTube's own rules (`../runsheet-write/YOUTUBE.md`), makes a thumbnail from the best frame, and
schedules it. In testing, an 8 minute talk-over screen recording took about a minute to hear.

```
node engine/watch.mjs look path/to/video.mp4                   transcript, frames and the video's shape
node engine/watch.mjs frame path/to/video.mp4 312 frame.jpg    one full size frame
node engine/watch.mjs thumb thumb.json                         a thumbnail from a frame and a few words
```

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
- **Plan limits:** every Short needs a pass from your plan, and every upload counts against your
  Runsheet plan's publishes. Runsheet refuses the rest, and the run stops and says so.

## The engine on its own

```
cd engine
node preflight.mjs shorts
npm install
node render.mjs path/to/short.json
```

The format of `short.json` is in `SCENES.md` and at the top of `engine/render.mjs`. Every render needs the
video's `pass` from `runsheet_start_short` (`engine/lib/pass.mjs`). It writes
`short.mp4` (1080x1920, 30 fps, -14 LUFS), `cover.png` and `sheet.png`, and prints a JSON summary.
Everything in the picture and the sound is made in code: the fonts (Inter Tight, Instrument Serif,
JetBrains Mono, Instrument Sans, and each paid style's own) and the icons (Lucide) are open-licensed, and
the music and effects are synthesized, so a Short can be published anywhere.

For clips from a long video (after `node engine/preflight.mjs clips` and what it lists):

```
node clip.mjs transcribe path/to/video.mp4 --out path/to/folder
node clip.mjs render path/to/clip.json
```

The format of `clip.json` is at the top of `engine/clip.mjs`. `npm test` in `engine` checks the word
timing and caption logic in a second, with nothing to install.
