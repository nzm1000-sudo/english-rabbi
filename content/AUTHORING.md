# Content authoring guide

Every learning item is JSON validated at load time
(`src/domain/content/schema.ts`). Run `npx vitest run content` after any
change; it must report zero issues.

## Files

- `content/packs/<pack-id>.json`: `{ "packId", "schemaVersion": 1, "title", "items": [], "passages": [], "lessons": [] }`
- `content/misconceptions/<pack-id>.json`: array of misconceptions added by that pack.
- `content/sources.json`: source and license metadata. All project content uses `"source": "original"`.

## Golden rules

1. **Original text only.** Never copy from textbooks, bagrut exams, websites or songs. Well-known proverbs and idioms are fine.
2. **Exactly one correct answer.** Distractors must be clearly wrong for a teacher, yet tempting for a learner. Read each item and ask: could a native speaker defend another option? If yes, rewrite.
3. **`correctOptionId` is always `"a"`.** The app shuffles options. Ids are `a`, `b`, `c`, `d`.
4. **Gender-neutral Hebrew.** Use infinitives and impersonal forms: "לבחור", "כדאי לשים לב", "משתמשים ב". Never "בחר", "בחרי", "שים לב". For notes about the learner use the slash form "מתבלבל/ת".
5. **Short, clear Hebrew.** Short sentences. No long dashes. English words inside Hebrew are fine (the UI isolates them).
6. **Hints help without giving the answer.** Hint 1 points to the clue. Hint 2 narrows it down. The explanation teaches the rule and says why the answer is right.
7. **Teach Israeli learners.** Contrast with Hebrew when it helps ("בעברית אומרים..., באנגלית...").
8. **Explanations bilingual.** `he` is the main teaching text. `en` is a simple English version of the same idea.

## Levels and tracks

`level` is CEFR. `difficulty` is 0..1 inside the level.
- 3 units: mostly A2, some B1.
- 4 units: mostly B1, some A2 and B2.
- 5 units: B1 and B2, a little C1.

## Item types

### choice
```json
{
  "id": "gr2.perfect.since-2019",
  "type": "choice",
  "skill": "grammar.present-perfect",
  "level": "B1",
  "difficulty": 0.5,
  "prompt": "She has worked here ___ 2019.",
  "audioText": "She has worked here since 2019.",
  "instruction": { "he": "לבחור את התשובה הנכונה", "en": "Choose the correct answer" },
  "options": [
    { "id": "a", "text": "since" },
    { "id": "b", "text": "for", "misconception": "present-perfect.for-since" },
    { "id": "c", "text": "from" }
  ],
  "correctOptionId": "a",
  "hints": [{ "he": "2019 זה משך זמן או נקודת התחלה?", "en": "Is 2019 a length of time or a starting point?" }],
  "explanation": { "he": "since בא עם נקודת התחלה. for בא עם משך זמן.", "en": "since + starting point, for + length of time." },
  "interests": [],
  "tags": ["bagrut"],
  "estimatedTimeSec": 15,
  "source": "original"
}
```
- `prompt` uses `___` (three underscores, once) for a gap.
- `audioText`: the full correct sentence for gap items. The app reads it **after** the answer.
- `promptLanguage: "he"` when the prompt is Hebrew (e.g. Hebrew word, choose English).
- 3 or 4 options. Option texts must be unique.
- `"misconception"` on a wrong option when it reveals a known mistake.

### typed
```json
{
  "id": "gr2.past.irregular.write",
  "type": "typed",
  "skill": "grammar.past-simple.irregular",
  "level": "A2",
  "prompt": "She ___ a letter to her grandmother. (write)",
  "audioText": "She wrote a letter to her grandmother.",
  "instruction": { "he": "להשלים את הפועל בעבר", "en": "Complete with the past form" },
  "answers": ["wrote"],
  "knownErrors": [{ "answer": "writed", "misconception": "past-simple.overregularization", "feedback": { "he": "write הוא פועל חריג.", "en": "write is irregular." } }],
  "hints": [...], "explanation": {...}, "source": "original"
}
```
- Only for answers with **one short form** (a word or two). List every acceptable spelling in `answers`.
- Contractions are normalized automatically (`don't` = `do not`).

