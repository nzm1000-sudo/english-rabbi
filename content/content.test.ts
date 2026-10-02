import { contentRegistry as reg } from './index';
import { buildRegistry } from '@/domain/content/registry';
import { DOMAINS } from '@/domain/skills/taxonomy';
import sources from './sources.json';
import misconceptions from './misconceptions/core.json';

describe('content packs', () => {
  it('load without any errors or quarantined items', () => {
    expect(reg.issues).toEqual([]);
    expect(reg.items.length).toBeGreaterThan(60);
  });

  it('cover every assessable domain', () => {
    for (const d of DOMAINS.filter((d) => d !== 'speaking')) {
      expect(reg.byDomain(d).length, d).toBeGreaterThan(0);
    }
  });

  it('give every choice item unique option texts', () => {
    for (const i of reg.items) {
      if (i.type !== 'choice') continue;
      const texts = i.options.map((o) => o.text.toLowerCase());
      expect(new Set(texts).size, i.id).toBe(texts.length);
    }
  });

  it('use "___" exactly once in typed cloze prompts that have a gap', () => {
    for (const i of reg.items) {
      if (i.type !== 'typed' || !i.prompt.includes('___')) continue;
      expect(i.prompt.split('___').length - 1, i.id).toBe(1);
    }
  });

  it('give listening items audio text', () => {
    for (const i of reg.items) {
      if (i.modality !== 'listen') continue;
      expect('audioText' in i && i.audioText, i.id).toBeTruthy();
    }
  });

  it('every misconception in the catalog is used by some item', () => {
    const used = new Set(
      reg.items.flatMap((i) => [
        ...i.targetsMisconceptions,
        ...(i.type === 'choice' ? i.options.flatMap((o) => (o.misconception ? [o.misconception] : [])) : []),
        ...(i.type === 'typed' ? i.knownErrors.flatMap((e) => (e.misconception ? [e.misconception] : [])) : []),
      ]),
    );
    for (const m of reg.misconceptions.keys()) expect(used.has(m), m).toBe(true);
  });
});

describe('licensing gate', () => {
  const item = {
    id: 'x.item', type: 'choice', skill: 'grammar.articles', level: 'A1',
    instruction: { he: 'א', en: 'a' }, explanation: { he: 'א', en: 'a' },
    prompt: 'p', options: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }], correctOptionId: 'a',
  };

  it('quarantines items whose source is not approved', () => {
    const r = buildRegistry({
      sources: [...sources, { id: 'web-unclear', kind: 'other', title: 'Some site', license: 'unknown', status: 'needs-review' }],
      misconceptions,
      packs: [{ packId: 'p', schemaVersion: 1, title: 't', items: [{ ...item, source: 'web-unclear' }] }],
    });
    expect(r.items).toHaveLength(0);
    expect(r.quarantined).toHaveLength(1);
    expect(r.issues[0]!.severity).toBe('quarantined');
  });

  it('quarantines items with an unknown source', () => {
    const r = buildRegistry({ sources, misconceptions, packs: [{ packId: 'p', schemaVersion: 1, title: 't', items: [{ ...item, source: 'nope' }] }] });
    expect(r.quarantined).toHaveLength(1);
  });

  it('skips a broken item but keeps the rest of the pack', () => {
    const r = buildRegistry({
      sources, misconceptions,
      packs: [{ packId: 'p', schemaVersion: 1, title: 't', items: [{ ...item, source: 'original' }, { ...item, id: 'bad', correctOptionId: 'z', source: 'original' }] }],
    });
    expect(r.items.map((i) => i.id)).toEqual(['x.item']);
    expect(r.issues[0]!.severity).toBe('error');
  });

  it('rejects unknown skills', () => {
    const r = buildRegistry({ sources, misconceptions, packs: [{ packId: 'p', schemaVersion: 1, title: 't', items: [{ ...item, skill: 'grammar.nope', source: 'original' }] }] });
    expect(r.items).toHaveLength(0);
  });
});
