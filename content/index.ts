import { buildRegistry, type ContentRegistry } from '@/domain/content/registry';
import sources from './sources.json';

/**
 * Content entry point. Every JSON file in ./packs is loaded and validated.
 * To add content, drop a new pack file in ./packs (and misconceptions in
 * ./misconceptions). No code changes needed. See content/AUTHORING.md.
 */
const packModules = import.meta.glob('./packs/*.json', { eager: true, import: 'default' });
const anchorModules = import.meta.glob('./anchors/*.json', { eager: true, import: 'default' });
const misconceptionModules = import.meta.glob('./misconceptions/*.json', { eager: true, import: 'default' });

const authored = Object.values(packModules);

export const contentRegistry: ContentRegistry = buildRegistry({
  anchors: Object.values(anchorModules).flat() as unknown[],
  packs: authored,
  sources: sources as unknown[],
  misconceptions: Object.values(misconceptionModules).flat() as unknown[],
});

if (import.meta.env.DEV && contentRegistry.issues.length) {
  console.warn('[content] load issues', contentRegistry.issues);
}