### Listening (`"modality": "listen"`)
`audioText` is what the learner hears. `prompt` is the question. The text is hidden until the answer.

### Vocabulary
Use `"unit": "word:<lemma>"` and a `word` object on every item about a word:
`"word": { "lemma": "reliable", "pos": "adjective", "he": "אמין", "example": "He is a reliable friend." }`.
Typical set per word: meaning (`vocabulary.meaning`, English → Hebrew choice, `prompt` = lemma, `audioText` = lemma),
recall (`vocabulary.recall`, typed, `promptLanguage: "he"`, `prompt` = Hebrew), context (`vocabulary.context`, gap sentence).
Recall items add `"alsoSkills": [{ "id": "writing.spelling", "weight": 0.4 }]`.

Words already in the app (do not repeat): happy, kitchen, tomorrow, beautiful, borrow, already, decide, weather, enough, although, achieve, improve, environment, opinion, reliable, consequence, significant, nevertheless.

### Reading
Passages go in `"passages"`:
`{ "id": "passage.<slug>", "title": "...", "level": "B1", "text": "...", "interests": [], "source": "original" }`.
Questions are `choice` items with `"passageId"`. Use skills `reading.details`, `reading.main-idea`,
`reading.inference`, `reading.vocabulary-in-context`, `reading.true-false`, `reading.reference`,
`reading.sequence`, `reading.purpose`, `reading.fact-opinion`. Reference questions quote the phrase:
`The word "they" in "they decided to stay" refers to...`. No line numbers.
Length: A2 120–180 words, B1 200–280, B2 280–380.

### Riddles and fun items
Normal `choice` items tagged `"riddle"`, with a real skill (`vocabulary.meaning`, `reading.inference`, `vocabulary.idioms`...).

### Lessons
In `"lessons"` of a pack:
```json
{
  "id": "lesson.present-perfect",
  "skill": "grammar.present-perfect",
  "level": "B1",
  "title": { "he": "הווה מושלם", "en": "Present Perfect" },
  "goal": "להבין מתי משתמשים ב־Present Perfect ואיך בונים אותו.",
  "blocks": [
    { "kind": "text", "he": "..." },
    { "kind": "rule", "he": "המבנה", "pattern": "have / has + V3" },
    { "kind": "examples", "items": [{ "en": "I have visited Rome.", "he": "ביקרתי ברומא (אי פעם).", "note": "ניסיון חיים" }] },
    { "kind": "table", "head": ["...", "..."], "rows": [["...", "..."]] },
    { "kind": "mistake", "wrong": "I have seen him yesterday.", "right": "I saw him yesterday.", "he": "עם זמן מוגדר בעבר משתמשים ב־Past Simple." },
    { "kind": "tip", "he": "..." }
  ],
  "source": "original"
}
```
4–8 blocks. Hebrew explanation first, English examples always.

