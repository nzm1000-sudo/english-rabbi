import type { Anchor } from '@/domain/content/schema';
import { En } from './En';
import { He } from './He';
import { SpeakButton } from './SpeakButton';
import { LessonIcon } from './icons';
import { ExplainCard, useExplainLevel } from './ExplainCard';

/**
 * Memory anchor: the same picture comes back with every mistake of this kind,
 * so the rule is remembered as an image, not as a sentence.
 */
export function AnchorCard({ anchor, compact = false }: { anchor: Anchor; compact?: boolean }) {
  const level = useExplainLevel();
  // A full explanation for the learner's age replaces the short card.
  if (!compact && anchor.levels) return <ExplainCard anchor={anchor} explain={anchor.levels[level]} />;
  return (
    <div className="anchor-card">
      <div className="anchor-head">
        <span className="anchor-emoji" aria-hidden="true">
          {anchor.emoji}
        </span>
        <span className="stack gap-0">
          <span className="eyebrow">תמונה לזכור</span>
          <strong>
            <He inline>{anchor.title}</He>
          </strong>
        </span>
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
            <div key={i} className="anchor-example">
              <span className="grow stack gap-0">
                <En as="div">{e.en}</En>
                <He className="small muted">{e.he}</He>
              </span>
              <SpeakButton text={e.en} size="inline" />
            </div>
          ))}
        </div>
      )}
      {!compact && anchor.hebrewTrap && (
        <div className="anchor-trap">
          <LessonIcon size={18} />
          <He className="small">{anchor.hebrewTrap}</He>
        </div>
      )}
    </div>
  );
}
