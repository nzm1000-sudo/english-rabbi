# Changelog

## 0.2.0
- Content: about 1,300 original exercises for 3/4/5 units (vocabulary A1-C1, word
  formation, tenses, sentence structures, 13 bagrut-style reading passages,
  listening incl. minimal pairs and dictation, connectors, collocations,
  phrasal verbs, idioms, riddles), every pack reviewed by a second pass.
- Lessons: about 30 lessons with Hebrew explanations, English examples with
  audio, tables and typical Israeli mistakes; reachable from any exercise.
- Games: quiz, lightning round, bagrut-style mock exam, daily challenge,
  riddles, mistake gym, focused practice per skill.
- Ranks that require points, remembered words and mastered skills together;
  achievements.
- Audio cached at runtime with a "download all" button for offline use.
- GitHub Pages deployment and CI.

## 0.1.1
- Natural American voice (Kokoro af_heart) for all fixed content, normal and slow, offline.
- Reading passages play sentence by sentence from pre-rendered audio.
- Test that every speakable text has audio.

## 0.1.0 (Stage 1)
- Project scaffold: Vite, React, TypeScript, PWA, Vitest.
- Learning domain: CEFR scale, skill taxonomy, Israeli 3/4/5 mapping layer,
  Bayesian ability model, evidence model, FSRS, learner memory, adaptive
  selector with placement mode, hint ladder, answer checking.
- Local persistence: IndexedDB schema v2, transactional store, event replay,
  JSON backup, migration test.
- Content: 89 original items, misconception catalog, licensing gate.
- Speech: provider chain (pre-rendered, home server, device), voice lab,
  pre-render tool.
- UI: student picker, student settings, home, practice, parent dashboard.
