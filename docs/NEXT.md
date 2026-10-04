# Open work (handoff between sessions)

## Hebrew voice for the kids area
Gemini TTS (`gemini-3.1-flash-tts-preview`), chosen by the owner by ear:
Achernar (female) for praise and game instructions, Algieba (male) for names
of topics, books, stickers and menus. Built by `tools/tts-prerender/hebrew.mjs`
(Gemini part in `gemini_he.py`); edge-tts Avri stays as the fallback, and the
app plays Avri for any phrase Gemini has not recorded yet.
State 2026-10-04: 90 of 133 phrases recorded. The paid key (prepaid credits,
owner paid 99 NIS, credits expire after a year) still has a daily cap of
about 100 TTS requests; run `node tools/tts-prerender/hebrew.mjs` again after
the reset (midnight Pacific) for the rest. Every piece is checked by
transcription; a rejected one is retried on the next run.
Only fixed app text is sent to the TTS service; never learner data.

## Illustrations
All little-book pages are illustrated (2026-10-04). New pages:
`python3 tools/pics/gemini_pages.py <folder> [ids]` (Gemini image generation
with a style reference page and the character pictures; scene text in
`tools/pics/little-book-prompts.json`), then `node tools/pics/import.mjs <folder>`.
Review every picture before import: no domes or religious buildings, no
writing, counts (candles, stars) right, the characters look like themselves.
Canva via the connector stops after about 4 images per account.
