/**
 * Generated exercises. Built at load time from authored items, so they need
 * no extra writing and no extra audio (they reuse each item's audioText).
 *
 * Build the sentence: every cloze item with a full model sentence of 4-11
 * words becomes an ordering task. A wrong option from the source item is
 * added as a trap tile, keeping its misconception.
 */
type Raw = Record<string, unknown>;

const MIN_WORDS = 4;
const MAX_WORDS = 11;

export function generateOrderItems(packs: unknown[]): Raw[] {
  const out: Raw[] = [];
  for (const pack of packs as { items?: Raw[] }[]) {
    for (const it of pack.items ?? []) {
      const prompt = it.prompt as string | undefined;
      const sentence = it.audioText as string | undefined;
      if (!prompt?.includes('___') || !sentence || it.passageId || it.modality === 'listen') continue;
      if (it.type !== 'choice' && it.type !== 'typed') continue;
      const words = sentence.trim().split(/\s+/);
      if (words.length < MIN_WORDS || words.length > MAX_WORDS) continue;
      if (/[:"]/.test(sentence)) continue;

      const distractors: { text: string; misconception?: string }[] = [];
      if (it.type === 'choice') {
        const opts = (it.options as { id: string; text: string; misconception?: string }[]) ?? [];
        const wrong = opts.find((o) => o.id !== it.correctOptionId && !/\s/.test(o.text) && !words.some((w) => w.toLowerCase() === o.text.toLowerCase()));
        if (wrong) distractors.push({ text: wrong.text, ...(wrong.misconception ? { misconception: wrong.misconception } : {}) });
      }
      const half = words.slice(0, Math.ceil(words.length / 2)).join(' ');
      out.push({
        id: `gen.order.${it.id as string}`,
        type: 'order',
        skill: 'grammar.word-order',
        alsoSkills: [{ id: it.skill as string, weight: 0.5 }],
        level: it.level,
        difficulty: Math.min(1, ((it.difficulty as number | undefined) ?? 0.5) + 0.1),
        unit: `order:${it.id as string}`,
        prompt: 'Build the sentence',
        answer: sentence,
        audioText: sentence,
        distractors,
        targetsMisconceptions: ['word-order.sentence'],
        instruction: { he: 'לבנות את המשפט מהמילים', en: 'Build the sentence from the words' },
        hints: [
          { he: `המשפט מתחיל ב־${words[0]}`, en: `It starts with "${words[0]}"` },
          { he: `החצי הראשון: ${half}`, en: `The first half: ${half}` },
        ],
        explanation: (it.explanation as Raw) ?? { he: sentence, en: sentence },
        interests: it.interests ?? [],
        tags: ['generated', 'sentence-builder'],
        estimatedTimeSec: 25,
        source: 'original',
      });
    }
  }
  return out;
}
