/**
 * One-time family setup link: #/setup?d=<encoded JSON [{ n: name, a: age }]>.
 * Names live only in the link (the URL fragment is never sent to a server)
 * and on the device, never in the source code or the published site.
 */
export interface FamilyMember {
  name: string;
  age?: number;
}

export function encodeFamily(members: FamilyMember[]): string {
  return encodeURIComponent(JSON.stringify(members.map((m) => ({ n: m.name, ...(m.age ? { a: m.age } : {}) }))));
}

export function decodeFamily(d: string | null): FamilyMember[] {
  if (!d) return [];
  try {
    const raw = JSON.parse(d) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x): x is { n: string; a?: number } => !!x && typeof x.n === 'string' && x.n.trim().length > 0 && x.n.length <= 40)
      .slice(0, 12)
      .map((x) => ({ name: x.n.trim(), ...(typeof x.a === 'number' && x.a >= 2 && x.a < 120 ? { age: Math.round(x.a) } : {}) }));
  } catch {
    return [];
  }
}

export function birthYearFromAge(age: number, now = new Date()): number {
  return now.getFullYear() - age;
}
