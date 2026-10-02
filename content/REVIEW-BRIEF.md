# Correctness review brief (second pass)

Goal: zero wrong answer keys and zero items with more than one defensible answer.
The children will trust the app; a correct answer marked wrong is the worst possible bug.

For EVERY item, in this order:
1. Cover the key. Solve the item yourself as a careful native-level English teacher.
2. Compare with `correctOptionId` / `answers` / `answer`. If they differ, decide who is right.
3. For every wrong option ask: could a teacher accept it in ANY common variety (US, UK) or register?
   If yes: replace that option with a clearly wrong one, or rewrite the prompt to rule it out (add context, time markers).
4. Typed items: are all common correct answers listed (spelling variants, contractions are automatic)? Is any accepted answer actually wrong?
5. Hebrew translations: accurate? Most common meaning? Option texts must not give away the answer by length or detail.
6. Explanation and hints: factually correct? Do they match the key? Hints must not state the answer.
7. audioText for gap items = the prompt with the correct answer filled in, exactly.
8. Natural English everywhere. No invented facts presented as real.

Rules: keep ids, units and structure; edit JSON with a Python script (ensure_ascii=False, indent=2);
Hebrew stays gender-neutral (infinitives); no long dashes. Do not run git. Do not edit other packs.
Validate your pack: `cd /home/user/english-rabbi && PACK=<pack-id> npx vitest run tools/validate-pack.test.ts`

Write a short log of every change (id: what was wrong -> what you did) to
/tmp/claude-0/-home-user-english-rabbi/bbaacf79-0e65-5e0e-8abc-3aa9985cbc2d/scratchpad/review/<pack-id>.md

## Extra rules for sentence-builder packs (type "order")
Tiles are shown WITHOUT punctuation; the final . ? or ! is shown fixed at the end; comparison ignores case.
For each item:
a. The `answer` must be a correct, natural sentence.
b. Find EVERY other grammatical, natural order of exactly the same words with the same end mark
   (moved time/place phrases: "Yesterday I went..." / "I went ... yesterday"; adverb positions;
   swapped clauses: "If it rains, we will stay home" / "We will stay home if it rains";
   "too"/"also"/"often" positions; reported speech variants). Add each to `alternatives` (write it with normal punctuation).
c. If a statement's words can also form a question with the same end mark, or the item allows more than
   3 alternatives, or it is too long/ambiguous for a child, DELETE the item.
d. `distractors` must stay empty.
e. Hint 2 ("The first half: ...") must match the answer.
