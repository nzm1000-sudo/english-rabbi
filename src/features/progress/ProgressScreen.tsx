import { useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { En } from '@/ui/En';
import { RANKS, achievements, rankOf } from '@/domain/learning/progression';
import { useGameHistory } from '@/features/practice/useGameHistory';
import { domainNameHe } from '@/domain/student/profile';
import { CheckIcon, StarIcon } from '@/ui/icons';

/** Child-facing progress: rank, what is needed for the next one, achievements, levels. */
export function ProgressScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const games = useGameHistory(student?.id);
  if (!student || !profile) return <main className="screen" />;
  const r = rankOf(profile);
  const ach = achievements(profile, games ?? []);

  return (
    <main className="screen">
      <TopBar back={`/s/${student.id}`} title="ההתקדמות שלי" />

      <section className="result-hero start">
        <div className="rank">
          <span className="rank-badge">{r.current.level}</span>
          <div className="grow">
            <div className="t-h2">
              {r.current.he} <En className="small">{r.current.name}</En>
            </div>
            <div className="small muted">
              דרגה {r.current.level} מתוך {RANKS.length}
            </div>
          </div>
        </div>
        {r.next && (
          <>
            <div className="progress" role="progressbar" aria-valuenow={Math.round(r.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
            </div>
            <div className="small">
              לדרגה הבאה ({r.next.he}): {r.missing.join(' · ')}
            </div>
            <p className="xs muted">דרגה עולה רק כשיש גם נקודות, גם מילים שנזכרות לאורך זמן, וגם מיומנויות בשליטה. אי אפשר לעלות רק מכמות.</p>
          </>
        )}
      </section>

      <section className="stack">
        <span className="section-label">הרמה שלי בכל תחום</span>
        <div className="list">
          {profile.domains
            .filter((d) => d.attempts > 0)
            .map((d) => (
              <div key={d.domain} className="list-item">
                <span className="grow">{domainNameHe(d.domain)}</span>
                <En className="small">{d.level ?? '—'}</En>
              </div>
            ))}
          {!profile.domains.some((d) => d.attempts > 0) && <div className="list-item muted">עוד אין מספיק תשובות</div>}
        </div>
      </section>

      <section className="stack">
        <span className="section-label">
          הישגים ({ach.filter((a) => a.earned).length}/{ach.length})
        </span>
        <div className="grid-2">
          {ach.map((a) => (
            <div key={a.id} className={`tile compact ${a.earned ? 'tile-solid tone-games' : ''}`} aria-disabled={!a.earned}>
              <span className="tile-icon">{a.earned ? <CheckIcon size={20} /> : <StarIcon size={20} />}</span>
              <strong>{a.title}</strong>
              <span className="tile-sub">{a.description}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
