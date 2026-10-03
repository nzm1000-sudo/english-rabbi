import { Link, useParams } from 'react-router-dom';
import { useServices } from '@/app/services';
import { useProfile, useStudent } from '@/app/hooks';
import { TopBar } from '@/ui/TopBar';
import { Ring } from '@/ui/Ring';
import { DomainIcon } from '@/ui/DomainIcon';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SKILLS, type SkillNode } from '@/domain/skills/taxonomy';
import { CEFR_LEVELS, thetaToLevel, type CefrLevel } from '@/domain/skills/cefr';
import { masteryProbability, masteryStatus } from '@/domain/learning/mastery';
import type { SkillState } from '@/domain/learning/projection';
import { useLiveQuery } from 'dexie-react-hooks';

const LEVEL_NAME: Record<string, string> = { A1: 'צעדים ראשונים', A2: 'בסיס יציב', B1: 'עצמאות', B2: 'שליטה', C1: 'מתקדמים' };

/**
 * The learning path: every skill on one map, ordered by level. Each node shows
 * mastery as a ring; a node that was mastered and is fading shows "לרענן".
 */
export function PathScreen() {
  const { sid } = useParams();
  const { store, content } = useServices();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const skills = useLiveQuery(async () => (sid ? (await store.loadLearnerState(sid)).skills : undefined), [sid, store]);
  if (!student || !profile || !skills) return <main className="screen" />;

  const here = thetaToLevel(profile.overallTheta);
  const levels = CEFR_LEVELS.filter((l) => l !== 'PreA1' && l !== 'C2');
  const nodes = (level: CefrLevel) =>
    SKILLS.filter((s) => s.level === level && s.id.includes('.') && s.assessable !== false && content.items.some((i) => i.skill === s.id || i.skill.startsWith(`${s.id}.`)));

  return (
    <main className="screen">
      <TopBar back={`/s/${student.id}`} title="המסלול שלי" />
      <p className="subtitle txt-center">
        כל עיגול הוא מיומנות. הטבעת מתמלאת ככל שהשליטה עולה.
      </p>
      {levels.map((level) => {
        const list = nodes(level);
        if (!list.length) return null;
        return (
          <section key={level} className="stack">
            <div className={`path-level${level === here ? ' here' : ''}`}>
              <En className="path-level-code">{level}</En>
              <span>{LEVEL_NAME[level]}</span>
              {level === here && <span className="badge badge-accent">הרמה הנוכחית</span>}
            </div>
            <div className="path-col">
              {list.map((s) => (
                <PathNode key={s.id} skill={s} state={skills.get(s.id)} studentId={student.id} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function PathNode({ skill, state, studentId }: { skill: SkillNode; state: SkillState | undefined; studentId: string }) {
  const { content } = useServices();
    const m = state && state.evidence > 0 ? masteryProbability(state, skill.id) : 0;
    const status = state ? masteryStatus(state, skill.id) : 'unseen';
    const lesson = content.lessonsForSkill(skill.id)[0];
    const to = lesson ? `/s/${studentId}/learn/${lesson.id}` : `/s/${studentId}/practice/skill?skill=${encodeURIComponent(skill.id)}`;
    return (
      <Link to={to} className={`path-node tone-${skill.domain}`} data-status={status}>
        <Ring value={m} size={68} stroke={6} onLight>
          <span className="path-icon">
            <DomainIcon domain={skill.domain} size={26} />
          </span>
        </Ring>
        <He className="path-label">{skill.name.he}</He>
      </Link>
    );
  }
