import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProfile, useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { CEFR_LEVELS } from '@/domain/skills/cefr';
import type { Speaker } from '@/services/speech/types';
import { seededShuffle } from '@/features/practice/shuffle';
import { storyLevelFor } from '@/features/stories/StoriesScreen';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SpeakButton } from '@/ui/SpeakButton';
import { TopBar } from '@/ui/TopBar';
import { ReadCheck, type ReadCheckOutcome } from '@/ui/ReadCheck';
import { Art } from '@/ui/Art';
import { Button, ButtonLink } from '@/ui/Button';
import { MicIcon } from '@/ui/icons';

const ROUND = 8;

/**
 * Shadowing in three steps: 1. listen, 2. record yourself reading, 3. see
 * which words were right and hear your recording. Everything stays on the
 * phone.
 */
export function ShadowScreen() {
  const { sid } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const { content, store } = useServices();
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<ReadCheckOutcome | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const sentences = useMemo(() => {
    if (!student || !profile) return [];
    const fit = CEFR_LEVELS.indexOf(storyLevelFor(student, profile));
    const lines = [...content.stories.values()]
      .filter((s) => Math.abs(CEFR_LEVELS.indexOf(s.level) - fit) <= 1)
      .flatMap((s) => s.lines.map((l) => ({ text: l.en, speaker: (l.speaker ?? 'A') as Speaker })))
      .filter((l) => {
        const n = l.text.split(/\s+/).length;
        return n >= 3 && n <= 12;
      });
    return seededShuffle(lines, `${student.id}:${new Date().toDateString()}`).slice(0, ROUND);
  }, [content, student, profile]);

  if (student === null) return <main className="screen empty">התלמיד לא נמצא</main>;
  if (!student || !profile) return <main className="screen" />;
  const base = `/s/${student.id}`;
  const current = sentences[index];

  if (!current) {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return (
      <main className="screen">
        <TopBar back={base} title="חזרה בקול" />
        <div className="panel empty-state">
          <Art name="speaking" size={104} tone="speaking" fallback={<MicIcon />} />
          <strong className="t-h3">{!sentences.length ? 'אין עדיין משפטים לתרגול' : scores.length ? 'כל הכבוד על התרגול!' : 'הסבב הסתיים'}</strong>
          {scores.length > 0 && (
            <He className="muted">{avg >= 0.9 ? 'נשמע מצוין. מחר אפשר לנסות משפטים ארוכים יותר.' : 'כל חזרה משפרת את ההגייה. מחר עוד סבב.'}</He>
          )}
          <ButtonLink to={base} variant="primary" size="lg" block>
            למסך הבית
          </ButtonLink>
        </div>
      </main>
    );
  }

  const next = () => {
    const score = outcome?.result?.score;
    if (outcome) {
      void store.log(student.id, 'speaking.shadowed', { text: current.text, rating: score === undefined ? 2 : score >= 0.9 ? 3 : score >= 0.6 ? 2 : 1 });
      if (score !== undefined) setScores((s) => [...s, score]);
    }
    setOutcome(null);
    setIndex((i) => i + 1);
  };

  return (
    <main className="screen">
      <TopBar back={base} title="חזרה בקול" end={<span className="session-count" dir="ltr">{index + 1}/{sentences.length}</span>} />

      <div className="prompt-card shadow-card">
        <En as="p" className="prompt shadow-text">
          {current.text}
        </En>
      </div>

      <section className="shadow-step">
        <span className="shadow-num">1</span>
        <div className="grow stack gap-2">
          <strong>להקשיב</strong>
          <div className="row">
            <SpeakButton text={current.text} speaker={current.speaker} large label="להקשיב" />
            <SpeakButton text={current.text} speaker={current.speaker} slow label="להקשיב לאט" />
          </div>
        </div>
      </section>

      <section className="shadow-step">
        <span className="shadow-num">2</span>
        <div className="grow stack gap-2">
          <strong>לקרוא בקול ולבדוק</strong>
          <ReadCheck key={current.text} text={current.text} onDone={setOutcome} />
        </div>
      </section>

      <Button variant={outcome ? 'primary' : 'tertiary'} size="lg" block onClick={next}>
        {outcome ? 'למשפט הבא' : 'לדלג על המשפט'}
      </Button>
    </main>
  );
}
