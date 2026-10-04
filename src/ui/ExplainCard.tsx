import { useParams } from 'react-router-dom';
import type { Anchor, Explain } from '@/domain/content/schema';
import { useStudent } from '@/app/hooks';
import type { Student } from '@/domain/student/student';
import { En } from './En';
import { He } from './He';
import { SpeakButton } from './SpeakButton';

export type ExplainLevel = 'kids' | 'adult';

/** Up to 12 the simple version; unknown age gets it too, a child must never get the hard one. */
export function explainLevel(student: Pick<Student, 'birthYear'> | null | undefined, now = Date.now()): ExplainLevel {
  if (!student?.birthYear) return 'kids';
  return new Date(now).getFullYear() - student.birthYear <= 12 ? 'kids' : 'adult';
}

/** The level for the student of the current route (/s/:sid/...). */
export function useExplainLevel(): ExplainLevel {
  const { sid } = useParams();
  return explainLevel(useStudent(sid));
}

/**
 * The full explanation of a rule, written for the learner's age: the rule,
 * why Hebrew speakers get it wrong, right and wrong side by side, how to
 * decide in a question, exceptions, and one sentence to remember.
 */
export function ExplainCard({ anchor, explain }: { anchor: Anchor; explain: Explain }) {
  return (
    <article className="explain-card" aria-label={explain.title}>
      <header className="explain-head">
        <span className="anchor-emoji" aria-hidden="true">
          {anchor.emoji}
        </span>
        <h3 className="explain-title">
          <He inline>{explain.title}</He>
        </h3>
      </header>

      <Section icon="📌" label="הכלל">
        <He>{explain.rule}</He>
      </Section>

      <Section icon="🇮🇱" label="למה מתבלבלים">
        <He>{explain.why}</He>
      </Section>

      <Section icon="👀" label="נכון ושגוי">
        <div className="explain-examples">
          {explain.examples.map((e, i) => (
            <div key={i} className="explain-pair">
              <div className="explain-ex" data-tone="ok">
                <span className="explain-mark" aria-label="נכון">✓</span>
                <En as="div" className="grow">{e.ok}</En>
                <SpeakButton text={e.ok} size="inline" />
              </div>
              {e.bad && (
                <div className="explain-ex" data-tone="bad">
                  <span className="explain-mark" aria-label="שגוי">✗</span>
                  <En as="div" className="grow explain-bad">{e.bad}</En>
                </div>
              )}
              <He className="explain-meaning">{e.he}</He>
            </div>
          ))}
        </div>
      </Section>

      {explain.check.length > 0 && (
        <Section icon="🔎" label="איך בודקים">
          <dl className="explain-check">
            {explain.check.map((c, i) => (
              <div key={i}>
                <dt>
                  <He>{c.when}</He>
                </dt>
                <dd>
                  <He>{c.then}</He>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {explain.exceptions && (
        <Section icon="⚠️" label="חריגים">
          <He>{explain.exceptions}</He>
        </Section>
      )}

      <div className="explain-remember">
        <span className="explain-remember-label">לזכור</span>
        <He>{explain.remember}</He>
      </div>
    </article>
  );
}

function Section({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <section className="explain-sec">
      <span className="explain-sec-label">
        <span className="explain-sec-icon" aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      <div className="explain-sec-body">{children}</div>
    </section>
  );
}
