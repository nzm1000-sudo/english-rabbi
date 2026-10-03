/**
 * A Hebrew count: "מילה אחת" for one (the number comes after the noun and
 * agrees with it), "3 מילים" otherwise. `one` is the full singular phrase.
 */
export function heCount(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}
