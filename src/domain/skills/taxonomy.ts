import type { CefrLevel } from './cefr';

/**
 * Skill taxonomy.
 *
 * Skills form a tree: domain -> skill -> sub-skill. Ids are dotted paths,
 * so the parent of "grammar.past-simple.questions" is "grammar.past-simple"
 * and its domain is "grammar". Ids are stable keys stored in learner data,
 * so never rename an id. Deprecate it and add a new one instead.
 */
export const DOMAINS = ['vocabulary', 'grammar', 'reading', 'writing', 'listening', 'speaking'] as const;
export type Domain = (typeof DOMAINS)[number];

export type SkillId = string;

export interface SkillNode {
  id: SkillId;
  domain: Domain;
  name: { en: string; he: string };
  /** The CEFR level where this skill is typically taught. Used for mastery and sequencing. */
  level: CefrLevel;
  /** Skills that should reach "developing" before this one is introduced. */
  prerequisites?: SkillId[];
  /** True when the app cannot assess this skill automatically yet. */
  assessable?: boolean;
}

const S = (
  id: SkillId,
  he: string,
  en: string,
  level: CefrLevel,
  prerequisites?: SkillId[],
  assessable = true,
): SkillNode => ({
  id,
  domain: id.split('.')[0] as Domain,
  name: { en, he },
  level,
  ...(prerequisites ? { prerequisites } : {}),
  assessable,
});

