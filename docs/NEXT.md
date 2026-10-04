# Open work (handoff between sessions)

## Hebrew voice for the kids area
Gemini TTS (`gemini-3.1-flash-tts-preview`), chosen by the owner by ear:
Achernar (female) for praise and game instructions, Algieba (male) for names
of topics, books, stickers and menus. Built by `tools/tts-prerender/hebrew.mjs`
(Gemini part in `gemini_he.py`); edge-tts Avri stays as the fallback, and the
app plays Avri for any phrase Gemini has not recorded yet.
Two recording sets, chosen by the child's stage: `gemini-he-1` (ages 3-6,
lively kindergarten tone) and `gemini-he-young-1` (ages 7-8, calm and
natural; the owner said the lively tone is too childish past 6). Each falls
back to Avri, never to the other set. The regular app (9+) has no Hebrew voice.
State 2026-10-04: 91 of 133 phrases in the 3-6 set, none yet in the 7-8 set.
The paid key (prepaid credits, owner paid 99 NIS, credits expire after a
year) has a daily cap of about 100 TTS requests; run
`node tools/tts-prerender/hebrew.mjs` after each reset (midnight Pacific) until
nothing is left. Every piece is checked by transcription; a rejected one is
retried on the next run. Words the voice misreads get niqqud via NIQQUD.
Only fixed app text is sent to the TTS service; never learner data.

## Illustrations
All little-book pages are illustrated (2026-10-04). New pages:
`python3 tools/pics/gemini_pages.py <folder> [ids]` (Gemini image generation
with a style reference page and the character pictures; scene text in
`tools/pics/little-book-prompts.json`), then `node tools/pics/import.mjs <folder>`.
Review every picture before import: no domes or religious buildings, no
writing, counts (candles, stars) right, the characters look like themselves.
Canva via the connector stops after about 4 images per account.
