import { initial } from './Avatar';

it('takes the whole first character, emoji included', () => {
  expect(initial('🦄✨ Dana')).toBe('🦄');
  expect(initial('  Ori')).toBe('O');
  expect(initial('דנה')).toBe('ד');
  expect(initial('👨‍👩‍👧 family')).toBe('👨‍👩‍👧');
  expect(initial('')).toBe('');
});
