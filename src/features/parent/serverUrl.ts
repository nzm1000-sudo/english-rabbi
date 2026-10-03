/** "192.168.1.20:8880" is how people type it; fetch needs the scheme. */
export function normalizeServerUrl(raw: string): string {
  const u = raw.trim().replace(/\/+$/, '');
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `http://${u}`;
}
