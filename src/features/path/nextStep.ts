/**
 * The skill marked "next step" on the path: the first unfinished skill at the
 * learner's level; when that level is finished (or has no skills, e.g. C1),
 * the first unfinished skill above it, then any gap left below it.
 */
export function nextStep<L, S>(levels: readonly L[], here: L, nodes: (level: L) => S[], done: (skill: S) => boolean): S | undefined {
  const i = Math.max(0, levels.indexOf(here));
  const order = [...levels.slice(i), ...levels.slice(0, i).reverse()];
  for (const level of order) {
    const s = nodes(level).find((x) => !done(x));
    if (s !== undefined) return s;
  }
  return undefined;
}
