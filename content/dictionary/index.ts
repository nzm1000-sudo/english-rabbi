/**
 * App-wide English to Hebrew dictionary for tap-to-translate. Keys are the
 * lowercase word as written ("went", "don't"); values are 1 or 2 senses.
 * Loaded lazily: it is only needed after the first tap.
 */
const parts = import.meta.glob('./part-*.json', { eager: true, import: 'default' });

export type Sense = { lemma: string; he: string };
export const dictionary: Record<string, Sense[]> = Object.assign({}, ...Object.values(parts));