## Skills (use these ids only)
- `vocabulary` (A1): Vocabulary
- `grammar` (A1): Grammar
- `reading` (A1): Reading
- `writing` (A1): Writing
- `listening` (A1): Listening
- `speaking` (A1, not auto-assessed): Speaking
- `vocabulary.meaning` (A1): Word meaning
- `vocabulary.recall` (A1): Word recall
- `vocabulary.context` (A2): Words in context
- `vocabulary.synonyms-antonyms` (A2): Synonyms and antonyms
- `vocabulary.collocations` (B1): Collocations
- `vocabulary.word-formation` (B1): Word formation
- `vocabulary.phrasal-verbs` (B1): Phrasal verbs
- `vocabulary.idioms` (B2): Idioms and expressions
- `grammar.present-simple` (A1): Present Simple
- `grammar.present-simple.third-person` (A1): Present Simple: third person -s
- `grammar.present-simple.questions-negatives` (A1): Present Simple: questions and negatives
- `grammar.present-progressive` (A1): Present Progressive
- `grammar.past-simple` (A2): Past Simple
- `grammar.past-simple.irregular` (A2): Past Simple: irregular verbs
- `grammar.past-simple.questions-negatives` (A2): Past Simple: questions and negatives
- `grammar.past-progressive` (A2): Past Progressive
- `grammar.future` (A2): Future (will / going to)
- `grammar.present-perfect` (B1): Present Perfect
- `grammar.present-perfect.vs-past-simple` (B1): Present Perfect vs Past Simple
- `grammar.past-perfect` (B2): Past Perfect
- `grammar.conditionals` (B1): Conditionals
- `grammar.conditionals.first` (B1): First conditional
- `grammar.conditionals.second` (B1): Second conditional
- `grammar.conditionals.third` (B2): Third conditional
- `grammar.passive` (B1): Passive voice
- `grammar.modals` (A2): Modal verbs
- `grammar.relative-clauses` (B1): Relative clauses
- `grammar.gerunds-infinitives` (B1): Gerunds and infinitives
- `grammar.articles` (A1): Articles
- `grammar.prepositions` (A1): Prepositions
- `grammar.quantifiers` (A2): Quantifiers
- `grammar.comparatives` (A2): Comparatives and superlatives
- `grammar.word-order` (A1): Word order
- `grammar.connectors` (B1): Linking words
- `grammar.pronouns` (A1): Pronouns and possessives
- `grammar.there-is` (A1): There is / there are
- `grammar.plurals` (A1): Plural nouns
- `grammar.adverbs` (A2): Adverbs
- `grammar.used-to` (A2): Used to
- `grammar.present-perfect-progressive` (B1): Present Perfect Progressive
- `grammar.modals.deduction` (B2): Modals of deduction
- `grammar.reported-speech` (B1): Reported speech
- `grammar.question-tags` (B1): Question tags
- `grammar.wish` (B2): Wish and if only
- `reading.details` (A1): Finding details
- `reading.main-idea` (A2): Main idea
- `reading.inference` (B1): Inference
- `reading.vocabulary-in-context` (A2): Vocabulary in context
- `reading.true-false` (A1): True / false
- `reading.reference` (A2): Reference words
- `reading.sequence` (A2): Sequence of events
- `reading.purpose` (B1): Writer's purpose
- `reading.fact-opinion` (B1): Fact or opinion
- `writing.sentence` (A1, not auto-assessed): Writing a sentence
- `writing.paragraph` (A2, not auto-assessed): Writing a paragraph
- `writing.message-email` (A2, not auto-assessed): Messages and emails
- `writing.opinion` (B1, not auto-assessed): Opinion paragraph
- `writing.spelling` (A1): Spelling
- `listening.words` (A1): Recognizing words
- `listening.sentences` (A2): Understanding sentences
- `listening.dialogues` (B1): Understanding dialogues
- `speaking.pronunciation` (A1, not auto-assessed): Pronunciation
- `speaking.conversation` (A2, not auto-assessed): Conversation

