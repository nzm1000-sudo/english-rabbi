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
   Done 2026-10-03 with `gemini-3.1-flash-tts-preview`: Sulafat, Achernar
   (female), Achird, Algieba (male), plus the current Avri for comparison.
   No ElevenLabs key exists. Waiting for the owner's choice.
   Findings for step 4:
   - The key is on the free tier: 10 requests per day per TTS model
     (`gemini-3.8-flash-tts` was used up on 2026-10-03). Rendering the 133
     phrases one request each is not possible. Either the owner enables
     billing, or several phrases go in one request and the audio is split
     on silence (a phrase with "!" mid-sentence also has an inner pause,
     so split by expected count, not by every silence).
   - The response is raw PCM (`audio/l16; rate=24000`), not WAV:
     convert with `ffmpeg -f s16le -ar 24000 -ac 1 -i in.pcm`.
   - A long English style instruction gets spoken aloud. Keep it to one
     short line ending with a colon, then the Hebrew text.
   - Achird leaves pauses of about 4 seconds between lines; the
     existing silence trim handles a single phrase.
   - `gemini-2.5-flash` is closed to this key; use `gemini-3.8-flash` to
     transcribe and check the rendered audio.
4. Add the chosen engine to `hebrew.mjs` (keep edge-tts as fallback), re-render
   all phrases, keep `content/audioCoverage.test.ts` green, deploy.
Only fixed app text is sent to the TTS service; never learner data.

## Illustrations
Canva monthly AI allowance ran low on 2026-10-03. Remaining little-book pages
(see `content/kids/books.json`, stage "little") are generated in priority order;
whatever is missing continues after the allowance resets (about 2026-10-11).
Pipeline: Canva generate → export PNG → `tools/pics/cutout.py` (non-book) /
`tools/pics/sticker_border.py` (stickers) → `tools/pics/import.mjs`.
