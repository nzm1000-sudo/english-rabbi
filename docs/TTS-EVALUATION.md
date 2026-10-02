# Speech engine evaluation (2026-10-02)

Goal: natural, clear English that a child can listen to again and again to
learn pronunciation, rhythm and linking. "It speaks" is not enough.

Method: the five test sentences below were generated with every engine that
could run in the build environment. Naturalness was **not** judged by the
developer (no audio output available). It must be judged by ear. Samples
were delivered separately, and the in-app Voice Lab (`#/parent/voices`)
plays the device voices on the actual phone.

Test sentences: "Hello, my name is Sarah." / "I'd like to know what you're
doing tomorrow." / "Have you ever been to London?" / "Although it was
raining, we decided to go outside." / "I would've called you if I'd known
you were home."

| Engine | Where it runs | Offline | Cost | License | US / UK | Rate control | Cacheable | Measured |
|---|---|---|---|---|---|---|---|---|
| Kokoro-82M (kokoro-js) | build machine, home server; in-browser uncertain on iPhone | yes | free | Apache-2.0 (weights + JS) | yes (af_heart, am_michael / bf_emma, bm_george) | native speed param | yes | fp32: ~1.2 s per sentence on 4-vCPU server, RTF 0.41 |
| Piper (piper1-gpl) | build machine, home server | yes | free | GPL-3.0 (code); per-voice licenses vary | yes | length scale | yes | ~0.1 s per sentence, RTF 0.04 |
| eSpeak NG | anywhere | yes | free | GPL-3.0 | yes | yes | yes | instant; formant synth, robotic |
| iPhone Web Speech (Safari) | device | yes | free | n/a | yes | rate 0.1–10 | no | not measurable here |

Facts from research (sources in the lab report):
- Safari's Web Speech API exposes only **pre-installed** voices. Downloaded
  Enhanced/Premium voices and Siri voices are **likely not available** to web
  pages (Apple engineer on Apple Developer Forums; iOS 17 briefly differed).
  Not verified on iOS 26. Check with the Voice Lab on a real iPhone.
- Kokoro in the browser needs an 86–92 MB model (q8) and WebGPU/WASM. No
  report found of it running well on iPhone. Not adopted for on-device use.
- Piper's maintained repo moved to GPL-3.0 (original MIT repo archived
  2025-10-06).

## Recommendation

1. **Fixed content → pre-rendered Kokoro audio** (`tools/tts-prerender`).
   Neural quality, fully offline, zero runtime cost, about 18 KB per
   phrase. Current content is 86 texts × 2 accents × 2 speeds, about 6 MB.
2. **Dynamic text (tutor, conversation) → Kokoro on the home server** via
   Kokoro-FastAPI (OpenAI-compatible endpoint). Only English text is sent,
   inside the home network. Audio is cached on the phone.
3. **Fallback → best device voice**, chosen in the Voice Lab. Always works,
   offline.

A paid cloud voice (e.g. Azure Neural, ElevenLabs) is an option only, not
connected.

## Decision (2026-10-02, chosen by ear)

- Main voice: Kokoro `af_heart` (American, female). Second dialogue voice: `am_michael` (American, male).
- Slow mode: the same voice generated at speed 0.8.
- British voices were not chosen. A student set to British English uses the best device voice.
- Rendered: 94 texts (items, words, example sentences, passage sentences) × normal/slow = 188 MP3 files, 3.6 MB, precached for offline use.
- `content/audioCoverage.test.ts` fails if new content has no audio. Fix: run `tools/tts-prerender`.
