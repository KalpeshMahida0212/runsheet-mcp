---
name: runsheet-write
description: "Writes and saves YouTube titles, descriptions, tags, chapters, Shorts hooks, translations and promo posts for the creator's videos with Runsheet. Runsheet hands over its brief (the rules and the video's facts) and your own model writes the copy, so it costs the creator no Runsheet credits. Use when the user asks for titles, a description, tags, chapters, a hook, translations, or posts for a video, or to fix the copy on a video that is not doing well."
---

# Write a video's copy from Runsheet's brief, then save it to YouTube

Every Runsheet writing tool returns a brief rather than a draft:
- **INSTRUCTIONS:** the exact rules Runsheet holds for that kind of copy.
- **INPUT:** the video's own facts.

Follow the instructions to the letter and write the result yourself. Where they ask for JSON, give the
creator readable text instead.

## Which tool for what

| The creator wants | Brief tool | Saved with |
|---|---|---|
| Titles | `runsheet_generate_titles` (describe the video in `prompt`) | `runsheet_update_metadata` (title) |
| A description | `runsheet_generate_description` | `runsheet_update_metadata` (description) |
| Tags | `runsheet_generate_tags` | `runsheet_update_metadata` (tags) |
| Chapters | `runsheet_generate_chapters` | added to the description with `runsheet_update_metadata` |
| A Shorts hook | `runsheet_generate_shorts_hooks` | used in the script or the title |
| Translations | `runsheet_translate_video` (video_id, languages) | `runsheet_set_localizations` |
| Posts for X, LinkedIn, Instagram, Community | `runsheet_repurpose_video` (video_id) | nothing: the creator posts them |
| A script | `runsheet_write_script` | `runsheet_create_idea` notes, or given to the creator |

Find a video's id with `runsheet_get_library` (published) or `runsheet_get_schedule` (planned and
scheduled).

## How to work

1. Read the video first: `runsheet_get_library` or `runsheet_get_schedule`.
2. Call the brief tool and write the copy from the brief.
   - **Titles:** five options, under 60 characters, the searched phrase first. Show each one's length.
   - **Each translation:** keep links, timestamps, handles and names exactly as written.
   - **Posts:** end each with the video's link, as the brief says.
3. Show the creator the result and save it once they say yes. If they asked you to just do it, save
   the best option and say which one you chose.
4. A video that is not doing well: change one thing at a time (title or thumbnail), so the creator can
   tell what helped.

## Rules

- Only facts from the brief, the video or the creator. No invented numbers or results.
- No em dashes, no emojis, and no hashtags inside titles.
- Never promise views.
