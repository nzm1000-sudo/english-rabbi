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

describe('bidi layout', () => {
  it('puts an English sentence on its own line and keeps short words inline', async () => {
    const { layoutBidi } = await import('./He');
    const parts = layoutBidi('apologize for + ing: He apologized for being late. בעברית "על", באנגלית for.');
    // The closing full stop belongs to the Hebrew sentence, not to "for".
    expect(parts.map((p) => p.kind)).toEqual(['en-line', 'he', 'en', 'he']);
    expect(parts.at(-1)!.text).toBe('.');
    expect(parts[0]!.text).toBe('apologize for + ing: He apologized for being late.');
    expect(parts[1]!.text).toBe('בעברית "על", באנגלית ');
  });

  it('drops punctuation-only Hebrew fragments around English lines', async () => {
    const { layoutBidi } = await import('./He');
    expect(layoutBidi('דוגמה: She has lived here since 2015.').map((p) => p.kind)).toEqual(['he', 'en-line']);
  });
});

describe('bidi layout heuristics', () => {
  it('keeps short or list-like English inline', async () => {
    const { layoutBidi } = await import('./He');
    expect(layoutBidi('עם he / she / it מוסיפים s.').map((p) => p.text)).toEqual(['עם ', 'he / she / it', ' מוסיפים ', 's', '.']);
    expect(layoutBidi('מילים כמו every day, usually, always, often הן סימן').map((p) => p.kind)).toEqual(['he', 'en', 'he']);
  });
});

describe('bidi punctuation', () => {
  it('keeps balanced parentheses inside the English run', () => {
    expect(splitBidi('כמתים (much / many / few)')).toEqual([
      { latin: false, text: 'כמתים ' },
      { latin: true, text: '(much / many / few)' },
    ]);
  });

  it('leaves an unmatched parenthesis with the Hebrew around it', () => {
    expect(splitBidi('lose (o אחת) = לאבד')).toEqual([
      { latin: true, text: 'lose' },
      { latin: false, text: ' (' },
      { latin: true, text: 'o' },
      { latin: false, text: ' אחת) = לאבד' },
    ]);
  });

  it('moves "=" to the end of an English line', async () => {
    const { layoutBidi } = await import('./He');
    const parts = layoutBidi('Can I ask you a question? = אפשר לשאול שאלה?');
    expect(parts[0]).toEqual({ kind: 'en-line', text: 'Can I ask you a question? =' });
    expect(parts[1]!.text.startsWith('אפשר')).toBe(true);
  });

  it('glues "=" to short inline English so it never starts a line', async () => {
    const { layoutBidi } = await import('./He');
    expect(layoutBidi('ask a question = לשאול שאלה')[1]!.text.startsWith(' =')).toBe(true);
  });

  it('inline mode never splits English onto its own line', async () => {
    const { layoutBidi } = await import('./He');
    expect(layoutBidi('There is / There are', true).map((p) => p.kind)).toEqual(['en']);
  });
});

describe('bidi sentences', () => {
  it('splits two English sentences inside Hebrew into two runs', () => {
    expect(splitBidi('אומרים have fun. make fun of פירושו ללעוג')).toEqual([
      { latin: false, text: 'אומרים ' },
      { latin: true, text: 'have fun.' },
      { latin: false, text: ' ' },
      { latin: true, text: 'make fun of' },
      { latin: false, text: ' פירושו ללעוג' },
    ]);
  });
});

/** Regression: the space between two inline English sentences was dropped ("something.I'm"). */
describe('bidi sentence spacing', () => {
  it('keeps the space between two inline English runs', async () => {
    const { layoutBidi } = await import('./He');
    const parts = layoutBidi('אומרים have fun. make fun of פירושו ללעוג');
    expect(parts.map((p) => p.text).join('')).toBe('אומרים have fun. make fun of פירושו ללעוג');
  });
  it('keeps it in inline mode too', async () => {
    const { layoutBidi } = await import('./He');
    expect(layoutBidi("I forgot something. I'm sorry.", true).map((p) => p.text).join('')).toBe("I forgot something. I'm sorry.");
  });
});

describe('suffixes and full stops', () => {
  it('keeps a hyphen with the English suffix it belongs to', async () => {
    const { layoutBidi } = await import('./He');
    // Was shown as "ly-." on screen: the hyphen and the stop sat on the Hebrew side of the word.
    expect(layoutBidi('ופועל מתואר בתואר פועל עם -ly.').map((p) => [p.kind, p.text])).toEqual([
      ['he', 'ופועל מתואר בתואר פועל עם '],
      ['en', '-ly'],
      ['he', '.'],
    ]);
  });

  it('leaves a stop inside an English sentence that runs inline', async () => {
    const { layoutBidi } = await import('./He');
    expect(layoutBidi('כותבים I go.', true).map((p) => p.text)).toEqual(['כותבים ', 'I go.']);
  });
});