export const SKILLS: readonly SkillNode[] = [
  // Domains (roots)
  S('vocabulary', 'אוצר מילים', 'Vocabulary', 'A1'),
  S('grammar', 'דקדוק', 'Grammar', 'A1'),
  S('reading', 'הבנת הנקרא', 'Reading', 'A1'),
  S('writing', 'כתיבה', 'Writing', 'A1'),
  S('listening', 'הבנת הנשמע', 'Listening', 'A1'),
  S('speaking', 'דיבור', 'Speaking', 'A1', undefined, false),

  // Vocabulary
  S('vocabulary.meaning', 'משמעות מילים', 'Word meaning', 'A1'),
  S('vocabulary.recall', 'שליפת מילה (עברית לאנגלית)', 'Word recall', 'A1'),
  S('vocabulary.context', 'מילה בהקשר', 'Words in context', 'A2'),
  S('vocabulary.synonyms-antonyms', 'מילים נרדפות והפכים', 'Synonyms and antonyms', 'A2'),
  S('vocabulary.collocations', 'צירופי מילים', 'Collocations', 'B1'),
  S('vocabulary.word-formation', 'בניית מילים (תחיליות וסיומות)', 'Word formation', 'B1'),
  S('vocabulary.phrasal-verbs', 'פעלים עם מילת יחס (Phrasal verbs)', 'Phrasal verbs', 'B1'),
  S('vocabulary.idioms', 'ניבים וביטויים', 'Idioms and expressions', 'B2'),

  // Grammar: tenses
  S('grammar.present-simple', 'הווה פשוט', 'Present Simple', 'A1'),
  S('grammar.present-simple.third-person', 'הווה פשוט: גוף שלישי (s)', 'Present Simple: third person -s', 'A1', ['grammar.present-simple']),
  S('grammar.present-simple.questions-negatives', 'הווה פשוט: שאלות ושלילה', 'Present Simple: questions and negatives', 'A1', ['grammar.present-simple']),
  S('grammar.present-progressive', 'הווה מתמשך', 'Present Progressive', 'A1'),
  S('grammar.past-simple', 'עבר פשוט', 'Past Simple', 'A2', ['grammar.present-simple']),
  S('grammar.past-simple.irregular', 'עבר פשוט: פעלים חריגים', 'Past Simple: irregular verbs', 'A2', ['grammar.past-simple']),
  S('grammar.past-simple.questions-negatives', 'עבר פשוט: שאלות ושלילה', 'Past Simple: questions and negatives', 'A2', ['grammar.past-simple']),
  S('grammar.past-progressive', 'עבר מתמשך', 'Past Progressive', 'A2', ['grammar.past-simple']),
  S('grammar.future', 'עתיד (will / going to)', 'Future (will / going to)', 'A2'),
  S('grammar.present-perfect', 'הווה מושלם', 'Present Perfect', 'B1', ['grammar.past-simple']),
  S('grammar.present-perfect.vs-past-simple', 'הווה מושלם מול עבר פשוט', 'Present Perfect vs Past Simple', 'B1', ['grammar.present-perfect']),
  S('grammar.past-perfect', 'עבר מושלם', 'Past Perfect', 'B2', ['grammar.present-perfect']),

  // Grammar: structures
  S('grammar.conditionals', 'משפטי תנאי', 'Conditionals', 'B1'),
  S('grammar.conditionals.first', 'תנאי מסוג ראשון', 'First conditional', 'B1', ['grammar.future']),
  S('grammar.conditionals.second', 'תנאי מסוג שני', 'Second conditional', 'B1', ['grammar.past-simple']),
  S('grammar.conditionals.third', 'תנאי מסוג שלישי', 'Third conditional', 'B2', ['grammar.past-perfect']),
  S('grammar.passive', 'סביל (Passive)', 'Passive voice', 'B1', ['grammar.past-simple']),
  S('grammar.modals', 'פעלים מודאליים', 'Modal verbs', 'A2'),
  S('grammar.relative-clauses', 'משפטי זיקה', 'Relative clauses', 'B1'),
  S('grammar.gerunds-infinitives', 'Gerund ו־Infinitive', 'Gerunds and infinitives', 'B1'),
  S('grammar.articles', 'יידוע (a / an / the)', 'Articles', 'A1'),
  S('grammar.prepositions', 'מילות יחס', 'Prepositions', 'A1'),
  S('grammar.quantifiers', 'כמתים (much / many / few)', 'Quantifiers', 'A2'),
  S('grammar.comparatives', 'השוואה (er / more / most)', 'Comparatives and superlatives', 'A2'),
  S('grammar.word-order', 'סדר מילים', 'Word order', 'A1'),
  S('grammar.connectors', 'מילות קישור', 'Linking words', 'B1'),
  S('grammar.pronouns', 'כינויי גוף ושייכות', 'Pronouns and possessives', 'A1'),
  S('grammar.there-is', 'There is / There are', 'There is / there are', 'A1'),
  S('grammar.plurals', 'רבים', 'Plural nouns', 'A1'),
  S('grammar.adverbs', 'תארי פועל', 'Adverbs', 'A2'),
  S('grammar.used-to', 'Used to', 'Used to', 'A2', ['grammar.past-simple']),
  S('grammar.present-perfect-progressive', 'הווה מושלם מתמשך', 'Present Perfect Progressive', 'B1', ['grammar.present-perfect']),
  S('grammar.modals.deduction', 'מודאליים להסקה (must / can\'t / might)', 'Modals of deduction', 'B2', ['grammar.modals']),
  S('grammar.reported-speech', 'דיבור עקיף', 'Reported speech', 'B1', ['grammar.past-simple']),
  S('grammar.question-tags', 'שאלות זנב (Question tags)', 'Question tags', 'B1'),
  S('grammar.wish', 'Wish / If only', 'Wish and if only', 'B2', ['grammar.conditionals.second']),

  // Reading
  S('reading.details', 'איתור פרטים', 'Finding details', 'A1'),
  S('reading.main-idea', 'רעיון מרכזי', 'Main idea', 'A2'),
  S('reading.inference', 'הסקת מסקנות', 'Inference', 'B1'),
  S('reading.vocabulary-in-context', 'משמעות מילה מתוך הקטע', 'Vocabulary in context', 'A2'),
  S('reading.true-false', 'נכון / לא נכון', 'True / false', 'A1'),
  S('reading.reference', 'הפניה (למה מתייחסת המילה)', 'Reference words', 'A2'),
  S('reading.sequence', 'סדר אירועים', 'Sequence of events', 'A2'),
  S('reading.purpose', 'מטרת הכותב', "Writer's purpose", 'B1'),
  S('reading.fact-opinion', 'עובדה או דעה', 'Fact or opinion', 'B1'),

  // Writing (assessment requires an evaluator, added in a later stage)
  S('writing.sentence', 'כתיבת משפט', 'Writing a sentence', 'A1', undefined, false),
  S('writing.paragraph', 'כתיבת פסקה', 'Writing a paragraph', 'A2', undefined, false),
  S('writing.message-email', 'הודעה ומייל', 'Messages and emails', 'A2', undefined, false),
  S('writing.opinion', 'פסקת דעה', 'Opinion paragraph', 'B1', undefined, false),
  S('writing.spelling', 'איות', 'Spelling', 'A1'),

  // Listening
  S('listening.words', 'זיהוי מילים בשמיעה', 'Recognizing words', 'A1'),
  S('listening.sentences', 'הבנת משפטים', 'Understanding sentences', 'A2'),
  S('listening.dialogues', 'הבנת דיאלוגים', 'Understanding dialogues', 'B1'),

  // Speaking (future: recording + recognition)
  S('speaking.pronunciation', 'הגייה', 'Pronunciation', 'A1', undefined, false),
  S('speaking.conversation', 'שיחה', 'Conversation', 'A2', undefined, false),
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: SkillId): SkillNode | undefined {
  return BY_ID.get(id);
}

export function isKnownSkill(id: SkillId): boolean {
  return BY_ID.has(id);
}

export function parentOf(id: SkillId): SkillId | undefined {
  const i = id.lastIndexOf('.');
  return i === -1 ? undefined : id.slice(0, i);
}

export function domainOf(id: SkillId): Domain {
  return id.split('.')[0] as Domain;
}

/** The skill itself followed by its ancestors up to the domain. */
export function lineage(id: SkillId): SkillId[] {
  const out: SkillId[] = [];
  let cur: SkillId | undefined = id;
  while (cur) {
    out.push(cur);
    cur = parentOf(cur);
  }
  return out;
}

export function childrenOf(id: SkillId): SkillNode[] {
  return SKILLS.filter((s) => parentOf(s.id) === id);
}

export function skillsInDomain(domain: Domain): SkillNode[] {
  return SKILLS.filter((s) => s.domain === domain && s.id !== domain);
}
