import { buildQuestions, firstLetterQuestions, listenQuestions, memoryCards, sightQuestions } from './games';
import type { KidWord, Phonics } from './schema';

const w = (id: string, topic: KidWord['topic'], emoji: string): KidWord => ({ id, en: id, he: id, picture: { emoji }, topic, stages: ['little', 'young'] });
const words = [w('dog', 'animals', '🐶'), w('cat', 'animals', '🐱'), w('cow', 'animals', '🐮'), w('fish', 'animals', '🐟'), w('apple', 'food', '🍎'), w('egg', 'food', '🥚')];
const ph: Phonics = {
  letters: 'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => ({ letter: l, soundHe: 'x', word: `${l}word`, emoji: '⭐', wordHe: 'x' })),
  families: [{ id: 'at', rime: 'at', words: [{ en: 'cat', he: 'חתול', emoji: '🐱' }, { en: 'hat', he: 'כובע', emoji: '🎩' }, { en: 'mat', he: 'שטיח' }] }],
  sightWords: ['the', 'is', 'a', 'I'].map((en) => ({ en, he: en, level: 1, sentence: { en: `${en}.`, he: 'x' } })),
};

describe('kids games', () => {
  it('listen questions use the topic and include the target once', () => {
    const qs = listenQuestions(words, { stage: 'little', topic: 'animals', seed: 's' });
    expect(qs).toHaveLength(4);
    for (const q of qs) {
      expect(q.options).toHaveLength(3);
      expect(q.options.filter((o) => o.id === q.target.id)).toHaveLength(1);
      expect(q.options.every((o) => o.topic === 'animals')).toBe(true);
    }
  });

  it('puts words not yet known first', () => {
    const qs = listenQuestions(words, { stage: 'little', topic: 'animals', seed: 's', count: 2, known: (x) => x.id !== 'cow' });
    expect(qs[0]!.target.id).toBe('cow');
  });

  it('first-letter questions contain the right letter', () => {
    for (const q of firstLetterQuestions(ph, 's')) expect(q.options).toContain(q.word[0]);
  });

  it('build tiles contain every letter of the word', () => {
    for (const q of buildQuestions(ph, 's')) for (const c of q.word) expect(q.tiles).toContain(c);
  });

  it('sight questions include the word', () => {
    for (const q of sightQuestions(ph, 's', 1)) expect(q.options).toContain(q.word);
  });

  it('memory cards come in pairs', () => {
    const cards = memoryCards(words, 's', 3);
    expect(cards).toHaveLength(6);
    expect(new Set(cards.map((c) => c.word.id)).size).toBe(3);
  });
});
