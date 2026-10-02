import type { AudioCache } from '@/services/speech/tts/remoteProvider';
import type { TutorDB } from './schema';

/** IndexedDB audio cache with a size cap. Least recently used entries go first. */
export class DexieAudioCache implements AudioCache {
  constructor(private readonly db: TutorDB, private readonly maxBytes = 60 * 1024 * 1024, private readonly clock = Date.now) {}

  async get(key: string): Promise<Blob | undefined> {
    const row = await this.db.ttsCache.get(key);
    if (!row) return undefined;
    await this.db.ttsCache.update(key, { lastUsedAt: this.clock() });
    return row.blob;
  }

  async put(key: string, blob: Blob, meta: { provider: string; voiceId: string; text: string }): Promise<void> {
    const now = this.clock();
    await this.db.ttsCache.put({ key, blob, bytes: blob.size, createdAt: now, lastUsedAt: now, ...meta });
    await this.evict();
  }

  private async evict(): Promise<void> {
    const rows = await this.db.ttsCache.orderBy('lastUsedAt').toArray();
    let total = rows.reduce((s, r) => s + r.bytes, 0);
    for (const r of rows) {
      if (total <= this.maxBytes) break;
      await this.db.ttsCache.delete(r.key);
      total -= r.bytes;
    }
  }
}
