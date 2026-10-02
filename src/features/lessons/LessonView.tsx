import type { Lesson, LessonBlock } from '@/domain/content/schema';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SpeakButton } from '@/ui/SpeakButton';

/** Renders a lesson: Hebrew explanation, English examples with audio, tables, typical mistakes. */
export function LessonView({ lesson }: { lesson: Lesson }) {
  return (
    <article className="stack" style={{ gap: 'var(--s-4)' }}>
      <header className="stack" style={{ gap: 4 }}>
        <h2 className="title" style={{ fontSize: 'var(--t-xl)' }}>
          {lesson.title.he}
        </h2>
        <En as="p" className="muted small">
          {lesson.title.en}
        </En>
        <p className="muted"><He>{lesson.goal}</He></p>
      </header>
      {lesson.blocks.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </article>
  );
}

function Block({ b }: { b: LessonBlock }) {
  switch (b.kind) {
    case 'text':
      return (
        <div className="stack" style={{ gap: 4 }}>
          <p><He>{b.he}</He></p>
          {b.en && <En as="p" className="small muted">{b.en}</En>}
        </div>
      );
    case 'rule':
      return (
        <div className="rule-box">
          <span className="small"><He>{b.he}</He></span>
          <En as="p" className="" >
            <strong style={{ fontSize: 'var(--t-lg)' }}>{b.pattern}</strong>
          </En>
        </div>
      );
    case 'examples':
      return (
        <div className="list">
          {b.items.map((e, i) => (
            <div key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow stack" style={{ gap: 2 }}>
                <En>{e.en}</En>
                {e.he && <He className="small muted">{e.he}</He>}
                {e.note && <He className="xs muted">{e.note}</He>}
              </div>
              <SpeakButton text={e.en} />
            </div>
          ))}
        </div>
      );
    case 'mistake':
      return (
        <div className="panel stack" style={{ gap: 6 }}>
          <div className="row small">
            <span className="badge badge-bad">לא</span>
            <En className="grow" ><s>{b.wrong}</s></En>
          </div>
          <div className="row small">
            <span className="badge badge-good">כן</span>
            <En className="grow">{b.right}</En>
            <SpeakButton text={b.right} />
          </div>
          <p className="small muted"><He>{b.he}</He></p>
        </div>
      );
    case 'tip':
      return (
        <div className="feedback feedback-hint">
          <span className="xs muted">טיפ</span>
          <He>{b.he}</He>
        </div>
      );
    case 'table':
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>{b.head.map((h, i) => <th key={i}><He>{h}</He></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}><He>{c}</He></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
