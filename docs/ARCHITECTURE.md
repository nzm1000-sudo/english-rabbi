# Architecture

Smart English Tutor is a private, local-first PWA for five children. All
learning data lives in IndexedDB on the device. Nothing is sent anywhere by
default. The app works offline after the first load.

## Principles

1. **The event log is the source of truth.** Every answer is an append-only
   `item.completed` event. Skill estimates, review schedules and mistake
   patterns are a *projection* of events and can be rebuilt at any time
   (`LearningStore.rebuildDerived`). Improving the model later = replay.
2. **Pure domain, thin edges.** `src/domain` has no React, no IndexedDB, no
   network. It is fully unit-tested. `src/data`, `src/services` and
   `src/features` are adapters around it.
3. **Content is data.** Items are JSON validated by zod at load time. No
   content in components. Adding a pack = adding a file.
4. **Every external capability sits behind an interface** (`SpeechProvider`,
   `AIProvider`, `AudioPlayback`, `Recorder`, `SpeechRecognizer`,
   `PronunciationAssessor`). The composition root (`src/app/services.tsx`) is
   the only place that picks implementations.
5. **Per-student isolation.** Every learner table is keyed by `studentId`.
   Tests assert that one child's practice never changes another's data.

## Folder layout

```
content/                 learning content (data only)
  packs/*.json           item packs, auto-loaded
  sources.json           source + license metadata (licensing gate)
  misconceptions.json    catalog of typical mistakes (learner memory keys)
  index.ts               loads and validates everything
src/
  domain/                pure logic, no I/O
    skills/              CEFR scale, skill taxonomy
    curriculum/          Israeli 3/4/5 units mapping (separate layer)
    student/             Student model, LearnerProfile assembly
    content/             content schema, registry, licensing gate
    learning/            ability model, evidence, FSRS, memory, selector,
                         hint ladder, answer checking, projection/replay
  data/                  IndexedDB (Dexie): schema + migrations, LearningStore
  services/
    speech/              tts/ playback/ recording/ recognition/ pronunciation/
    ai/                  AIProvider interface, tutor context
  app/                   composition root, routing, hooks, styles
  features/              screens: students, home, practice, parent, voice-lab
  ui/                    shared components (SpeakButton, En, icons...)
tools/tts-prerender/     offline neural-voice generator (Kokoro), not shipped
docs/                    this file, TTS evaluation
```

## Learning engine

### One scale for everything
Abilities and item difficulties share a logit scale where B1 = 0 and one CEFR
band = 1 logit (`skills/cefr.ts`). An item's difficulty comes from its
authored `level` plus `difficulty` (0..1 inside the band).

### Skill map, not one score
Skills form a tree (`skills/taxonomy.ts`): domain → skill → sub-skill, e.g.
`grammar.past-simple.questions-negatives`. Each `(student, skill)` has its
own belief `N(mu, variance)`. An answer updates the item's skill and its
ancestors (weight × 0.6 per level up). A sub-skill seen for the first time
starts from its parent's estimate.

### Ability model (`learning/ability.ts`)
A one-step Bayesian update of a 3PL IRT model:
`P(correct) = c + (1-c)·sigmoid(theta - b)`, with `c = 1/options` for
multiple choice. Consequences:
- a hard item solved moves the estimate more than an easy one;
- a lucky guess on a 2-option item barely counts;
- `variance` gives an honest confidence for every skill;
- variance grows with time away from a skill (re-check after breaks).

### Evidence (`learning/evidence.ts`)
Interprets behaviour: hints (−0.25 each), retries, explanation shown,
answer revealed, skip (weak evidence, no schedule change), slow answer
(→ FSRS "hard"), suspected guess (very fast correct pick on an item we
predicted as hard → weight 0.4), hesitation (answer changes). Versioned,
pure, replayable.