## Existing misconceptions
- `quantifiers.much-many`: Confuses much and many
- `past-simple.overregularization`: Adds -ed to irregular verbs (goed, buyed)
- `past-simple.did-plus-past`: Uses a past verb after did
- `present-simple.missing-s`: Forgets -s with he / she / it
- `present-simple.do-does`: Confuses do and does
- `present-perfect.hebrew-present`: Uses the Present Simple for something that continues until now (as in Hebrew)
- `present-perfect.with-past-time`: Uses the Present Perfect with a finished time (yesterday, last year)
- `present-perfect.past-participle`: Uses the past form instead of the past participle after have
- `present-perfect.for-since`: Confuses for and since
- `conditionals.will-in-if-clause`: Puts will after if
- `relative.which-for-people`: Uses which for people
- `gerund-infinitive.choice`: Mixes up -ing and to after verbs
- `articles.missing-a`: Leaves out a before a job or a single thing (as in Hebrew)
- `articles.a-an`: Confuses a and an
- `prepositions.time`: Confuses in, on and at for time
- `comparatives.double`: Combines more with -er (more easier)
- `word-order.adjective-after-noun`: Puts the adjective after the noun (as in Hebrew)
- `connectors.contrast-cause`: Confuses contrast (although) with cause (because)
- `passive.form`: Builds the passive without be or without the past participle
- `past-progressive.interrupted`: Does not use the Past Progressive for an interrupted action
- `vocabulary.borrow-lend`: Confuses borrow and lend
- `listening.vowel-length`: Does not hear short vs long vowels (ship / sheep)

A new misconception must be added to `content/misconceptions/<pack-id>.json` and used by at least one item:
`{ "id": "domain.short-name", "skill": "<skill id>", "note": { "he": "...", "en": "..." }, "tip": { "he": "...", "en": "..." } }`.

## Interests
music, sports, fashion, technology, games, movies, school, travel, food, animals, science, books.

## Tags
`bagrut` (exam-style), `riddle`, `idiom`, `phrasal`, `minimal-pairs`, `dictation`, `connector`.

## New content types (stories, translation, spot the mistake, chunks, word families)

`content/examples/new-types.json` has one valid example of each new shape (not loaded by the app; copy it into `content/packs/` to validate it).
Validate a pack with `PACK=<pack-id> npx vitest run tools/validate-pack.test.ts`.

### Stories (`"stories": [...]` in a pack)
- `kind: "read"`: narration lines without `speaker`. `kind: "dialogue"`: every line has `speaker` `"A"` (female voice) or `"B"` (male voice), and `cast` names them.
- Every line has `en` and a natural Hebrew translation `he`.
- `glossary`: one entry for **every** word in the lines, except the words in `STORY_STOPWORDS` (schema.ts). Key: the word lowercase as written, without punctuation (`"puts"`, `"didn't"`, `"grandma's"` or just `"grandma"`). Value: `lemma` (dictionary form) and `he` (the meaning **in this sentence**). No unused entries.
- `questions`: 2 to 4 `choice` items, each shown after line `after` (0-based). Ids `<story-id>.q1`...
- Graded: A1 lines up to 8 words, A2 up to 12, B1 up to 16, B2 up to 22. Mostly words a learner at that level knows.
- Religious, warm, family content (Shabbat, holidays, mitzvot, chesed, Torah learning). Never invent halachic rulings.

### Translation (tag `"translate"`)
- `typed` or `order` with `promptLanguage: "he"` and a Hebrew `prompt`.
- `typed.answers`: **every** natural English translation a teacher would accept. Case, end punctuation, commas and contractions (I'm / I am) are ignored by the checker, so list only real wording variants (Mom / My mom / Mother, on Friday / every Friday...).
- `audioText`: the first accepted answer.

### Spot the mistake (`type: "fix"`)
- `sentence` has exactly one wrong word, a typical mistake of Hebrew speakers. `wrongIndex`: its position (0-based, split on spaces). `correction`: the right word ("" to delete it). `corrected`: the fixed sentence. `audioText` equals `corrected`.
- `distractors`: 2-3 replacements that are wrong in this sentence.
- No other single-word change may produce a sentence a teacher would accept. With agreement mistakes use a name or noun subject ("Dan go"), not a pronoun ("He go" can also become "They go").

### Chunks (tag `"chunk"`) and word families (tag `"family"`)
- Regular `choice` / `typed` items. Chunks: skill `vocabulary.collocations`, unit `chunk:<chunk>`. Families: skill `vocabulary.word-formation`, unit `family:<base word>`.
