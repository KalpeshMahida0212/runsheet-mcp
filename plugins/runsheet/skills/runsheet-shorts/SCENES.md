# Scenes: how a Short is built

A Short is 5 to 9 scenes. Each scene is one line of the voice-over (`say`) and one moving picture. The engine
speaks every line first and times every word, then everything on screen arrives on the word that names it: a
headline's words rise as they are said, a list's cards fly in on their own words, a number lands on its number.
So write the on-screen text with the same words the voice says.

Under it all: music made for the video, a sound for every move (whooshes on the transitions, pops as cards land,
ticks as boxes tick, an impact on a slam or a number) and a camera that pushes in and jolts on the hits.

The same script works in every style (`"style"` in short.json): each draws the scene types its own way, with its own
type, grounds, transitions, music and sounds. The descriptions below are Studio's. Kinetic shows no captions (its
words are the picture); the others light each spoken word in captions of their own look.

## Every scene

- `type`: one of the types below.
- `say`: the voice-over line. One or two short sentences, 4 to 22 words.
- `ground` (optional): `light`, `dark` or `punch` (the accent moment). In Studio: cream, ink, and the accent color
  with rays. Left out, it is the settings' theme; `stat` and `punch` are always `punch`.
- `enter` (optional): `slide`, `flood`, `dome`, `zoom` or `cut`. Left out, the engine picks the one that fits (a
  slide between light scenes, a flood into the accent, a dome into the dark).
- A word in stars, `*like this*`, is drawn in the accent color (in Studio, as a serif italic). One starred word or
  short phrase in a headline.

## The types

| type | what it shows | fields |
|---|---|---|
| `hook` | Always scene 1. A kicker pill, a big headline rising word by word, an icon popping in with a ring and confetti | `text` (7 words at most), `kicker` (3 words at most, optional), `icon` (optional) |
| `text` | A statement, with an icon tile under it, or alone and larger | `text`, `icon` (optional) |
| `list` | A title and 2 to 4 numbered cards that fly in on their words | `text` (the title), `items` (2 to 4, 5 words at most each; an item may be `{ "text", "icon" }`) |
| `checklist` | A title and 2 to 4 boxes, each ticked on its word | `text`, `items` |
| `steps` | Numbered steps down a line that draws itself | `text`, `items` |
| `compare` | Two cards that swing in from the sides; the worse one dims when the better one lands | `text`, `left`: `{ "label", "lines": [1 to 3] }`, `right`: the same (right is the better side) |
| `stat` | A number that counts up and slams down on the accent ground, with a ring and confetti | `value` (as shown: `"3x"`, `"47%"`, `"$1,200"`), `text` (the label), `icon` (optional) |
| `slam` | One or two huge words in an ink band, landing over the scene before it | `text` (1 or 2 words) |
| `punch` | The accent ground and a big line: the payoff | `text`, `icon` (optional) |
| `quote` | A quote card, typed in as it is read | `quote`, `by` (optional), `text` (a title, optional) |
| `chat` | Message bubbles, the other side typing first | `messages`: `[{ "from": "me" or "them", "text" }]` (2 to 4), `text` (optional) |
| `image` | The creator's own picture or clip in a card that slowly pushes in | `src` (a path), `text` |
| `strike` | A wrong idea struck through by a marker, the right one rising under it | `wrong`, `right` (optional) |
| `end` | Always the last scene. The channel's mark on a sunburst, a typed line, a stamp | `text` (optional), `sub` (the handle or a link), `stamp` (4 words at most, optional) |
| `chapter` | Long videos only. A section card that opens a part of the video; its title becomes a YouTube chapter at that moment | `text` (the chapter's name, 6 words at most), `kicker` (like "Part 2", optional) |

## Long videos

The same engine makes long videos: put `"shape": "16x9"` in the spec. Each style lays every scene out for the wide
frame. A long video:

- runs 40 to 100 scenes, up to ten minutes, and writes `video.mp4` (1920x1080) instead of `short.mp4`;
- opens each part with a `chapter` scene. The renderer turns them into `chapters.txt` in YouTube's format, at their
  exact times: the opening is folded into the first chapter when it is under ten seconds, and the summary says when
  YouTube would ignore the list (fewer than three chapters, or one under ten seconds);
- has no words on screen by default: it writes `captions.srt` for YouTube's own subtitles instead. `"captions": true`
  turns the on-screen words on;
- splits its check sheet into pages of twenty scenes: `sheet-1.png`, `sheet-2.png` and on.

## What makes a good one

- Scene 1 is `hook`, the last is `end`.
- Never the same type twice in a row, and at least four different types in a Short.
- At most one `slam` and at most two accent scenes (`stat`, `punch`).
- A `stat` only shows a number that is true: the channel's own data, or a plain fact the script states (a price, a
  count of steps). Never a statistic about other people.
