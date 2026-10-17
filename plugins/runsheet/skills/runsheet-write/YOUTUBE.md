# YouTube's rules for a video's copy

Every Runsheet skill writes titles, descriptions, chapters, tags and thumbnail words by these rules. They come
from YouTube's own help pages, its Data API reference and its Developer Policies, checked in October 2026. Where
YouTube publishes no number (how much of a title each screen shows), the working limit below comes from vidIQ's
measurements and is marked "working limit". Runsheet's writing tools hand the same rules over with every brief.

## Titles

1. **Length.** YouTube allows 100 characters and rejects `<` and `>`. Keep a title to 60 or fewer, with the
   phrase a viewer would search, and the hook, in the first 40 (working limit: phones, search and the Shorts
   feed cut titles off around there).
2. **Shorts.** 20 to 40 characters, keyword first. On a Short the video wins the swipe; the title serves search,
   the channel page and related links.
3. **No hashtags in a title.** `#Shorts` is not needed: a square or vertical video up to three minutes is a Short
   by itself (since 15 Oct 2024). Hashtags go at the end of the description.
4. **Most important words first.** A series name or episode number goes last, if at all.
5. **Pick the kind of title for where the video is found.**
   - Searchable, saying plainly what you get, for how-tos, tutorials and reviews.
   - A universal problem or a real question for stories and entertainment, which are found on Home and in
     Suggested. YouTube's own example: "Why Is Your Coffee So Expensive?" beats "In-depth analysis of economics
     in the coffee market".
6. **Numbers and brackets.** A number only when it is the real count, time or result. Parentheses only after the
   keyword, to name the audience or format: "(Beginner Tutorial)".
7. **Never loud.** At most one word in capitals, no rows of exclamation marks, no emoji.
8. **Deliver the promise.** The title, thumbnail and first line promise exactly what the video shows. YouTube
   removes misleading clickbait under its spam policy, and a title that wins clicks but loses watch time is the
   worse title.
9. **Never a template.** Use this video's own words. The same pattern on every upload reads to YouTube as
   mass-produced content.
10. **Testing.** YouTube Studio's Test & Compare tries up to three titles or thumbnails on a long video and picks
    by watch time. The API cannot see a running test, so never change the title or thumbnail of a video the
    creator is testing; ask first.

## Descriptions

1. **Length.** 5,000 bytes, not characters: an emoji is four bytes, most non-Latin letters two or three. No `<`
   or `>`.
2. **The first line works alone.** Only the first line or two show before "more", and search may show one. The
   first 100 to 150 characters say what the video delivers, with the title's main phrase.
3. **Order.** The first line; what the video covers, in a few short lines; the links the creator gave; the
   chapters (long videos); up to three hashtags on the last line.
4. **Links.** Clickable only in long videos on channels with advanced features, never in a Short's description,
   where @handles and hashtags still work. A Short's description has no web links.
5. **Never.** A block of keywords or tags (YouTube's policy forbids it), a link, sponsor or line the creator did not
   give (not Runsheet's name, not a tracking link), or the same opening lines as another video.

## Chapters (long videos)

1. In the description, one per line, the time first: `0:00 Intro`, then minutes:seconds, hours:minutes:seconds
   past an hour.
2. At least three, in order, each at least ten seconds long. Break any of these and YouTube shows none.
3. Every time comes from the real video. Merge a moment shorter than ten seconds into its neighbor; never round a
   chapter onto a moment where nothing happens. Redo them after any trim.
4. Each label is two to six words, under 40 characters, naming what happens there.
5. Manual chapters replace YouTube's automatic ones, so write them only from a real outline. A Short gets none.

## Hashtags

1. Up to three, on the last line of the description, each directly about the video, no spaces. YouTube shows up
   to three by the title, and past 60 it ignores them all.
2. Topical tags only (`#homecooking`, not `#viral`). Never `#Shorts` in place of a real topic.

## Tags

1. 500 characters across all of them: commas count, and a tag with a space counts two more for its quote marks.
2. YouTube says tags play "a minimal role": the core phrase, a few close variants, and real misspellings of names
   in the video. Five to fifteen is plenty. Never put tags in the description.

## Thumbnails (long videos)

1. 16:9, at least 1280 x 720, JPG or PNG. Runsheet's uploader takes up to 2 MB.
2. One clear subject: a face with a strong expression, or the result the video promises. Not a frame that already
   has text on it.
3. Three to five big words that add to the title instead of repeating it: if the thumbnail says "I QUIT", the
   title is not "I Quit YouTube".
4. Readable at phone size: a thumbnail is seen about 170 pixels wide in a list.
5. Nothing misleading, vulgar or shocking; YouTube can take custom thumbnails away for 30 days.
6. A Short's cover is 9:16. Custom Shorts covers are set in YouTube Studio; through the API they may be refused,
   and Runsheet's uploader says so when they are.

## Shorts

1. A Short is square or vertical and three minutes at most. A longer vertical video uploads as a regular video.
2. A Short over one minute with any copyright claim is blocked worldwide, so a clip from a video with licensed
   music stays at 60 seconds or less.
3. The related video link (a Short pointing to a long video) is set in YouTube Studio only; tell the creator
   when it would help.

## Other settings (decided by the creator, never silently)

- **Made for kids** is the creator's legal decision.
- **Altered or synthetic content** must be disclosed for realistic AI-made or altered people, places, events or
  scenes. Scripts, titles, thumbnails, captions and ideas made with AI, and animation that does not look real,
  need no disclosure.
- **Translations** of the title and description need the creator's say-so.
