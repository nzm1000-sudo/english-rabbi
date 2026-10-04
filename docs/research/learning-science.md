# Learning science audit: how the app teaches and schedules practice

Date: 2026-10-04. Scope: the 9+ main app (bagrut 3/4/5 units) and the kids area (ages 3-8).
Method: literature review (meta-analyses and reviews first), a read of the selection, scheduling,
evidence and feedback code, content statistics computed from `content/packs/*.json`, and a
simulation of the real selector and FSRS code over 30 and 90 days (described in section C.1).
No code or content was changed for this report.

How to read the evidence labels: **strong** = several meta-analyses agree, including classroom
studies; **moderate** = a meta-analysis or several controlled studies, but with real moderators or
mostly adult/lab samples; **limited** = few studies, theory, or evidence from a different population.
Every DOI below was checked against Crossref on 2026-10-04. Where I am not sure of a number, I say so.

---

## (a) One-page summary

**What the app already does well.** It is built on the right ideas. Every exercise is a retrieval
attempt, not re-reading. Spacing is handled by FSRS, a modern, well-benchmarked scheduler. Items are
chosen adaptively from an explainable IRT-based learner model. Wrong answers carry misconception ids,
so feedback and later practice can target the learner's own errors. There is a hint ladder before the
answer, a pretest before lessons, a "mistake gym", a streak freeze, Hebrew support that fades as
ability grows, and ranks that need remembered words, not just points. Few commercial apps have this
foundation.

**Where it falls short.** The simulation shows that the parts do not yet add up to what the evidence
recommends:

1. **The same few items come back again and again, as identical questions.** 86% of the 1,746
   scheduling units are a single item (`item:<id>`), so a "review" is the same sentence with the same
   options. In a simulated A2 learner doing the daily lesson for 30 days, 360 presentations covered only
   109 of 2,139 items; 40% of each day's items had already been shown the day before; over 90 days one
   item was shown 23 times. Repeating an identical item mostly trains memory for that item; transfer to
   new sentences needs varied retrieval.
2. **Errors do not reset the schedule.** A first-attempt error followed by a correct answer (after a
   hint, or by eliminating options) is graded `hard`, not `again`. On a mature card FSRS then *extends*
   the interval (7 → 22 → 49 days in the simulation). Meanwhile a new card that keeps getting `hard`
   never leaves the learning step (interval stays ~0 days), so it is due in every session. Both effects
   are the opposite of what spacing research wants.
3. **The selector strongly favours multiple choice over production.** Predicted success includes the
   guessing chance, and only candidates within 10% of the top score are sampled. For a new learner the
   top 100 candidates are all `choice`; typed recall, sentence building and spot-the-mistake almost never
   appear in the daily lesson (0 of 1,080 sentence-builder presentations in the 90-day run; 87% choice
   overall). Production and generation give larger, more durable gains than recognition.
4. **Little interleaving across domains in the daily lesson.** 83% of lesson items were vocabulary;
   reading and listening together were under 4% for an A2 learner.
5. **Retry is immediate and massed.** "Practice the mistakes again" re-asks the exact items seconds
   after the answer was shown; it measures short-term memory of the feedback.
6. **Kids games have no spaced re-exposure.** The picture game always puts unknown and due words
   together and takes 6 of them; letters, sight words and word building are random every time and are
   not tracked. Young children learn words from repeated, spaced exposure.
7. **Content is thin where it matters.** 16 of 59 skills have under 10 items; only ~176 vocabulary
   words have their own units; 14 passages (5 at B1) for an exam that needs a fresh unseen passage
   every time.

**Top changes (detail and ranking in section D).**
1. Grade a first-attempt error as `again`; stop the `hard` loop in learning steps (S, safe now).
2. Review rules and words through a *different* item of the same unit/skill instead of the same item;
   penalise items already seen many times (M, safe now).
3. Remove the guessing bias and add a production share to selection (S, safe now).
4. Give each session a fixed recipe: reviews, new items, mistakes, at least 3 domains, at least 30%
   production (M, safe now).
5. Replace immediate retry with a delayed in-session re-test of a sibling item (M, safe now).
6. Leech handling: after repeated failures, teach (lesson card, different item type), then pause the
   item (S, safe now).
7. Kids: 2 new + 4 review words per round, track letters/sight words, make stickers less contingent
   (M, safe now).

All seven can be built without changing the data schema: derived state is a replayable projection of
the event log (`src/data/store.ts` `rebuildDerived`), so a new evidence or scheduling rule can be
applied to past events by bumping `EVIDENCE_MODEL_VERSION` and rebuilding.

---

## (b) Principles and evidence

