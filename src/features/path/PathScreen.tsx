import { Link, useParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { Ring } from '@/ui/Ring';
import { Art } from '@/ui/Art';
import { DomainIcon } from '@/ui/DomainIcon';
import { He } from '@/ui/He';
import { CheckIcon, TargetIcon } from '@/ui/icons';
import { Stack } from '@/ui/layout';
import { SKILLS, type SkillNode } from '@/domain/skills/taxonomy';
import { CEFR_LEVELS, thetaToLevel, type CefrLevel } from '@/domain/skills/cefr';
import { masteryProbability, masteryStatus, type MasteryStatus } from '@/domain/learning/mastery';
import type { SkillState } from '@/domain/learning/projection';
import { useLiveQuery } from 'dexie-react-hooks';
import { nextStep } from './nextStep';

const LEVEL_NAME: Record<string, string> = { A1: 'צעדים ראשונים', A2: 'בסיס יציב', B1: 'עצמאות', B2: 'שליטה', C1: 'מתקדמים' };
const STATUS_HE: Record<MasteryStatus, string> = { unseen: 'עוד לא התחלנו', learning: 'בתהליך', developing: 'כמעט שם', mastered: 'בשליטה' };

/**
 * The learning path: every skill on one map, ordered by level, two columns.
 * The next step in the current level is marked; finished levels fold up.
 */
export function PathScreen() {
  const { sid } = useParams();
  const { store, content } = useServices();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const skills = useLiveQuery(async () => (sid ? (await store.loadLearnerState(sid)).skills : undefined), [sid, store]);
  if (!student || !profile || !skills) return <main className="screen" />;

  // No answers yet: the level is unknown (the default ability sits on the B1
  // edge), so the path starts from the beginning instead of claiming B1.
  const known = profile.domains.some((d) => d.attempts > 0);
  const here: CefrLevel = known ? thetaToLevel(profile.overallTheta) : 'A1';
  const levels = CEFR_LEVELS.filter((l) => l !== 'PreA1' && l !== 'C2');
  const nodes = (level: CefrLevel) =>
    SKILLS.filter((s) => s.level === level && s.id.includes('.') && s.assessable !== false && content.items.some((i) => i.skill === s.id || i.skill.startsWith(`${s.id}.`)));
  const statusOf = (s: SkillNode): MasteryStatus => {
    const st = skills.get(s.id);
    return st ? masteryStatus(st, s.id) : 'unseen';
  };
  const all = levels.flatMap(nodes);
  const mastered = all.filter((s) => statusOf(s) === 'mastered').length;
  const next = nextStep(levels, here, nodes, (s) => statusOf(s) === 'mastered')?.id;

  return (
    <main className="screen">
      <TopBar back={`/s/${student.id}`} title="המסלול שלי" />
      <section className="path-summary">
        <Art name="path" size={72} tone="primary" fallback={<TargetIcon />} />
        <Stack gap={0} className="grow">
          <span className="eyebrow">הרמה שלי עכשיו</span>
          <span className="path-summary-level">
            {known ? (
              <>
                <span className="num" lang="en">
                  {here}
                </span>{' '}
                {LEVEL_NAME[here] ?? ''}
              </>
            ) : (
              'עוד לא ידועה'
            )}
          </span>
          <span className="small muted">
            <span className="num">{mastered}</span> מתוך <span className="num">{all.length}</span> מיומנויות בשליטה
          </span>
        </Stack>
      </section>

      {levels.map((level) => {
        const list = nodes(level);
        if (!list.length) return null;
        const done = list.filter((s) => statusOf(s) === 'mastered').length;
        const complete = done === list.length;
        const head = (
          <div className="path-level" data-here={level === here}>
            <span className="path-level-code" lang="en">
              {level}
            </span>
            <span className="grow t-strong">{LEVEL_NAME[level]}</span>
            {level === here ? (
              <span className="badge badge-accent">{known ? 'הרמה שלי' : 'מתחילים כאן'}</span>
            ) : complete ? (
              <span className="badge badge-good">
                <CheckIcon size={14} /> הושלם
              </span>
            ) : null}
            <span className="small muted num">
              {done}/{list.length}
            </span>
          </div>
        );
        const grid = (
          <div className="path-grid">
            {list.map((s) => (
              <PathNode key={s.id} skill={s} state={skills.get(s.id)} status={statusOf(s)} next={s.id === next} studentId={student.id} />
            ))}
          </div>
        );
        // Finished levels fold up so the map opens where the work is.
        return complete ? (
          <details key={level} className="path-section">
            <summary>{head}</summary>
            {grid}
          </details>
        ) : (
          <section key={level} className="path-section stack gap-3" aria-label={`${level} ${LEVEL_NAME[level]}`}>
            {head}
            {grid}
          </section>
        );
      })}
    </main>
  );
}

function PathNode({ skill, state, status, next, studentId }: { skill: SkillNode; state: SkillState | undefined; status: MasteryStatus; next: boolean; studentId: string }) {
  const { content } = useServices();
  const m = state && state.evidence > 0 ? masteryProbability(state, skill.id) : 0;
  const lesson = content.lessonsForSkill(skill.id)[0];
  const to = lesson ? `/s/${studentId}/learn/${lesson.id}` : `/s/${studentId}/practice/skill?skill=${encodeURIComponent(skill.id)}`;
  return (
    <Link to={to} className={`path-node tone-${skill.domain}`} data-status={status} data-next={next || undefined}>
      {next && <span className="path-next">הצעד הבא</span>}
      <Ring value={m} size={48} stroke={4} onLight>
        <span className="path-icon">{status === 'mastered' ? <CheckIcon size={20} /> : <DomainIcon domain={skill.domain} size={20} />}</span>
      </Ring>
      <span className="path-text">
        <He inline className="path-label clamp-2">
          {skill.name.he}
        </He>
        <span className="path-status">{STATUS_HE[status]}</span>
      </span>
    </Link>
  );
}
