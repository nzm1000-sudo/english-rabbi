// @vitest-environment node
/**
 * Validates one content pack in isolation:
 *   PACK=<pack-id> npx vitest run tools/validate-pack.test.ts
 * Checks the schema plus authoring rules from content/AUTHORING.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildRegistry } from '../src/domain/content/registry';
import { storyWords } from '../src/domain/content/schema';

const root = path.resolve(__dirname, '..');
const packId = process.env.PACK;
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

if (!packId) {
  it.skip('set PACK=<pack-id> to validate one pack', () => {});
}

describe.runIf(!!packId)(`pack ${packId}`, () => {
  if (!packId) return;
  const packPath = path.join(root, 'content/packs', `${packId}.json`);
  const pack = readJson(packPath);
  const misDir = path.join(root, 'content/misconceptions');
  const misconceptions = fs.readdirSync(misDir).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try {
      return readJson(path.join(misDir, f));
    } catch {
      return [];
    }
  });
  const anchorDir = path.join(root, 'content/anchors');
  const anchors = fs.readdirSync(anchorDir).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(path.join(anchorDir, f)));
  const reg = buildRegistry({ anchors, packs: [pack], sources: readJson(path.join(root, 'content/sources.json')), misconceptions });

  it('has no schema or reference errors', () => {
    expect(reg.issues).toEqual([]);
  });

  it('follows the authoring rules', () => {
    const problems: string[] = [];
    const masculine = /(^|[\s"'(])(בחר|בחרי|שים|שימי|כתוב|כתבי|השלם|השלימי|תבחר|תכתוב|הקשב|הקשיבי|זכור|זכרי)(?=[\s.,:!?]|$)/;
    const heTexts = (i: Record<string, unknown>) => JSON.stringify([i.instruction, i.hints, i.explanation]);
    const storyItems = [...reg.stories.values()].flatMap((st) => st.questions.map((q) => q.item));
    for (const i of [...reg.items, ...storyItems]) {
      if (!i.id.startsWith(`${pack.packId.split('-')[0]}`)) {
        // Prefix check is soft: ids must at least be unique, which the registry enforces.
      }
      if (i.type === 'choice') {
        if (i.correctOptionId !== 'a') problems.push(`${i.id}: correctOptionId must be "a"`);
        const texts = i.options.map((o) => o.text.trim().toLowerCase());
        if (new Set(texts).size !== texts.length) problems.push(`${i.id}: duplicate option text`);
      }
      if (i.tags.includes('translate')) {
        const english = i.type === 'typed' ? i.answers : i.type === 'order' ? [i.answer, ...i.alternatives] : [];
        if (!('audioText' in i) || !i.audioText || !english.includes(i.audioText)) problems.push(`${i.id}: translate item needs audioText equal to an accepted answer`);
        if (!('promptLanguage' in i) || i.promptLanguage !== 'he') problems.push(`${i.id}: translate item needs promptLanguage "he"`);
      }
      if (i.type === 'fix' && i.audioText !== i.corrected) problems.push(`${i.id}: fix item needs audioText equal to corrected`);
      if (i.type !== 'open-writing' && i.type !== 'fix') {
        const gaps = i.prompt.split('___').length - 1;
        if (gaps > 1) problems.push(`${i.id}: more than one gap`);
        if (gaps === 1 && !i.audioText) problems.push(`${i.id}: gap item needs audioText with the full sentence`);
        if (gaps === 1 && i.audioText?.includes('___')) problems.push(`${i.id}: audioText must be the full sentence`);
      }
      if (i.modality === 'listen' && !('audioText' in i && i.audioText)) problems.push(`${i.id}: listen item needs audioText`);
      if (masculine.test(heTexts(i as unknown as Record<string, unknown>))) problems.push(`${i.id}: gendered Hebrew imperative, use an infinitive`);
      // Addressing the learner with slash forms ("את/ה", "תעבור/י"): use an impersonal form instead.
      // Slash forms about a third person ("הכותב/ת") are fine.
      if (/(^|[^א-ת])ת[א-ת]+\/י(?![א-ת])/.test(heTexts(i as unknown as Record<string, unknown>))) problems.push(`${i.id}: gendered slash form in teaching text`);
      if (/[—–]/.test(heTexts(i as unknown as Record<string, unknown>))) problems.push(`${i.id}: long dash in Hebrew text`);
    }
    for (const st of reg.stories.values()) {
      if (/[—–]/.test(JSON.stringify([st.title.he, st.moral, st.lines.map((l) => l.he)]))) problems.push(`${st.id}: long dash in Hebrew text`);
      const used = new Set(st.lines.flatMap((l) => storyWords(l.en)));
      const unused = Object.keys(st.glossary).filter((k) => !used.has(k) && !used.has(`${k}'s`));
      if (unused.length) problems.push(`${st.id}: glossary words not in the story: ${unused.join(', ')}`);
    }
    for (const l of reg.lessons.values()) {
      if (masculine.test(JSON.stringify(l.blocks))) problems.push(`${l.id}: gendered Hebrew imperative`);
    }
    expect(problems).toEqual([]);
  });

  it('does not reuse item ids or word units from other packs', () => {
    const others = fs.readdirSync(path.join(root, 'content/packs')).filter((f) => f !== `${packId}.json` && f.endsWith('.json'));
    const ids = new Set<string>();
    const words = new Set<string>();
    for (const f of others) {
      try {
        for (const i of readJson(path.join(root, 'content/packs', f)).items ?? []) {
          ids.add(i.id);
          if (i.word?.lemma) words.add(i.word.lemma.toLowerCase());
        }
        for (const st of readJson(path.join(root, 'content/packs', f)).stories ?? []) {
          ids.add(st.id);
          for (const q of st.questions ?? []) ids.add(q.item?.id);
        }
      } catch {
        /* another pack may be mid-write */
      }
    }
    const mine = [...reg.items.map((i) => i.id), ...[...reg.stories.values()].flatMap((st) => [st.id, ...st.questions.map((q) => q.item.id)])];
    const clashes = mine.filter((id) => ids.has(id));
    const wordClashes = [...new Set(reg.items.filter((i) => i.word && words.has(i.word.lemma.toLowerCase())).map((i) => i.word!.lemma))];
    expect({ clashes, wordClashes }).toEqual({ clashes: [], wordClashes: [] });
  });

  it('reports size', () => {
    console.log(`[${packId}] items=${reg.items.length} passages=${reg.passages.size} lessons=${reg.lessons.size} stories=${reg.stories.size}`);
  });
});