### Spaced repetition (`learning/srs.ts`)
FSRS via `ts-fsrs` (MIT), fuzz disabled for deterministic replay. Scheduling
unit = "knowledge unit": all items about the word *beautiful* share
`word:beautiful`, so recognition, recall and context practice feed one memory.
Per-unit `modes` keep recognition vs recall apart ("knows *although* in
reading, not in writing").

### Learner memory (`learning/memory.ts`)
Wrong options and known wrong typed answers carry a misconception id
(`quantifiers.much-many`, `present-perfect.hebrew-present`...). Patterns decay
(half-life 21 days) and are repaired by clean successes on items that target
them. Active patterns boost matching items and appear as notes for the
parent and the tutor.

### Item selection (`learning/selector.ts`)
Each candidate gets an explainable score:
- practice: value (due review > new > not due) × difficulty fit (target 75%
  predicted success) × weakness × active-mistake boost × interest boost ×
  prerequisite gap penalty;
- placement: uncertainty × fit at 50%, spread across domains.
The next item is chosen *after* each answer, from the updated state.

### Hint ladder (`learning/exerciseFlow.ts`)
Wrong → hint 1 → hint 2 → explanation → answer. A spelling near miss gets
one free retry. Asking for help when none is left never reveals the answer.

### Language of instruction (`learning/languageSupport.ts`)
Hebrew below A2/B1, mixed (English + Hebrew) around B1, English from B2.
New students start in Hebrew.

## Session modes and games (`src/features/practice/modes.ts`)

Every practice mode and game is a configuration of the same engine:
selection policy (practice / placement), flow policy (`teach` = hint ladder,
`test` = one attempt), feedback (`full` / `brief` / `none`), optional time
limit, and either an adaptive pool or a fixed list.

| Mode | Pool | Flow | Notes |
|---|---|---|---|
| lesson, vocabulary, grammar, reading, listening | adaptive | teach | reading stays on one passage up to 4 questions |
| review | due units | teach | |
| skill | items of one skill subtree | teach | opened from lessons and weak-skill card |
| mistakes | items targeting repeated mistakes or lapsed units | teach | "mistake gym" |
| riddles | tag `riddle` | teach | |
| quiz | all non-passage items | test | 10 items, target 70% |
| lightning | quick vocabulary choice items | test, brief | 60 s, one tap, streak scoring |
| exam | fixed: one passage at track level + vocabulary + grammar | test, none | score per domain |
| daily | fixed per student per day | teach | one per day |

Games log `game.finished`. Every answer in every mode is a normal
`item.completed` event, so games train the same learner model.

## Ranks and achievements (`learning/progression.ts`)

A rank requires XP, remembered words (retrievability >= 0.7) and mastered
sub-skills together. XP alone never raises a rank.

## Lessons

`Lesson` blocks: text, rule, examples (with audio), table, mistake, tip.
`registry.lessonsForSkill` walks up the skill tree, so every exercise can
offer the closest lesson.

## Persistence (`src/data`)

- Dexie schema with append-only version list (`schema.ts`). Never edit a
  version; append one with an `upgrade` and a migration test.
- `LearningStore.completeItem` writes the event and every derived record in
  **one transaction** (tested: a failure leaves no partial state).
- Backup: JSON export/import. Import merges by id (idempotent) and rebuilds
  derived state from events.
- `navigator.storage.persist()` is requested at startup. On iPhone, install
  to the Home Screen: Safari may otherwise clear site data after 7 days of
  no use.

## Speech

```
SpeechService (one playback at a time, fallback chain, UI state)
  ├─ PrerenderedProvider  neural audio files (Kokoro) for fixed content, offline
  ├─ RemoteTtsProvider    home server, OpenAI-compatible /v1/audio/speech
  │                       (e.g. Kokoro-FastAPI), cached in IndexedDB (LRU)
  └─ WebSpeechProvider    device voices, always available, offline
AudioPlayback             plays blobs/urls; separate from generation
Recorder / SpeechRecognizer / PronunciationAssessor   interfaces only
```
Cache key `audioKey(voice, rate, text)` is shared with the pre-render tool.
Audio files are fetched whole and played from memory (Safari's audio element
uses Range requests that a service worker cannot cache reliably). The service
worker caches them on first use (`audio-v1`); the parent screen can download
all of them for offline use.
Slow mode is generated slower by the engine (Kokoro speed 0.8, Web Speech
rate 0.8), never time-stretched. One accent per student; dialogue speakers
A/B map to two fixed voices of that accent. See `docs/TTS-EVALUATION.md`.

## AI

`AIProvider` with `dataLocation` and `costs` metadata. Default `NoAIProvider`.
`buildTutorContext` sends only first name, levels, weak points, active
mistakes, interests. No paid provider is connected without approval.

## Israeli curriculum layer

`domain/curriculum/israel.ts` maps 3/4/5 units to CEFR targets per domain.
Marked `verified: false`: approximate, to be checked against official
Ministry of Education documents before exam-prep use. The engine never
imports it; only the profile uses it for targets.

## Testing

`npm test` (Vitest). Covered: student isolation, persistence across reopen,
atomic writes, replay equivalence, migration v1→v2, backup round-trip and
idempotency, ability model convergence, evidence rules, FSRS behaviour,
selector policy, hint ladder, answer checking, content schema and licensing
gate, speech fallback/stop/cache, tutor context privacy.

## Known limits (Stage 1)

- Writing, speaking and conversation are modeled but not assessed yet.
- Bundle is ~190 KB gzipped (React, zod, FSRS, content). Fine for a PWA; can
  be split later.
- Placement is a short adaptive session; calibration continues during
  normal practice.
