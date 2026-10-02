import { buildRegistry, type ContentRegistry } from '@/domain/content/registry';
import sources from './sources.json';
import misconceptions from './misconceptions.json';

/**
 * Content entry point. Every JSON file in ./packs is loaded and validated.
 * To add content, drop a new pack file in ./packs. No code changes needed.
 */
const packModules = import.meta.glob('./packs/*.json', { eager: true, import: 'default' });

export const contentRegistry: ContentRegistry = buildRegistry({
  packs: Object.values(packModules),
  sources: sources as unknown[],
  misconceptions: misconceptions as unknown[],
});

if (import.meta.env.DEV && contentRegistry.issues.length) {
  console.warn('[content] load issues', contentRegistry.issues);
}
