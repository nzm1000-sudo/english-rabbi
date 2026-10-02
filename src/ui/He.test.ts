import { splitBidi } from './He';

describe('bidi splitting', () => {
  it('isolates English runs inside Hebrew', () => {
    expect(splitBidi('בקטע נאמר: He was nervous. זו הסיבה.')).toEqual([
      { latin: false, text: 'בקטע נאמר: ' },
      { latin: true, text: 'He was nervous.' },
      { latin: false, text: ' זו הסיבה.' },
    ]);
  });

  it('keeps pure Hebrew as one run', () => {
    expect(splitBidi('לבחור את התשובה')).toEqual([{ latin: false, text: 'לבחור את התשובה' }]);
  });

  it('keeps parentheses with the English inside them', () => {
    expect(splitBidi('אדם (tell me), וגם')).toEqual([
      { latin: false, text: 'אדם ' },
      { latin: true, text: '(tell me)' },
      { latin: false, text: ', וגם' },
    ]);
  });

  it('handles patterns like have + V3', () => {
    expect(splitBidi('המבנה: have + V3 תמיד').map((p) => p.latin)).toEqual([false, true, false]);
  });
});
