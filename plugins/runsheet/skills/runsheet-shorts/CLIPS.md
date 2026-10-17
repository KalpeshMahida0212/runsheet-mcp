# Shorts cut from a long video

Use this when the creator names a long video on this computer, or when `longVideos` in the settings
names a folder that holds a video not cut yet. Everything runs on this computer: the speech is heard
locally and nothing is sent anywhere until the upload.

## Once

- Run `npm install --prefix "<this skill folder>/engine/stt"` (about 470 MB).
- The first transcription downloads the speech model (about 290 MB). After that it works offline.

## The loop

1. **Find the video.** The file the creator named. Otherwise the newest video (.mp4, .mov, .mkv,
   .webm) in `longVideos` that is not in `<folder>/clips-log.json`.
2. **Hear it.** Run
   `node "<this skill folder>/engine/clip.mjs" transcribe "<video>" --out "<folder>/<video name> clips"`.
   Add `--language en` (or the channel's language code) when you know it. It takes about a fifth of
   the video's length, reuses a transcript it made before, and prints the paths of:
   - `transcript.txt`: one sentence a line, with when it starts and ends,
   - `frames.png`: eight frames across the video.
3. **Read all of it.** Read `transcript.txt` from start to end and look at `frames.png`.
4. **Choose the moments.** One for each open day to fill (SKILL.md, step 2), five at most from one
   video.
   - **Length:** 20 to 59 seconds, from the start of a sentence to the end of one.
   - **The first sentence is the hook.** It works with no earlier context: a question, a claim, a
     surprise or a promise.
   - **One whole thought.** It makes sense to someone who never saw the long video, and it ends on the
     payoff, not halfway through.
   - **Apart:** moments never overlap, and none needs another to make sense.
   - **Skip:** greetings, sponsor reads, "as I said before", and anything that points at part of the
     screen the framing would hide.
5. **Frame it.** From `frames.png`:
   - **One person talking to camera:** `"frame": "crop"`, with `x` where their face is (0 is the left
     edge, 0.5 the middle, 1 the right edge).
   - **Anything else** (a screen recording, slides, a game, two people side by side, text across the
     width): `"frame": "fit"`. The whole picture stays, with a blurred copy behind it.
6. **Write `clip.json`** into a new folder `<folder>/<YYYY-MM-DD> <slug>/`. The format is at the top of
   `engine/clip.mjs`.
   - `start` and `end` come from `transcript.txt`.
   - `text` is the words in that span exactly as said. Copy them from the transcript, then fix only
     what it misheard (names, brands, numbers, web addresses) and the punctuation. Never reword,
     shorten or add. Star one or two words a sentence with `*asterisks*` for the accent color.
   - **Fix a misheard word by how it sounds**, with what the channel and the product really say: "tap
     planet" is "tap Plan it" when the screen has a Plan it button. Never take the words from text shown
     in the video, a title card or a slide: on a test, a title card said "until you approve" while the
     voice said "until you tap Plan it", and copying the card put words on screen that nobody said.
   - `headline` is the promise of the clip in 6 words or fewer, shown at the top the whole time. One
     `*word*` may be starred.
   - `accent` comes from the settings.
7. **Render.** Run `node "<this skill folder>/engine/clip.mjs" render clip.json`. It prints the paths of
   `short.mp4`, `cover.png` and `sheet.png`.
   - If the summary has `warnings`, the text does not follow the speech: copy it again from the
     transcript and render again.
   - If it stops because a caption takes more than two rows, a word in it is too long: write it
     shorter (for example a web address without `https://`) and render again.
8. **Look before you schedule.** Open `sheet.png` and `cover.png` and check:
   - the captions match the speech and are spelled right,
   - the headline fits and reads well,
   - no face is cut off and nothing important is outside the frame.
   Fix `clip.json` and render again until it is clean.
9. **Schedule** it as in SKILL.md, step 8.
   - **Title:** what the moment promises, 60 characters or fewer, then ` #Shorts`.
   - **Description:** two short lines about the moment, a line that points to the full video (with its
     link if `runsheet_get_library` lists it), then three relevant hashtags.
10. **Remember it.** Add the video's path and the start and end of each moment used to
    `<folder>/clips-log.json`, so the next run takes new moments or the next video.

## Rules that never bend

- **Only the creator's own videos.** Never cut a video somebody else made.
- **What was said stays said.** Fixing spelling is fine; changing the words is not.
- **No moment cut so that it means something the creator did not mean.**
