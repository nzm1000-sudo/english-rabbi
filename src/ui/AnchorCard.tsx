import type { Anchor } from '@/domain/content/schema';
import { En } from './En';
import { He } from './He';
import { SpeakButton } from './SpeakButton';

/**
 * Memory anchor: the same picture comes back with every mistake of this kind,
 * so the rule is remembered as an image, not as a sentence.
 */
export function AnchorCard({ anchor, compact = false }: { anchor: Anchor; compact?: boolean }) {
  return (
    <div className="anchor-card">
      <div className="anchor-head">
        <span className="anchor-emoji" aria-hidden="true">
          {anchor.emoji}
        </span>
        <strong>
          <He>{anchor.title}</He>
        </strong>
      </div>
      <He className="anchor-image">{anchor.image}</He>
      {anchor.pattern && (
        <div className="anchor-pattern" dir="ltr">
          <He>{anchor.pattern}</He>
        </div>
      )}
      {!compact && anchor.rule && <He className="small">{anchor.rule}</He>}
      {!compact && anchor.examples.length > 0 && (
        <div className="stack gap-1">
          {anchor.examples.map((e, i) => (
            <div key={i} className="row gap-2">
              <SpeakButton text={e.en} />
              <span className="grow stack gap-0">
                <En className="small">{e.en}</En>
                <He className="xs muted">{e.he}</He>
              </span>
            </div>
          ))}
        </div>
      )}
      {!compact && anchor.hebrewTrap && (
        <He className="small anchor-trap">{`💡 ${anchor.hebrewTrap}`}</He>
      )}
    </div>
  );
}
