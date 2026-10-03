# Open work (handoff between sessions)

## Hebrew voice for the kids area
Current: pre-recorded phrases with Microsoft "Avri" (edge-tts), built by
`tools/tts-prerender/hebrew.mjs` into `public/audio/he/`. The owner finds it
not human enough and wants a better female and male voice.

Plan:
1. The Google AI Studio key is stored as an environment API credential for
   `generativelanguage.googleapis.com` (header `x-goog-api-key`): call the
   Gemini API without a key and the session proxy adds it. If calls fail with
   401/403, read the `environment.secrets` documentation page and ask the owner.
   Never ask for the key in chat and never print it.
2. Render the same 5 sample phrases ("כל הכבוד!", "איפה המילה?", "בונים את
   המילה", "מדבקה חדשה! כלבלב", "נסו שוב") with 2 female + 2 male Gemini TTS
   voices (gemini-2.5-flash-preview-tts or newer, style prompt: warm, gentle,
   natural Israeli Hebrew for small children) and ElevenLabs v3 if a key exists.
3. Send the samples to the owner, let her choose by ear.
4. Add the chosen engine to `hebrew.mjs` (keep edge-tts as fallback), re-render
   all phrases, keep `content/audioCoverage.test.ts` green, deploy.
Only fixed app text is sent to the TTS service; never learner data.

## Illustrations
Canva monthly AI allowance ran low on 2026-10-03. Remaining little-book pages
(see `content/kids/books.json`, stage "little") are generated in priority order;
whatever is missing continues after the allowance resets (about 2026-10-11).
Pipeline: Canva generate → export PNG → `tools/pics/cutout.py` (non-book) /
`tools/pics/sticker_border.py` (stickers) → `tools/pics/import.mjs`.