- A stamp or a kicker is a claim too: only what is true ("Free plan", the channel's real schedule if the settings
  give it). Never a promise the channel has not made.
- Keep the screen short: a headline is 7 words at most, a list item 5. The voice can say more than the screen shows,
  but the screen's words should be in what the voice says.
- The `end` scene's `say` is the call to action, said once: follow, or where to go.

## Icons

alarm-clock, apple, arrow-down, arrow-right, arrow-up, baby, badge-check, ban, battery-charging, bell, bike,
book-open, bot, brain, brush, building, calendar, calendar-check, calendar-clock, calendar-days, camera, car, cat,
chart-column, chart-line, check, circle-alert, circle-check, circle-x, clipboard-list, clock, cloud, code, coffee,
compass, cpu, credit-card, crown, database, dog, dollar-sign, droplet, dumbbell, eye, file-text, film, flag, flame,
folder, footprints, gamepad-2, gem, gift, globe, graduation-cap, hammer, hand, hand-coins, headphones, heart,
hourglass, house, image, infinity, info, key-round, laptop, layers, leaf, lightbulb, link, list, list-checks, lock,
lock-open, mail, map-pin, medal, message-circle, messages-square, mic, monitor, moon, mountain, music, notebook-pen,
package, palette, party-popper, pen-line, pencil, percent, phone, piggy-bank, plane, play, puzzle, refresh-cw,
repeat, rocket, rotate-ccw, salad, scissors, search, send, settings, share-2, shield, shield-check, shopping-cart,
sliders-horizontal, smartphone, snowflake, sparkles, star, store, sun, tag, target, terminal, thumbs-down, thumbs-up,
ticket, timer, tree-pine, trending-down, trending-up, triangle-alert, trophy, truck, umbrella, user, user-check,
user-plus, users, utensils, video, wallet, wand-sparkles, wifi, wind, wrench, x, youtube (YouTube's play button),
zap. Icons are Lucide's (ISC licence).

## A whole one

```json
{
  "out": ".",
  "title": "Stop Posting Whenever You Remember #Shorts",
  "brand": { "name": "Maya Cooks", "handle": "@mayacooks" },
  "theme": "light",
  "accent": "#ff6a3d",
  "voice": "en-US-EmmaMultilingualNeural",
  "rate": "+8%",
  "music": "auto",
  "style": "studio",
  "pass": "<from runsheet_start_video>",
  "scenes": [
    { "type": "hook", "say": "You post when you remember. Here is a better week.", "text": "Post when you *remember?*", "kicker": "a better week", "icon": "calendar" },
    { "type": "strike", "say": "Not whenever you have time. On the same day, every week.", "wrong": "Whenever you have time", "right": "The same *day*, every week" },
    { "type": "steps", "say": "Pick your day. Batch three videos. Schedule them all at once.", "text": "Three *steps*", "items": ["Pick your day", "Batch three videos", "Schedule them all"] },
    { "type": "slam", "say": "Done.", "text": "Done" },
    { "type": "end", "say": "Follow for one recipe a week.", "text": "One recipe a *week*", "sub": "@mayacooks", "stamp": "New every Sunday" }
  ]
}
```
