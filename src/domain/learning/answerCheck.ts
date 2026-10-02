import type { ChoiceItem, OrderItem, TypedItem } from '../content/schema';

export interface CheckResult {
  correct: boolean;
  /** Typed answer is one or two letters off a correct answer. */
  nearMiss: boolean;
  misconception?: string;
  feedback?: { he: string; en: string };
}

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'],
  [/'m\b/g, ' am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
];

/** Normalization used for comparing typed answers. Not for display. */
export function normalizeAnswer(s: string): string {
  let t = s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?,;:]+$/g, '')
    .trim();
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/\s+/g, ' ');
}

export function checkTyped(item: TypedItem, input: string): CheckResult {
  const given = normalizeAnswer(input);
  if (!given) return { correct: false, nearMiss: false };
  const accepted = item.answers.map(normalizeAnswer);
  if (accepted.includes(given)) return { correct: true, nearMiss: false };

  const known = item.knownErrors.find((e) => normalizeAnswer(e.answer) === given);
  if (known) {
    return {
      correct: false,
      nearMiss: false,
      ...(known.misconception ? { misconception: known.misconception } : {}),
      feedback: known.feedback,
    };
  }

  const near = accepted.some((a) => {
    const limit = a.length >= 8 ? 2 : a.length >= 4 ? 1 : 0;
    return limit > 0 && levenshtein(a, given) <= limit;
  });
  return { correct: false, nearMiss: near };
}

export function checkChoice(item: ChoiceItem, optionId: string): CheckResult {
  const opt = item.options.find((o) => o.id === optionId);
  if (!opt) return { correct: false, nearMiss: false };
  if (opt.id === item.correctOptionId) return { correct: true, nearMiss: false };
  return {
    correct: false,
    nearMiss: false,
    ...(opt.misconception ? { misconception: opt.misconception } : {}),
    ...(opt.feedback ? { feedback: opt.feedback } : {}),
  };
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** Strips punctuation from a tile; tiles are shown and compared without it. */
export function bareToken(t: string): string {
  return t.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
}

/** Word tiles of an order item, in sentence order, without punctuation. */
export function orderTokens(item: Pick<OrderItem, 'answer'>): string[] {
  return item.answer.trim().split(/\s+/).map(bareToken).filter(Boolean);
}

function sequenceKey(words: string[]): string {
  return words.map((w) => bareToken(w).toLowerCase()).filter(Boolean).join(' ');
}

export function checkOrder(item: OrderItem, tokens: string[]): CheckResult {
  const given = sequenceKey(tokens);
  const accepted = [item.answer, ...item.alternatives].map((a) => sequenceKey(a.split(/\s+/)));
  if (accepted.includes(given)) return { correct: true, nearMiss: false };
  const used = new Set(tokens.map((t) => bareToken(t).toLowerCase()));
  const trap = item.distractors.find((d) => used.has(d.text.toLowerCase()));
  const sameWords = [...given.split(' ')].sort().join(' ') === [...accepted[0]!.split(' ')].sort().join(' ');
  return {
    correct: false,
    nearMiss: false,
    ...(trap?.misconception ? { misconception: trap.misconception } : !trap && sameWords ? { misconception: 'word-order.sentence' } : {}),
  };
}