### 1. Retrieval practice (the testing effect)
- **What.** Recalling information strengthens memory more than studying it again.
- **Evidence: strong.** Rowland (2014) meta-analysis: g = 0.50 vs restudy
  ([doi](https://doi.org/10.1037/a0037559)). Adesope, Trevisan & Sundararajan (2017): practice tests beat
  all comparison conditions, g = 0.61 overall
  ([doi](https://doi.org/10.3102/0034654316689306)). Yang et al. (2021), 222 classroom studies,
  g = 0.50 ([doi](https://doi.org/10.1037/bul0000309)). Agarwal, Nunes & Blunt (2021) review of
  applied K-12 and university studies ([doi](https://doi.org/10.1007/s10648-021-09595-9)). Dunlosky
  et al. (2013) rate practice testing "high utility" ([doi](https://doi.org/10.1177/1529100612453266)).
  Roediger & Karpicke (2006) ([doi](https://doi.org/10.1111/j.1467-9280.2006.01693.x)); Karpicke &
  Roediger (2008) showed that dropping items from *testing* once recalled sharply reduced week-later
  recall, while dropping them from *study* did not
  ([doi](https://doi.org/10.1126/science.1152408)).
- **Conditions.** Larger with feedback, with more retrievals, and when the final test matches the
  practice format (Yang et al. 2021). Works for children (Agarwal et al. 2021).
- **Transfer.** Retrieval transfers to new questions and contexts, d = 0.40 (Pan & Rickard 2018,
  [doi](https://doi.org/10.1037/bul0000151)); transfer is larger when initial retrieval succeeds and
  when practice is elaborated (feedback beyond the bare answer). Butler (2010) found repeated testing
  improves transfer to new inference questions ([doi](https://doi.org/10.1037/a0019902)).
- **For the app.** Every item is already retrieval, which is right. But a review should rarely be the
  *identical* question: the goal for grammar is the rule, so review with new sentences.

### 2. Spacing (distributed practice) and scheduling
- **What.** Reviews separated in time beat the same number of reviews massed together.
- **Evidence: strong.** Cepeda et al. (2006) review of 317 experiments
  ([doi](https://doi.org/10.1037/0033-2909.132.3.354)). Cepeda et al. (2008): the best gap grows with
  the retention interval, and as a fraction of it shrinks (roughly 20-40% of a one-week interval, about
  5-10% of a one-year interval) ([doi](https://doi.org/10.1111/j.1467-9280.2008.02209.x)). Latimier,
  Peyre & Ramus (2021): spaced vs massed retrieval g = 0.74; expanding vs equal intervals g = 0.034,
  no reliable difference ([doi](https://doi.org/10.1007/s10648-020-09572-8)). Kang (2016) policy
  review ([doi](https://doi.org/10.1177/2372732215624708)). Carpenter, Pan & Butler (2022) review
  ([doi](https://doi.org/10.1038/s44159-022-00089-1)).
- **L2-specific.** Kim & Webb (2022), 48 L2 experiments: medium-to-large spacing effect; longer
  spacing better at delayed tests; equal and expanding spacing equivalent
  ([doi](https://doi.org/10.1111/lang.12479)). Nakata (2015): small advantage for expanding spacing
  in L2 vocabulary, but *amount* of spacing matters more
  ([doi](https://doi.org/10.1017/S0272263114000825)). Kornell (2009): one large flashcard stack
  (more spacing) beat several small stacks, yet 72% of learners believed the opposite
  ([doi](https://doi.org/10.1002/acp.1537)).
- **Children.** Vlach, Sandhofer & Kornell (2008), 3-year-olds learned category labels better from
  spaced than massed exemplars ([doi](https://doi.org/10.1016/j.cognition.2008.07.013)). Vlach &
  Sandhofer (2012), ages 5-7, spaced science lessons improved generalisation
  ([doi](https://doi.org/10.1111/j.1467-8624.2012.01781.x)). Childers & Tomasello (2002), 2-year-olds
  learned novel words better from distributed exposures
  ([doi](https://doi.org/10.1037/0012-1649.38.6.967)). Knabe & Vlach (2020) caution that the size of
  the benefit varies with age and individual differences in children
  ([doi](https://doi.org/10.1016/j.jarmac.2020.07.007)).
- **Schedulers.** FSRS's lineage is published (Ye, Su & Cao 2022, KDD,
  [doi](https://doi.org/10.1145/3534678.3539081)); Duolingo's half-life regression (Settles & Meeder
  2016, [doi](https://doi.org/10.18653/v1/P16-1174)) shows the value of fitting per-learner forgetting.
  FSRS's accuracy claims come from an open benchmark, not peer review
  ([open-spaced-repetition/srs-benchmark](https://github.com/open-spaced-repetition/srs-benchmark)).
- **For the app.** FSRS with retention 0.9 and a 365-day cap is a sound choice for a school year. The
  risks are in what is fed to it (grades) and what counts as a "unit" (section C).

### 3. Successive relearning and how many retrievals
- **Evidence: moderate (mostly university students).** Rawson & Dunlosky (2011): practising to a
  criterion of about three correct recalls in the first session, then relearning in later sessions,
  gave durable and efficient learning; extra initial retrievals had diminishing returns
  ([doi](https://doi.org/10.1037/a0023956)). Pyc & Rawson (2009): harder (longer-lag) *successful*
  retrievals help more ([doi](https://doi.org/10.1016/j.jml.2009.01.004)). Nakata (2016), L2 words:
  5-7 within-session retrievals beat 1-3, but per minute of practice one retrieval was most efficient
  ([doi](https://doi.org/10.1017/S0272263116000280)).
- **For the app.** Within a session, a new or missed unit should be retrieved again after several
  other items (a short lag), not immediately; then across days by FSRS. One or two in-session
  retrievals per unit is the efficient point.

### 4. Interleaving vs blocking
- **What.** Mixing problem types in practice instead of doing one type in a block.
- **Evidence: moderate, with clear moderators.** Brunmair & Richter (2019), 59 studies: g = 0.42
  overall; best when categories are *similar to each other* and easy to confuse; for word-list
  materials blocking was better (g = -0.39)
  ([doi](https://doi.org/10.1037/bul0000209); [preprint](https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf)).
  Rohrer & Taylor (2007) ([doi](https://doi.org/10.1007/s11251-007-9015-8)) and Rohrer, Dedrick &
  Stershic (2015) classroom maths ([doi](https://doi.org/10.1037/edu0000001)). Kornell & Bjork (2008)
  ([doi](https://doi.org/10.1111/j.1467-9280.2008.02127.x)).
- **L2.** Nakata & Suzuki (2019): interleaving five English grammar structures caused more errors in
  training but better 1-week retention; lower-knowledge learners benefited more
  ([doi](https://doi.org/10.1111/modl.12581)). Pan et al. (2019): interleaving Spanish preterite vs
  imperfect helped only when practice ran over more than one session
  ([doi](https://doi.org/10.1037/edu0000336)).
- **For the app.** Interleave *confusable* grammar (present perfect vs past simple, for/since,
  much/many, tenses) and mix domains in the daily lesson. A short blocked introduction right after a
  lesson is fine ("skill" mode), then interleave. For brand-new vocabulary the evidence does not favour
  interleaving within a session.

### 5. Desirable difficulties and the target success rate
- **What.** Conditions that slow initial performance (spacing, interleaving, retrieval, generation) often
  improve long-term learning; performance during practice is a poor guide to learning (Bjork & Bjork
  2011, [pdf](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf);
  Soderstrom & Bjork 2015, [doi](https://doi.org/10.1177/1745691615569000)).
- **Condition.** A difficulty is desirable only if the learner can respond to it successfully. For
  young or weak learners too much difficulty is harmful (Knabe & Vlach 2020).
- **Target accuracy.** There is no settled "right" rate for children. Wilson et al. (2019) derive about
  85% for gradient-descent learners in binary tasks ([doi](https://doi.org/10.1038/s41467-019-12552-4));
  that is a model result, not a classroom finding. The app's 75% target is a reasonable middle, but it
  should apply to the learner's *knowledge*, not to a score inflated by guessing.

### 6. Errorful learning, pretesting and the hint ladder
- **Evidence: moderate (mostly adults).** Metcalfe (2017) review: errors followed by corrective
  feedback help learning; high-confidence errors are corrected best
  ([doi](https://doi.org/10.1146/annurev-psych-010416-044022); Butterfield & Metcalfe 2001,
  [doi](https://doi.org/10.1037/0278-7393.27.6.1491)). Kornell, Hays & Bjork (2009): failed retrieval
  attempts improve later learning when the answer follows
  ([doi](https://doi.org/10.1037/a0015729)). Richland, Kornell & Kao (2009): pretesting improves
  learning even when pretest answers are wrong ([doi](https://doi.org/10.1037/a0016496)).
- **Limits.** The key condition is feedback. Without it, multiple-choice lures can be learned as facts
  (Roediger & Marsh 2005, [doi](https://doi.org/10.1037/0278-7393.31.5.1155)); feedback removes most
  of that cost (Butler & Roediger 2008, [doi](https://doi.org/10.3758/MC.36.3.604)). Evidence for
  very young children is thin; gentle, errorless-leaning designs are reasonable for ages 3-6.
- **For the app.** The "teach, don't solve" ladder fits this. But on choice items, wrong options are
  disabled after each try (`ExerciseView.tsx:517`), so a learner can reach "correct" by elimination; that
  must not count as a successful retrieval for scheduling.

### 7. Generation and production vs recognition
- **Evidence: strong for the effect, moderate for its size in L2.** Slamecka & Graf (1978)
  ([doi](https://doi.org/10.1037/0278-7393.4.6.592)); Bertsch et al. (2007) meta-analysis d = 0.40
  ([doi](https://doi.org/10.3758/BF03193441)). Kang, Gollan & Pashler (2013): retrieval of L2 words
  beat imitation ([doi](https://doi.org/10.3758/s13423-013-0450-z)). Laufer & Goldstein (2004):
  recognition is easier than recall in a stable hierarchy, and *passive recall* (L2 word → meaning)
  best predicted classroom performance ([doi](https://doi.org/10.1111/j.0023-8333.2004.00260.x)).
  Hulstijn & Laufer (2001): tasks with more involvement (need, search, evaluation; e.g. writing with
  the word) gave better retention than reading alone
  ([doi](https://doi.org/10.1111/0023-8333.00164); theory: Laufer & Hulstijn 2001,
  [doi](https://doi.org/10.1093/applin/22.1.1)).
- **Multiple choice is not useless.** Little et al. (2012): with plausible distractors, MC triggers real
  retrieval ([doi](https://doi.org/10.1177/0956797612443370)). It is fast, so it is good for breadth and
  first exposures.
- **For the app.** Keep MC for first encounters, meaning checks and speed games; move each unit toward
  production (typed recall, translation, spot-the-mistake with a typed fix) as it matures.

### 8. Feedback: content and timing
- **Evidence: strong for feedback, mixed for timing.** Hattie & Timperley (2007): feedback about the
  task, the process and self-regulation helps; praise of the self ("good girl", "smart") helps least
  ([doi](https://doi.org/10.3102/003465430298487)). Wisniewski, Zierer & Hattie (2020), 435 studies,
  d = 0.48, larger when feedback carries more information
  ([doi](https://doi.org/10.3389/fpsyg.2019.03087)). Shute (2008) review
  ([doi](https://doi.org/10.3102/0034654307313795)). Pashler et al. (2005): for word learning, feedback
  mattered after errors; after correct answers it added little
  ([doi](https://doi.org/10.1037/0278-7393.31.1.3)). Mueller & Dweck (1998): praising children's
  intelligence lowered persistence after failure; praising effort did not
  ([doi](https://doi.org/10.1037/0022-3514.75.1.33)).
- **Timing.** Kulik & Kulik (1988): classroom studies with real materials usually favour immediate
  feedback; lab studies often favour delayed ([doi](https://doi.org/10.3102/00346543058001079)). Butler,
  Karpicke & Roediger (2007) found delayed feedback better in a lab MC study
  ([doi](https://doi.org/10.1037/1076-898X.13.4.273)). For a children's app, immediate feedback plus a
  *delayed re-test* is the practical reading.
- **L2 corrective feedback.** Li (2010): medium overall effect, maintained over time
  ([doi](https://doi.org/10.1111/j.1467-9922.2010.00561.x)); Lyster & Saito (2010) on oral feedback
  ([doi](https://doi.org/10.1017/S0272263109990520)). Norris & Ortega (2000): explicit instruction
  produces large, durable gains ([doi](https://doi.org/10.1111/0023-8333.00136)).
- **For the app.** The current feedback (answer, rule, "why not the others", anchor card) is good.
  Improve coverage of distractor-specific feedback and make praise about process.

### 9. Cognitive load, worked examples, expertise reversal, dual coding
- **Evidence: moderate to strong.** Sweller (1988) ([doi](https://doi.org/10.1207/s15516709cog1202_4)).
  Kalyuga et al. (2003): guidance that helps novices can hurt more advanced learners
  ([doi](https://doi.org/10.1207/S15326985EP3801_4)). Mayer & Moreno (2003): ways to reduce load in
  multimedia, e.g. avoid redundant on-screen text with narration, signal key parts
  ([doi](https://doi.org/10.1207/S15326985EP3801_6)). Clark & Paivio (1991) dual coding
  ([doi](https://doi.org/10.1007/BF01320076)).
- **For the app.** The fading of Hebrew support with ability (`languageSupport.ts:9-13`) is a good
  example of expertise reversal in practice. Hints could also fade: fewer and later hints for
  learners with high mastery of the skill. Kids area: picture + spoken word is dual coding done right.

### 10. Motivation, rewards, streaks and gamification
- **Evidence: moderate.** Self-determination theory: autonomy, competence and relatedness
  (Ryan & Deci 2000, [doi](https://doi.org/10.1037/0003-066X.55.1.68)). Deci, Koestner & Ryan (1999):
  expected tangible rewards lowered free-choice intrinsic motivation (engagement-contingent
  d = -0.40, completion-contingent d = -0.36, performance-contingent d = -0.28), more so for children;
  verbal rewards enhanced it less for children than for adults
  ([doi](https://doi.org/10.1037/0033-2909.125.6.627)). Lepper, Greene & Nisbett (1973): preschoolers
  who expected a certificate for drawing later drew less in free play
  ([doi](https://doi.org/10.1037/h0035519)). Sailer & Homner (2020): gamification has small positive
  effects (cognitive g = .49, motivational g = .36, behavioural g = .25), the motivational ones less
  stable ([doi](https://doi.org/10.1007/s10648-019-09498-w)). Hanus & Fox (2015): a badge/leaderboard
  course lowered intrinsic motivation and exam scores over a semester
  ([doi](https://doi.org/10.1016/j.compedu.2014.08.019)). Silverman & Barasch (2022): an intact logged
  streak increases continued engagement, a broken one decreases it, and a way to "repair" a streak
  softens the drop ([doi](https://doi.org/10.1093/jcr/ucac029)).
- **For the app.** The streak freeze is well supported. Ranks gated by remembered words and mastered
  skills are good (competence feedback, not just effort). Watch the per-round sticker in the kids area
  (an expected, contingent tangible reward) and XP that pays more for not using hints.

### 11. Second-language acquisition principles
- **Comprehensible input and extensive reading/listening.** Krashen's input hypothesis is influential
  but more theory than tested result ([book pdf](http://www.sdkrashen.com/content/books/principles_and_practice.pdf)).
  The empirical support is for *extensive reading*: Jeon & Day (2016), 49 studies, d = 0.46 (group
  contrasts) and 0.71 (pre-post), larger for longer programmes
  ([RFL](https://nflrc.hawaii.edu/rfl/item/354)); Nakanishi (2015)
  ([doi](https://doi.org/10.1002/tesq.157)) reports positive effects too (its exact per-outcome numbers
  I have only from secondary sources, so I do not quote them).
- **Noticing.** Schmidt (1990): attention to form is needed for intake
  ([doi](https://doi.org/10.1093/applin/11.2.129)). Explicit focus on form works (Norris & Ortega 2000).
- **Vocabulary size and depth.** Nation (2006): 98% text coverage needs 8,000-9,000 word families for
  reading and 6,000-7,000 for listening ([doi](https://doi.org/10.3138/cmlr.63.1.59)). Webb (2007): more
  encounters (1, 3, 7, 10) built more aspects of word knowledge
  ([doi](https://doi.org/10.1093/applin/aml048)). Uchihara, Webb & Yanagisawa (2019): repetition-
  learning correlation r = .34, moderated by spacing and engagement
  ([doi](https://doi.org/10.1111/lang.12343)). Webb, Yanagisawa & Uchihara (2020): intentional activities
  (flashcards, lists, writing, gap-fill) gave ~60% immediate but only 39% (meaning recall) and 25%
  (form recall) delayed gains, so one round of practice is far from enough
  ([doi](https://doi.org/10.1111/modl.12671)).
- **Formulaic language.** Boers & Lindstromberg (2012) review: deliberate attention to chunks and
  collocations helps ([doi](https://doi.org/10.1017/S0267190512000050)). The app's chunk and family
  packs fit this.
- **Israeli curriculum.** The Ministry of Education publishes Band I (end of grade 6), Band II (end of
  grade 9) and Band III Core lists for the bagrut
  ([Ministry page](https://pop.education.gov.il/tchumey_daat/english/chativa-elyona/bagrut-exam/teachers-resource-materials/)).
  I could not extract the list sizes from the PDF; they should be imported and compared with the app's
  words (section E).

### 12. Young children (3-8)
- Repeated reading of the *same* storybooks led 3-year-olds to learn more words than hearing different
  books with the same words (Horst, Parsons & Bryan 2011, [doi](https://doi.org/10.3389/fpsyg.2011.00017)).
- Spacing helps children (section 2), but the evidence base is small and individual differences are
  large (Knabe & Vlach 2020).
- Expected tangible rewards are riskier for children than for adults (Deci et al. 1999; Lepper et al.
  1973).
- Children's apps research is thin for second languages; most of what follows for the kids area is an
  inference from the general findings above, and I label it as such.

---

## (c) Audit of the app

### C.1 Simulation method (so the numbers below can be checked)

A throwaway test (not committed, in the session scratchpad) ran the real `pickNext`
(`src/domain/learning/selector.ts:171`), `MODES` pools (`src/features/practice/modes.ts`) and
`projectCompletion` (`src/domain/learning/projection.ts:94`, which calls FSRS) over the real content.
One session per day; 20 s per item. The simulated learner answers with IRT probability from a fixed
true ability plus a memory boost per unit that grows with successes (0.6 + 0.5 per success, capped at
2.5 logits). It never uses hints. Results, daily "lesson" (12 items):

| Learner | Days | Presentations | Distinct items | Shown also the day before | Max repeats of one item | choice / typed / fix / order |
|---|---|---|---|---|---|---|
| A2 (θ = -1) | 30 | 360 | 109 | 40% | 10 | 315 / 34 / 11 / 0 |
| B1 (θ = 0) | 30 | 360 | 114 | 38% | 8 | 298 / 56 / 6 / 0 |
| B2 (θ = 1) | 30 | 360 | 118 | 39% | 8 | 311 / 46 / 3 / 0 |
| A2 (θ = -1) | 90 | 1,080 | 211 | 36% | 23 | 961 / 93 / 26 / 0 |

Grammar mode (8 items, B1 learner, 30 days): 59 distinct items in 240 presentations, 47% shown the day
before, max 13. With a learner who does *not* improve with repetition, one item reached 19 showings in
30 days. Domain mix of the A2 lesson: vocabulary 83%, grammar 14%, reading 2.5%, listening 0.8%.

Limits: the learner model is crude, never uses hints and never skips (both of which make repetition
*worse*, see C.3), and real children do not practise every day. Treat the numbers as directional.

### C.2 What the app does well against the evidence

| Practice | Where | Evidence |
|---|---|---|
| Every exercise is retrieval with feedback | `ExerciseView.tsx`, `exerciseFlow.ts` | §1, §8 |
| FSRS spacing per knowledge unit; vocabulary items share `word:<lemma>` | `srs.ts:31`, `schema.ts:34-39`, `AUTHORING.md:85-90` | §2 |
| Next item chosen after every answer from updated state | `useSession.ts:112-162` | adaptive practice |
| IRT model with guessing parameter; suspected guesses down-weighted | `ability.ts:46-57`, `evidence.ts:78-89` | measurement |
| Hint ladder: hint 1, hint 2, explanation, then answer; near-miss spelling gets a free retry | `exerciseFlow.ts:58-104` | §6 |
| Distractors carry misconception ids; patterns decay (21-day half-life) and are repaired by clean successes | `memory.ts:27-70`, `projection.ts:86-92` | §6, §8 |
| Pretest before a lesson ("guess before the explanation") | `modes.ts:149-158`, `LearnHub.tsx:77-83` | §6 (Richland 2009) |
| Feedback strip shows the answer and rule; "why not the others" per option; anchor card | `ExerciseView.tsx:706-860` | §8 |
| Hebrew support fades with ability | `languageSupport.ts:9-13`, `profile.ts:163` | §9 (expertise reversal) |
| Recognition vs recall tracked per word; "recognised but not produced" reported | `projection.ts:136-142`, `profile.ts:127-131` | §7 |
| Ranks need remembered words and mastered skills, not only XP | `progression.ts:5-52` | §10 |
| Streak freeze (one missed day per week) | `profile.ts:206-251` | §10 (Silverman & Barasch 2022) |
| Answer saved before feedback; tests cannot be retried | `useSession.ts:236-268` | assessment validity |
| Exam: one unseen passage + vocabulary + grammar at track level | `modes.ts:231-251` | bagrut alignment |
| Kids: picture + spoken word, gentle "try again", hint after 2 wrong taps, daily time limit, graded books | `KidsPlay.tsx:193-300`, `timeLimit.tsx` | §9, §12 |
| Memory game scoring that rewards remembering, not finishing | `games.ts:141-155` | effort-based reward |

### C.3 Where it falls short

**1. Errors are graded `hard`, not `again` (scheduling).**
`evidence.ts:59`: `grade = helped ? (o.explanationShown ? 'again' : 'hard') : 'good'`. A first answer that
was wrong, followed by a correct one after a hint or after options were eliminated
(`ExerciseView.tsx:517` disables tried options), is `hard`. In FSRS `hard` on a review card is a pass:
the simulated sequence good, good, hard, hard, hard gave intervals 0.01, 7, 22, 49, 86 days. So a word
the child got wrong comes back in three weeks. Evidence (§1, §3): a failed retrieval should be followed
by a short-interval re-test. Also `slow` and `possible-guess` set `hard` (`evidence.ts:69, 88`).

**2. `hard` in the learning step is a loop.**
With ts-fsrs 5.4.2 defaults (short-term learning steps on), a new card graded `hard` stays in its
learning step: four daily `hard` grades in a row left the interval at about 0 days each time. Any
learner who habitually uses a hint or answers slowly on a new item sees that item in *every* session
(the selector gives due/overdue units value 1.0-1.5, `selector.ts:128-132`, vs 0.6 for new material,
`selector.ts:126`). This is a likely cause of "the same few items again".

**3. Review = the identical item.**
1,497 of 1,746 units (86%) contain one item; only vocabulary words (176 units), chunks and families
share units. A due grammar unit can only be reviewed by re-showing the same sentence with the same
options (`selector.ts:123-135`). The 30-day simulation shows 40% of each day's lesson items were shown
the day before. Evidence §1 (transfer, Pan & Rickard 2018; Butler 2010) favours varied retrieval for
rules; identical repetition invites memorising the item.

**4. Guessing inflates predicted success, so choice wins.**
`selector.ts:110-112` computes fit on `expectedSuccess(..., guessChance(item))`. For a learner at the
prior, a 3-option item at its own level predicts ~0.67+ and fits the 0.75 target; a typed item at the
same level predicts ~0.4 and fits poorly. Combined with sampling only within 10% of the top score
(`selector.ts:176`), the top 100 candidates for a new learner are all `choice`; the best typed item is
ranked 264th, the best sentence-builder 267th. In the simulations, the 474 sentence-builder items were
never chosen by the lesson. Evidence §7: production/generation gives more durable learning.

**5. The weakness factor favours higher-level skills.**
`selector.ts:137-139` multiplies by `1 + 0.6 * (1 - mastery)` where mastery is measured against the
*skill's* own CEFR level. Skills tagged A1 (word order, articles, prepositions, present simple) look
"mastered" sooner and lose to B1/B2 skills even for an A2 learner. All 474 order items are tagged
`grammar.word-order` (A1), which partly explains why they never appear.

**6. No domain or type mix in practice mode.**
Domain spreading exists only for placement (`selector.ts:121`). The daily lesson pool is every item
(`modes.ts:65`). Result: 83% vocabulary for an A2 learner; reading/listening under 4%, although the
bagrut weighs reading comprehension heavily. Evidence §4: interleave confusable structures and mix
domains across the session.

**7. One active pattern can flood the selector.**
Every order item targets `word-order.sentence` (also assigned automatically to any wrong order made of
the right words, `answerCheck.ts:131-135`). Once that pattern is active, all 474 order items get ×1.6
(`selector.ts:144-148`) and enter the mistake gym pool (`modes.ts:88-102`). The mistake gym also takes
every unit with `lastScore < 0.5` or any lapse, which becomes most of the history over time.

**8. Retry is massed.**
`PracticeScreen.tsx:292, 411` offers "practise the mistakes again" right after the session, which runs
the identical items (`modes.ts:141-148`) seconds after the answer was shown. It feels useful but mainly
tests short-term memory of the feedback, and it writes a second FSRS review the same day. Evidence §3:
re-test after a lag, preferably with a new item of the same unit.

**9. Skips leave the item due.**
`evidence.ts:40` returns `grade: null` for skips, so a skipped due item stays due and returns next
session at top value. A child who skips a hard item meets it again immediately, then again.

**10. Leeches are not handled.**
There is no rule for items failed many times: the simulation produced items shown 19-23 times. The
profile already identifies struggling words (`profile.ts:125`) but the selector does not act on it
differently from any other due unit.

**11. Choice items can be solved by elimination.**
After a wrong pick the option is disabled (`ExerciseView.tsx:517`) and the learner tries again. With
three options, two wrong taps leave the answer. Combined with C.3.1 this produces a "correct after
retry" (`hard`) without retrieval. Evidence §6: errors are useful when followed by the right answer and
a later re-test, not when the answer is reached by exclusion.

**12. Feedback praise is person-level and generic.**
`ExerciseView.tsx:727-733` shows "מצוין! / כל הכבוד!" for clean answers, picked by item id. The miss
message "לא נורא, ככה לומדים" is good. Only 993 of 2,859 wrong options (35%) have their own feedback,
and only 257 of 425 typed items list known errors. Evidence §8: task- and process-level feedback carries
most of the effect.

**13. XP pays for not asking for help.**
`evidence.ts:97`: 10 XP clean, 5 XP after any help. This discourages hints and retries, the very
behaviours the hint ladder wants. Evidence §10: reward effort and learning, not only flawless
performance.

**14. Lightning trains recognition under time pressure only.**
`modes.ts:115-129`: vocabulary choice items only, target 85%, 60 s. Fine as a game. But each answer is
a full FSRS review; speeded recognition makes `good` grades cheap. Minor.

**15. "Words due" counts every unit.**
`profile.ts:122` counts all due units; the home screen says "X words waiting"
(`HomeScreen.tsx:152-153`). Minor, but it misleads the parent.

**16. Kids area.**
- Picture game: `listenQuestions` (`games.ts:41-56`) puts "not known" words first, where "known" is
  `lastScore >= 0.7 && !isDue` (`KidsPlay.tsx:66-75`). Never-seen and due words are mixed in one
  shuffled bucket and 6 are taken. There is no cap on new words per round and no guarantee that a word
  met yesterday comes back today. Evidence §12 and §2: repeated, spaced exposure to the same words.
- Letters, sight words, word building and memory (`games.ts:71-139`) are random each round and record
  nothing in learner memory, so they cannot adapt or space.
- A kids answer that needed one wrong tap is recorded as `revealed: !correct` → `again`
  (`KidsPlay.tsx:131`), which is reasonable.
- A sticker after every round with ≥50% first-try answers (`Reward.tsx:14-17`) is an expected,
  performance-contingent tangible reward for 3-6 year olds, the case where Deci et al. (1999) and Lepper
  et al. (1973) found the clearest undermining. The effect is not certain for digital stickers; it is a
  risk to monitor rather than a proven harm.

**17. Session length.** Lesson 12 items, modes 6-10 items: about 3-6 minutes. That suits children and
spacing (many short sessions beat few long ones; Kornell 2009). Keep it.

### C.4 Content against the evidence

From the committed `content/packs/*.json` at the start of this audit (2,140 items, 2,139 auto-scored).
New, uncommitted gap packs (`grammar-gaps-*`, `reading-more-1`, `listening-more-1`, `vocab-gaps-1`)
appeared in the working tree while this report was written; they are not counted here.

| | Count | Note |
|---|---|---|
| Item types | choice 1,111 · order 514 · typed 425 · fix 89 · open-writing 1 | 52% recognition |
| Levels | A1 218 · A2 619 · B1 906 · B2 372 · C1 25 | |
| Domains | grammar 1,029 (of which `grammar.word-order` 486, generated) · vocabulary 788 · reading 136 · writing 117 · listening 70 | real grammar-rule items ≈ 545 |
| Units | 1,746, of which 1,497 single-item | review = same item |
| Vocabulary words with their own unit | 176 | see Nation 2006 |
| Passages | 14 (A2 5, B1 5, B2 4) + 26 stories | exam reuses passages after ~5 exams per level |
| Hints per item | 2 hints: 1,470 · 1 hint: 669 | good |
| Distractors with feedback | 993 / 2,859 | 35% |
| Grammar skill-level cells with < 5 items | e.g. adverbs B2 1, conditionals.first A2 1, past-perfect B1 1, wish B1 1, plurals A1 2, used-to A2 2, quantifiers B1 3 | over-repetition is unavoidable there |

---

## (d) Ranked list of changes

Ranking = expected learning benefit × how many learners it affects ÷ effort and risk. "Safe now" =
no data-schema change; new derived state comes from replaying existing events. Every change touching
`evidence.ts` or `projection.ts` must bump `EVIDENCE_MODEL_VERSION` and run `rebuildDerived` for each
student (`store.ts:287`), with a replay-equality test like the existing ones.

### 1. Grade errors honestly and end the `hard` loop
- **What.** In `toEvidence`: any wrong first attempt → `again` (even if later solved), keeping a
  partial ability `score` as today; hint used *before* any answer → `hard`; `slow` stays `hard` only for
  cards already in review state. In `reviewCard`: if the card is in a learning/relearning state and the
  grade is `hard` while at least 12 hours have passed since the last review, treat it as `good`, so
  learning cards graduate. Skip → no FSRS change but push `due` at least one day ahead in the selector
  (C.3.9).
- **Files.** `src/domain/learning/evidence.ts:42-89`, `src/domain/learning/srs.ts:37-40`,
  `src/domain/learning/selector.ts:128-135`, tests in `learning.test.ts`.
- **Benefit.** High. Missed items come back within a day instead of weeks; new items stop looping.
  Directly addresses complaints 1 and 2 of the summary.
- **Effort.** S. **Risk.** Low-medium: intervals change for existing learners after rebuild; more
  `again` grades mean a short-term rise in due counts. **Safe now:** yes.

### 2. Review through variants, not the identical item
- **What.** (a) Selector: when a unit is due and other items share the unit, prefer the item of that
  unit seen least recently (`UnitMemory.contexts` already lists the last 10 item ids,
  `projection.ts:134`). (b) For single-item grammar units, let a due unit be satisfied by an *unseen
  item of the same skill and misconception at a similar level* ("rule review"), and add a novelty
  penalty, e.g. score × 1/(1 + 0.5 × (attempts − 2)) once an item has been answered more than twice and
  a sibling exists. (c) Content, longer term: give grammar items rule-level units
  (`unit: "rule:present-perfect.for-since"`) so FSRS schedules the rule and variety comes for free.
- **Files.** `src/domain/learning/selector.ts:101-165`; content packs for (c), `content/AUTHORING.md`.
- **Benefit.** High. Transfer to new sentences (Pan & Rickard 2018), less answer memorisation, much
  less felt repetition.
- **Effort.** M ((a)+(b)), M-L for (c). **Risk.** Low for (a)/(b). For (c), old events keep their old
  units (the snapshot stores the unit), so history is not lost, but the first reviews under the new
  units start fresh. **Safe now:** (a) and (b) yes; (c) is a content change, no schema change.

### 3. Remove the guessing bias; reward production
- **What.** Compute `fit` on the knowledge part only, `sigmoid(k(μ − b))`, not on `c + (1−c)·…`; keep
  `predicted` with guessing for the ability update. Add a production bonus that grows with unit
  maturity (e.g. ×1.25 for typed/order/fix/translate once the unit has one success). Widen the sampling
  window from 10% to ~25% of the top score, or sample with a softmax, so near-equal candidates of other
  types get picked. Measure weakness against the learner's current/target level rather than the skill's
  nominal level (C.3.5).
- **Files.** `src/domain/learning/selector.ts:109-141, 171-178`, `selector.test.ts`.
- **Benefit.** High. Moves practice from ~87% recognition toward a mix; uses the 425 typed and 514
  order items; generation effect d ≈ 0.40.
- **Effort.** S. **Risk.** Medium: sessions get harder; watch accuracy, abandonment and hint use. Start
  with a modest bonus. **Safe now:** yes.

### 4. A session recipe: mix domains, types, reviews and new items
- **What.** For `lesson` (12 items): about 5 due reviews, 4 new, 2 from active mistakes or leeches,
  1 reading or listening; at least 3 domains; no more than 2 in a row from one skill; at least 30%
  production items; new vocabulary may be introduced in a small block of 2-3, then interleaved.
  Implement as quotas in `useSession.next` (filter the pool by the slot type, then call `pickNext`).
  When the due backlog is large, cap reviews so new material still flows.
- **Files.** `src/features/practice/useSession.ts:123-153`, `src/features/practice/modes.ts:65`.
- **Benefit.** High. Interleaving of confusable grammar (Nakata & Suzuki 2019), balanced exposure to
  reading/listening for the bagrut, steady intake of new material.
- **Effort.** M. **Risk.** Low-medium (pool may be empty for a slot: fall back to the open pool).
  **Safe now:** yes.

### 5. Delayed in-session re-test instead of immediate retry
- **What.** When an item is missed (or new), schedule one re-test of the same *unit* 4-6 items later
  in the same session, using a sibling item when one exists. Change the end-of-session button to
  "practise these tomorrow" (or run the retry with siblings and only items not already re-tested).
  Count at most one FSRS review per unit per day for scheduling (later same-day answers still update
  ability).
- **Files.** `src/features/practice/useSession.ts` (a pending re-test queue next to `recentRef`),
  `src/features/practice/modes.ts:141-148`, `src/features/practice/PracticeScreen.tsx:292, 405-414`,
  `src/domain/learning/projection.ts:120`.
- **Benefit.** Medium-high. Short-lag successful retrieval after an error (Pyc & Rawson 2009; Rawson &
  Dunlosky 2011; Karpicke & Roediger 2008).
- **Effort.** M. **Risk.** Low. The one-review-per-day rule changes replay; bump the evidence version.
  **Safe now:** yes.

### 6. Leech handling
- **What.** A unit with ≥ 3 lapses, or ≥ 6 attempts under 50% success, becomes a "leech": the next time
  it is due, show the lesson card or anchor first (or a worked example), then a different item type
  of the same unit/skill; after that, hold it back for at least 2 days. Show leeches to the parent as
  "needs a teacher's explanation".
- **Files.** `src/domain/learning/selector.ts` (new factor), `src/domain/student/profile.ts:125`,
  `src/features/practice/ExerciseView.tsx` (lesson link already exists at 162-164).
- **Benefit.** Medium-high. Ends the 19-23 repeats of one item; turns repeated failure into teaching
  (explicit instruction, Norris & Ortega 2000).
- **Effort.** S-M. **Risk.** Low. **Safe now:** yes.

### 7. Kids: spaced word re-exposure and tracked letter/sight games
- **What.** Picture game rounds of 6 = at most 2 never-seen words + 4 seen words (due first, then words
  met in the last 3 days), within one topic for a few days in a row. Record letters, sight words and
  built words as units (`letter:a`, `sight:the`, `word:cat`) through the same `completeItem` path the
  picture game uses (`KidsPlay.tsx:99-134`), and choose them by due date. Keep repeated reading of the
  same books (Horst et al. 2011). Make stickers less predictable and more informational: a sticker for
  a new word learned or a book finished, sometimes a surprise; always say what was learned
  ("You learned *cat* and *dog*!"). This part is inference from general evidence (§10, §12).
- **Files.** `src/domain/kids/games.ts:41-139`, `src/features/kids/KidsPlay.tsx:56-150, 305-587`,
  `src/features/kids/Reward.tsx`.
- **Benefit.** Medium-high for ages 3-8 (spacing and repetition are the main levers at this age).
- **Effort.** M. **Risk.** Low; keep the gentle feel. **Safe now:** yes (new unit names only).

### 8. Make choice retries honest
- **What.** In teach mode, after the first wrong pick on a choice item show hint 1 and allow one more
  pick; after a second wrong pick show the explanation and the answer (no third pick by elimination).
  For vocabulary meaning items, optionally switch the retry to typing the word (production).
- **Files.** `src/domain/learning/exerciseFlow.ts:58-104` (a per-type attempt limit),
  `src/features/practice/ExerciseView.tsx:490-540`.
- **Benefit.** Medium. Retrieval instead of exclusion (Roediger & Marsh 2005; Butler & Roediger 2008).
- **Effort.** S. **Risk.** Low-medium: slightly more "revealed" outcomes; with change 1 these come back
  soon, which is the point. **Safe now:** yes.

### 9. Fix the mistake-pattern flood
- **What.** Drop `word-order.sentence` from `targetsMisconceptions` of generated order items (keep it as
  a detected mistake), and cap the active-mistake boost so that at most ~3 items per session come from
  one pattern. Limit the mistake gym to active patterns and recent lapses (last 30 days).
- **Files.** `src/domain/learning/selector.ts:144-148`, `src/features/practice/modes.ts:88-102`,
  generated packs `content/packs/sentence-builder-*.json` (content change).
- **Benefit.** Medium. **Effort.** S. **Risk.** Low. **Safe now:** yes (the selector part with no
  content change).

### 10. Process-level feedback and fair XP
- **What.** Replace generic praise with task/process praise: "נכון. since + נקודת התחלה" (the rule in
  one line), or "נכון, ובלי רמז" for a clean answer; after a retry, "טוב שהשתמשת ברמז". Give the same XP
  for an answer reached with one hint as without; give a bonus for typed answers and for completing due
  reviews. Content: add `feedback` to wrong options that have a misconception (35% today) and known
  errors to typed items.
- **Files.** `src/features/practice/ExerciseView.tsx:727-733`, `src/domain/learning/evidence.ts:97`,
  content packs.
- **Benefit.** Medium (Hattie & Timperley 2007; Mueller & Dweck 1998; Wisniewski et al. 2020).
- **Effort.** S (code), M (content). **Risk.** Low. XP totals change on rebuild; a small one-time jump
  is acceptable. **Safe now:** yes.

### 11. Vocabulary: walk each word up the knowledge ladder
- **What.** For `word:` units, choose the item mode by the unit's progress: first meaning (choice),
  then recall (typed from Hebrew), then context; prefer the hardest mode the learner is ready for once
  a mode has 2 successes. `UnitMemory.modes` already holds the counts.
- **Files.** `src/domain/learning/selector.ts` (factor using `mem.modes`).
- **Benefit.** Medium (Laufer & Goldstein 2004; Laufer & Hulstijn 2001). **Effort.** S. **Risk.** Low.
  **Safe now:** yes.

### 12. Small correctness fixes
- "Words due" should count `word:` units only, or say "items" (`profile.ts:122`, `HomeScreen.tsx:153`).
- Lightning: do not let a speeded recognition `good` lengthen the interval of a unit whose recall mode
  is weak (grade at most `hard` for review cards from lightning). `modes.ts:115-129`, `projection.ts:120`.
- `fix` items have guess chance 0 although they are tap + 3-way choice (`selector.ts:60-62`); set a small
  `c` (e.g. 1/(tokens × options)) or leave as is.
- **Effort.** S each. **Safe now:** yes.

### 13. Personalise FSRS later
- **What.** Keep retention 0.9 and the 365-day cap. When a learner has ~1,000+ reviews, fit FSRS
  parameters to their history (ts-fsrs supports custom `w`); consider a lower retention target
  (0.85) for vocabulary breadth in the 3-unit track to trade accuracy for more new words.
- **Files.** `src/domain/learning/srs.ts:31`. **Benefit.** Low-medium. **Effort.** M. **Risk.** Medium
  (needs per-student parameters, which is a schema addition). **Safe now:** no.

### 14. Speaking and longer output
- **What.** Production with feedback is the weakest area: speaking is not auto-assessed and writing
  has one open item. Use the existing reading check (`readingCheck.ts`) for "say the sentence" retrieval
  items (prompt in Hebrew, answer spoken), and add short guided writing with a checklist.
- **Benefit.** Medium-high for the oral bagrut, but needs design. **Effort.** L. **Risk.** Medium
  (ASR accuracy for children). **Safe now:** partly (new item type = schema change).

**Safe-now set:** 1, 2a-b, 3, 4, 5, 6, 7, 8, 9 (selector part), 10, 11, 12. Each needs an evidence
version bump and a rebuild where it touches scheduling or XP.

---

## (e) How much content, and which item types

### E.1 How many items per skill and level

There is no study that gives a number of items per skill. The numbers below are derived from the
scheduling evidence, so treat them as estimates:

- A grammar rule practised over a school year with FSRS at 0.9 retention gets about 2-3 retrievals in
  the first session/day (learning plus a short-lag re-test) and about 5-7 spaced reviews in the year;
  successive relearning (Rawson & Dunlosky 2011) also suggests 3-5 relearning sessions. Add the mistake
  gym, quizzes and exams, and a learner meets one rule at one level about 12-15 times in a year.
- If every meeting after the first two should use a sentence the learner has not just seen (transfer,
  §1), and exams should use items not used in practice, a rule needs about **20-30 distinct items per
  level at which it is taught**, of at least **3 interaction types** (choice discrimination, typed
  cloze/transformation, spot-the-mistake; plus translation where natural). Fewer than ~10 makes identical
  repetition unavoidable.
- Applied to the committed content: of 93 grammar skill-level cells (excluding generated word-order
  items), 78 have under 10 items and 38 under 5. Priorities
  (bagrut weight × current thinness): conditionals (first/second/third), present perfect vs past simple,
  passive, relative clauses, reported speech, modals and deduction, gerunds/infinitives, quantifiers,
  articles and prepositions at B1/B2.
- **Vocabulary.** Nation (2006) puts reading comprehension at thousands of word families; the bagrut
  bands are lists of the same order (exact sizes not verified here). 176 word units is a small fraction.
  Per word: **3-4 items** (meaning choice, recall typed, 1-2 context gaps with *different* sentences)
  plus meetings in stories and passages; Webb (2007) and Uchihara et al. (2019) show more and more
  spaced encounters build more knowledge. The highest-value content step is to import the Ministry's
  Band I/II/III lists, mark which words have units, and author 3 items for every missing word, starting
  with Band II for 3-4 units and Band III Core for 5 units. Chunk and family items (`chunk:`, `family:`)
  should keep shared units.
- **Reading.** The exam takes one passage at the track level (`modes.ts:236-239`); with 4-5 passages per
  level a student sees repeats after ~5 exams, and practice also draws on the same passages. Aim for
  **at least 20 passages per level A2/B1/B2** (7-8 questions each, covering the 9 reading skills), and
  keep a set reserved for the exam only. Graded stories should grow too: extensive reading effects are
  larger in longer programmes (Jeon & Day 2016), and stories double as vocabulary encounters.
- **Listening.** 70 items, 7 at B2. Aim for 20-30 per level, mostly sentence and dialogue level, many
  reusing story/passage audio.
- **C1.** 25 items is enough for now; only top 5-unit students reach it. Lower priority than B1/B2 depth.
- **Generated sentence-builder items** (474) are already plentiful relative to evidence for them; do not
  add more until the selector can use the existing ones (change 3).

### E.2 Learning per minute by item type (inference, not a measured ranking)

No study ranks these exact formats per minute. Combining time cost (`estimatedTimeSec`) with the
evidence above:

| Type | Time | What it trains | Value per minute | Use for |
|---|---|---|---|---|
| Meaning choice (EN word → HE, 3-4 plausible options) | ~8-15 s | passive recognition/recall | high for breadth | first encounters, maintenance of many words |
| Typed recall (HE → EN word) | ~15-25 s | active recall + spelling | high per item, medium per minute | words after first success (generation, Laufer & Goldstein 2004) |
| Grammar cloze, choice with misconception distractors | ~15 s | discrimination of confusable forms | high when interleaved | grammar contrasts |
| Grammar cloze, typed (verb form) | ~20 s | production of form | high | after a few choice successes |
| Spot-the-mistake with fix | ~20-25 s | noticing + correction | medium-high (noticing; error correction with feedback) | Hebrew-transfer errors |
| Translation HE → EN (typed) | ~30-45 s | production with high involvement | high but slow | short daily dose, B1+ |
| Sentence builder (order tiles) | ~25 s | word order, chunk assembly | uncertain; evidence is indirect | A1-A2 word order, then sparingly |
| Reading passage questions | ~60+ s per question incl. reading | comprehension, inference, vocabulary in context | high for bagrut transfer, extensive input | 1 per lesson, longer passages in reading mode |
| Listening items | ~20-40 s | listening comprehension | high, under-supplied | 1 per lesson |
| Speed games (lightning) | ~3-5 s | fluency of recognition | good for engagement and fluency, low for new learning | optional game |

Practical mix for a 12-item lesson: 4-5 choice (meaning or grammar discrimination), 3-4 production
(typed recall, typed cloze, fix, translation), 1 reading or listening, the rest chosen by need. This is
consistent with the retrieval, generation and interleaving evidence while keeping sessions short.

---

## References (all DOIs checked on Crossref, 2026-10-04)

Adesope, Trevisan & Sundararajan 2017 https://doi.org/10.3102/0034654316689306 ·
Agarwal, Nunes & Blunt 2021 https://doi.org/10.1007/s10648-021-09595-9 ·
Bertsch et al. 2007 https://doi.org/10.3758/BF03193441 ·
Bjork & Bjork 2011 (chapter) https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf ·
Boers & Lindstromberg 2012 https://doi.org/10.1017/S0267190512000050 ·
Brunmair & Richter 2019 https://doi.org/10.1037/bul0000209 ·
Butler 2010 https://doi.org/10.1037/a0019902 ·
Butler, Karpicke & Roediger 2007 https://doi.org/10.1037/1076-898X.13.4.273 ·
Butler & Roediger 2008 https://doi.org/10.3758/MC.36.3.604 ·
Butterfield & Metcalfe 2001 https://doi.org/10.1037/0278-7393.27.6.1491 ·
Carpenter, Pan & Butler 2022 https://doi.org/10.1038/s44159-022-00089-1 ·
Cepeda et al. 2006 https://doi.org/10.1037/0033-2909.132.3.354 ·
Cepeda et al. 2008 https://doi.org/10.1111/j.1467-9280.2008.02209.x ·
Childers & Tomasello 2002 https://doi.org/10.1037/0012-1649.38.6.967 ·
Clark & Paivio 1991 https://doi.org/10.1007/BF01320076 ·
Deci, Koestner & Ryan 1999 https://doi.org/10.1037/0033-2909.125.6.627 ·
Dunlosky et al. 2013 https://doi.org/10.1177/1529100612453266 ·
Hanus & Fox 2015 https://doi.org/10.1016/j.compedu.2014.08.019 ·
Hattie & Timperley 2007 https://doi.org/10.3102/003465430298487 ·
Horst, Parsons & Bryan 2011 https://doi.org/10.3389/fpsyg.2011.00017 ·
Hulstijn & Laufer 2001 https://doi.org/10.1111/0023-8333.00164 ·
Jeon & Day 2016 https://nflrc.hawaii.edu/rfl/item/354 ·
Kalyuga et al. 2003 https://doi.org/10.1207/S15326985EP3801_4 ·
Kang 2016 https://doi.org/10.1177/2372732215624708 ·
Kang, Gollan & Pashler 2013 https://doi.org/10.3758/s13423-013-0450-z ·
Karpicke & Roediger 2008 https://doi.org/10.1126/science.1152408 ·
Kim & Webb 2022 https://doi.org/10.1111/lang.12479 ·
Knabe & Vlach 2020 https://doi.org/10.1016/j.jarmac.2020.07.007 ·
Kornell 2009 https://doi.org/10.1002/acp.1537 ·
Kornell & Bjork 2008 https://doi.org/10.1111/j.1467-9280.2008.02127.x ·
Kornell, Hays & Bjork 2009 https://doi.org/10.1037/a0015729 ·
Krashen 1982 (book) http://www.sdkrashen.com/content/books/principles_and_practice.pdf ·
Kulik & Kulik 1988 https://doi.org/10.3102/00346543058001079 ·
Latimier, Peyre & Ramus 2021 https://doi.org/10.1007/s10648-020-09572-8 ·
Laufer & Goldstein 2004 https://doi.org/10.1111/j.0023-8333.2004.00260.x ·
Laufer & Hulstijn 2001 https://doi.org/10.1093/applin/22.1.1 ·
Lepper, Greene & Nisbett 1973 https://doi.org/10.1037/h0035519 ·
Li 2010 https://doi.org/10.1111/j.1467-9922.2010.00561.x ·
Little et al. 2012 https://doi.org/10.1177/0956797612443370 ·
Lyster & Saito 2010 https://doi.org/10.1017/S0272263109990520 ·
Mayer & Moreno 2003 https://doi.org/10.1207/S15326985EP3801_6 ·
Metcalfe 2017 https://doi.org/10.1146/annurev-psych-010416-044022 ·
Mueller & Dweck 1998 https://doi.org/10.1037/0022-3514.75.1.33 ·
Nakanishi 2015 https://doi.org/10.1002/tesq.157 ·
Nakata 2015 https://doi.org/10.1017/S0272263114000825 ·
Nakata 2016 https://doi.org/10.1017/S0272263116000280 ·
Nakata & Suzuki 2019 https://doi.org/10.1111/modl.12581 ·
Nation 2006 https://doi.org/10.3138/cmlr.63.1.59 ·
Norris & Ortega 2000 https://doi.org/10.1111/0023-8333.00136 ·
Pan & Rickard 2018 https://doi.org/10.1037/bul0000151 ·
Pan, Tajran, Lovelett, Osuna & Rickard 2019 https://doi.org/10.1037/edu0000336 ·
Pashler et al. 2005 https://doi.org/10.1037/0278-7393.31.1.3 ·
Pyc & Rawson 2009 https://doi.org/10.1016/j.jml.2009.01.004 ·
Rawson & Dunlosky 2011 https://doi.org/10.1037/a0023956 ·
Richland, Kornell & Kao 2009 https://doi.org/10.1037/a0016496 ·
Roediger & Karpicke 2006 https://doi.org/10.1111/j.1467-9280.2006.01693.x ·
Roediger & Marsh 2005 https://doi.org/10.1037/0278-7393.31.5.1155 ·
Rohrer & Taylor 2007 https://doi.org/10.1007/s11251-007-9015-8 ·
Rohrer, Dedrick & Stershic 2015 https://doi.org/10.1037/edu0000001 ·
Rowland 2014 https://doi.org/10.1037/a0037559 ·
Ryan & Deci 2000 https://doi.org/10.1037/0003-066X.55.1.68 ·
Sailer & Homner 2020 https://doi.org/10.1007/s10648-019-09498-w ·
Schmidt 1990 https://doi.org/10.1093/applin/11.2.129 ·
Settles & Meeder 2016 https://doi.org/10.18653/v1/P16-1174 ·
Shute 2008 https://doi.org/10.3102/0034654307313795 ·
Silverman & Barasch 2022 https://doi.org/10.1093/jcr/ucac029 ·
Slamecka & Graf 1978 https://doi.org/10.1037/0278-7393.4.6.592 ·
Soderstrom & Bjork 2015 https://doi.org/10.1177/1745691615569000 ·
Sweller 1988 https://doi.org/10.1207/s15516709cog1202_4 ·
Uchihara, Webb & Yanagisawa 2019 https://doi.org/10.1111/lang.12343 ·
Vlach, Sandhofer & Kornell 2008 https://doi.org/10.1016/j.cognition.2008.07.013 ·
Vlach & Sandhofer 2012 https://doi.org/10.1111/j.1467-8624.2012.01781.x ·
Webb 2007 https://doi.org/10.1093/applin/aml048 ·
Webb, Yanagisawa & Uchihara 2020 https://doi.org/10.1111/modl.12671 ·
Wilson et al. 2019 https://doi.org/10.1038/s41467-019-12552-4 ·
Wisniewski, Zierer & Hattie 2020 https://doi.org/10.3389/fpsyg.2019.03087 ·
Yang et al. 2021 https://doi.org/10.1037/bul0000309 ·
Ye, Su & Cao 2022 https://doi.org/10.1145/3534678.3539081 ·
Israeli Ministry of Education, English bagrut resources https://pop.education.gov.il/tchumey_daat/english/chativa-elyona/bagrut-exam/teachers-resource-materials/ ·
FSRS benchmark (not peer-reviewed) https://github.com/open-spaced-repetition/srs-benchmark
