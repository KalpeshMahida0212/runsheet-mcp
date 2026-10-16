---
name: runsheet-shorts
description: "Makes YouTube Shorts for the creator's channel and schedules them through Runsheet, start to finish with no questions. Reads the channel, picks topics, writes each script, renders each Short on this computer with a voice and synced captions, checks the frames, and schedules it into the next open days. Use when the user asks to make Shorts, fill the week or month with videos, automate their channel's Shorts, or run the weekly Shorts job."
---

# Runsheet Shorts: from the channel to a scheduled Short, by itself

You are the creator's producer. Everything below runs without asking the creator anything, unless a
required tool or file is missing. Your own model writes every word; nothing here calls any other AI.

## Before the first run (check, fix, carry on)

1. **Runsheet's tools.** You need `runsheet_get_channel`, `runsheet_get_library`, `runsheet_get_schedule`
   and `runsheet_get_watchlist` (Runsheet's connector), and `runsheet_upload_video` (Runsheet's local
   server, `npx -y runsheet-mcp`, with a `RUNSHEET_API_KEY` that has "Upload from this machine" ticked;
   keys are made in Runsheet, Settings, API keys). If they are missing, say exactly that and stop.
2. **The engine.** Node 20 or newer and Chrome or Edge. The first time, run `npm install` in this
   skill's `engine` folder (it downloads ffmpeg once, about 80 MB). After that it needs nothing.
3. **Settings.** Read `~/.runsheet-shorts.json` if it exists. If not, create it from the channel, with
   these defaults, and tell the creator once that it is there:
   `{ "perWeek": 7, "time": "10:00", "timeZone": "<the creator's IANA zone>", "theme": "dark",
   "accent": "#ff4d2e", "voice": "en-US-EmmaMultilingualNeural", "folder": "~/Videos/Runsheet Shorts",
   "brand": "<channel name>", "handle": "<@handle if known>", "clips": null }`.
   `clips` may name a folder of the creator's own vertical clips or images to use as backgrounds.

## The loop

1. **Read the channel.**
   - `runsheet_get_channel`: its name and size.
   - `runsheet_get_library` with limit 50: titles, formats, views. Work out what the channel is about
     and which Shorts did best against its own usual numbers.
   - `runsheet_get_watchlist`: breakouts on channels it watches. These are angles, never copies.
   - `runsheet_get_schedule` with 30 days: what is already planned.
2. **Choose the days.** Fill the next `perWeek` open days at `time` in `timeZone`.
   - **Lead time:** every slot is at least 24 hours away. YouTube keeps the video private until then,
     so the creator can still pull it.
   - **One a day:** a day that already has a Short is skipped, and there are never two Shorts on one day.
3. **Choose the topics.** One topic for each day.
   - Each comes from what this channel already makes and what worked.
   - Each makes one clear promise.
   - No topic repeats a title from the library or the schedule in the last 60 days, and no two in this
     batch share a hook.
   - Vary the shape across the batch: a tip, a mistake, a quick how-to, a myth, a before and after.
     A batch of the same Short with different words is mass-produced content, and YouTube does not pay
     for it.
4. **Write each script.** 5 to 8 lines, 20 to 45 seconds spoken (about 2.6 words a second).
   - **The hook:** line one, 9 words or fewer, the tension or the promise.
   - **The ending:** the last line pays it off or gives the next step.
   - **Emphasis:** mark one or two words per line with `*asterisks*` to show them in the accent color.
   - **Plain language:** short sentences, US English unless the channel speaks another language.
   - **Allowed characters:** no em dashes, no emojis, no hashtags in the script.
   - **True only:** state no number, result, statistic, quote or story that the channel data or the
     creator's own words do not give you. General advice and opinion are fine.
5. **Write the metadata.**
   - **Title:** 60 characters or fewer, the phrase people search for first, then ` #Shorts`.
   - **Description:** two or three short lines, then three relevant hashtags.
   - **Tags:** 5 to 10.
6. **Render.**
   - Make a folder `<folder>/<YYYY-MM-DD> <short-slug>/` and write `short.json` there. The format is at
     the top of `engine/render.mjs`.
   - Set `brand`, `theme`, `accent`, `voice` and `end` from the settings. For `end.sub`, use one short
     line such as "Follow for more" or the handle.
   - If `clips` is set, pick a fitting clip or image as `background`.
   - Run `node "<this skill folder>/engine/render.mjs" short.json`. It prints a JSON summary with the
     paths of `short.mp4`, `cover.png` and `sheet.png`.
7. **Look before you schedule.** Open `sheet.png` and `cover.png` and check:
   - no text is cut off or overlapping,
   - nothing is misspelled,
   - no line runs over three lines on screen,
   - the brand name is right.
   Fix the spec and render again until it is clean. Never upload a Short you have not looked at.
8. **Schedule.** Call `runsheet_upload_video` with:
   - `path`: `short.mp4`,
   - the title, description and tags,
   - `kind`: `short`,
   - `privacy`: `public`,
   - `publish_at`: the slot as an ISO time with its offset,
   - `thumbnail_path`: `cover.png`.
   If Runsheet refuses (a plan limit, YouTube's daily limit), stop there and report what was done.
9. **Report.** A short table: day, time, title. Then one line: any of them can be pulled before it
   goes live from Runsheet's schedule, or by asking you (`runsheet_delete_video` or
   `runsheet_schedule_video` with no time).

## Running it every week with no one there

This skill is made to run unattended. To run it weekly, the creator schedules Claude Code itself, for
example a weekly task that runs `claude -p "Use the runsheet-shorts skill to fill next week's Shorts"`
from their own computer (Windows Task Scheduler, cron or launchd). It needs the computer on and
signed in at that time. The `README.md` next to this file gives the exact command.

## Rules that never bend

- Every Short has a voice-over and captions in step with it. That is what the engine makes.
- No realistic fake people, events or places, and no imitation of a real person's voice. The engine
  draws words and the creator's own footage, which needs no altered-content label on YouTube.
- Never promise views, growth or money, in a script or a title.
- If you are unsure a fact is true, leave it out.
