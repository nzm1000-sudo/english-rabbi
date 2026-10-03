import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProfile, useStudent } from '@/app/hooks';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { glossFor, storyWords, type Story, type StoryLine } from '@/domain/content/schema';
import type { ItemOutcome } from '@/domain/learning/events';
import type { SupportLanguage } from '@/domain/learning/languageSupport';
import type { Student } from '@/domain/student/student';
import { ExerciseView } from '@/features/practice/ExerciseView';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SpeakButton } from '@/ui/SpeakButton';
import { TopBar } from '@/ui/TopBar';
import { CheckIcon, CloseIcon, MicIcon, TranslateIcon } from '@/ui/icons';
import { Button, ButtonLink } from '@/ui/Button';
import { Confetti } from '@/ui/Confetti';
import { AudioPlayer } from '@/ui/AudioPlayer';
import { ReadCheck } from '@/ui/ReadCheck';
import { useGloss } from '@/ui/Gloss';
import { resume } from '@/app/resume';

/**
 * Reads one story line by line. Each new line is read aloud. Tapping a word
 * shows its meaning and saves it to "my words". Comprehension questions
 * appear inside the story, after the line they ask about.
 */
export function StoryScreen() {
  const { sid, storyId } = useParams();
  const student = useStudent(sid);
  const profile = useProfile(student);
  const { content } = useServices();
  const story = storyId ? content.stories.get(storyId) : undefined;
  if (student === null || (storyId && !story)) return <main className="screen empty">הסיפור לא נמצא</main>;
  if (!student || !profile || !story) return <main className="screen" />;
  return <StoryReader key={story.id} student={student} story={story} support={profile.supportLanguage} />;
}

function StoryReader({ student, story, support }: { student: Student; story: Story; support: SupportLanguage }) {
  const { store, speech, content } = useServices();
  const prefs = useSpeechPrefs();
  const nav = useNavigate();
  const glossPopup = useGloss();
  // Continue a story where the learner stopped.
  const [savedPlace] = useState(() => resume.getStory(student.id, story.id));
  const [shown, setShown] = useState(() => Math.min(savedPlace?.shown ?? 1, story.lines.length));
  const [answered, setAnswered] = useState<Map<string, boolean>>(() => new Map(savedPlace?.answered ?? []));
  const [translated, setTranslated] = useState<Set<number>>(new Set());
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [checking, setChecking] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const loggedRef = useRef(false);
  const saved = useLiveQuery(() => store.savedWords(student.id), [store, student.id]);
  const savedSet = useMemo(() => new Set((saved ?? []).map((w) => w.lemma)), [saved]);
  const base = `/s/${student.id}`;

  useEffect(() => {
    let sidLocal = '';
    let cancelled = false;
    void store.startSession(student.id, 'story').then((s) => {
      sidLocal = s.id;
      if (cancelled) void store.endSession(s.id, 'left');
      else setSessionId(s.id);
    });
    return () => {
      cancelled = true;
      if (sidLocal) void store.endSession(sidLocal, 'left');
    };
  }, [store, student.id]);

  // The question waiting after the last shown line, if not answered yet.
  const pending = story.questions.find((q) => q.after < shown && !answered.has(q.item.id));
  const finished = shown >= story.lines.length && !pending;
  const correct = [...answered.values()].filter(Boolean).length;

  const say = (line: StoryLine) =>
    void speech.speak(line.en, { ...prefs, key: `story-line-${line.en}`, ...(line.speaker ? { speaker: line.speaker } : {}) });

  useEffect(() => {
    const line = story.lines[shown - 1];
    if (line) say(line);
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    // Speak only when a new line appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  useEffect(() => {
    if (pending) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [pending]);

  useEffect(() => {
    if (finished) resume.clearStory(student.id, story.id);
    else if (shown > 1 || answered.size) resume.saveStory(student.id, story.id, { shown, answered: [...answered] });
  }, [finished, shown, answered, student.id, story.id]);

  useEffect(() => {
    if (!finished || loggedRef.current) return;
    loggedRef.current = true;
    void store.log(student.id, 'story.completed', { storyId: story.id, correct, total: story.questions.length }, sessionId || undefined);
    if (sessionId) void store.endSession(sessionId, 'finished');
  }, [finished, correct, sessionId, store, story, student.id]);

  const onAnswer = (id: string, outcome: ItemOutcome) => {
    const q = story.questions.find((x) => x.item.id === id)!;
    void store.completeItem({ studentId: student.id, ...(sessionId ? { sessionId } : {}), item: q.item, outcome });
    setAnswered((m) => new Map(m).set(id, outcome.finalCorrect && !outcome.revealed));
  };

  // One meaning popup for the whole screen (the questions use it too): it reads
  // the word aloud and saves it to "my words".
  const tapWord = (key: string, word: string, line: string) => {
    const g = glossFor(story, key);
    if (g) glossPopup?.open({ word, senses: [{ lemma: g.lemma, he: g.he }], sentence: line, storyId: story.id });
  };

  // The next story of the same kind (reading or dialogue), in library order.
  const others = [...content.stories.values()].filter((s) => s.kind === story.kind);
  const nextStory = others[others.findIndex((s) => s.id === story.id) + 1];
  const storyWordsSaved = new Set(
    story.lines.flatMap((l) => storyWords(l.en)).flatMap((w) => {
      const g = glossFor(story, w);
      return g && savedSet.has(g.lemma) ? [g.lemma] : [];
    }),
  ).size;

  return (
    <main className="screen story-screen">
      <TopBar back={`${base}/stories`} title={<He>{story.title.he}</He>} />
      <div className="story-head">
        <En className="story-title">{story.title.en}</En>
        <span className="badge badge-accent" lang="en">
          {story.level}
        </span>
      </div>
      <p className="xs muted txt-center">להקיש על מילה כדי לראות מה היא אומרת. המילה תישמר ב״המילים שלי״.</p>

      {shown > 1 && (
        <AudioPlayer segments={story.lines.slice(0, shown).map((l) => ({ text: l.en, ...(l.speaker ? { speaker: l.speaker } : {}) }))} onSegment={setPlayingLine} />
      )}
      <div className="story-lines">
        {story.lines.slice(0, shown).map((line, i) => (
          <div key={i} className={`story-line${line.speaker ? ` story-speaker-${line.speaker}` : ''}`} data-on={playingLine === i}>
            {line.speaker && story.cast && (
              <En className="story-name">{story.cast[line.speaker]}</En>
            )}
            <div className="story-line-main" dir="ltr">
              <p className="grow story-text" lang="en">
                <LineWords text={line.en} story={story} savedSet={savedSet} onTap={(key, word) => tapWord(key, word, line.en)} />
              </p>
              <SpeakButton text={line.en} size="inline" {...(line.speaker ? { speaker: line.speaker } : {})} />
            </div>
            {translated.has(i) && <He className="story-he">{line.he}</He>}
            {checking === i && <ReadCheck text={line.en} />}
            {(checking !== i || !translated.has(i)) && (
              <div className="line-actions">
                {checking !== i && (
                  <button className="mini-btn" onClick={() => setChecking(i)}>
                    <MicIcon size={16} />
                    להקריא ולבדוק
                  </button>
                )}
                {!translated.has(i) && (
                  <button className="mini-btn" onClick={() => setTranslated((t) => new Set(t).add(i))}>
                    <TranslateIcon size={16} />
                    תרגום
                  </button>
                )}
              </div>
            )}
            {story.questions
              .filter((q) => q.after === i && answered.has(q.item.id))
              .map((q) => (
                <div key={q.item.id} className={`story-answered xs ${answered.get(q.item.id) ? 'good' : 'bad'}`}>
                  {answered.get(q.item.id) ? <CheckIcon size={14} /> : <CloseIcon size={14} />}
                  <En>{q.item.prompt}</En>
                </div>
              ))}
          </div>
        ))}
      </div>

      {pending ? (
        <div className="story-question panel">
          <span className="section-label">שאלה על הסיפור</span>
          <ExerciseView key={pending.item.id} item={pending.item} support={support} seed={story.id} onDone={(o) => onAnswer(pending.item.id, o)} />
        </div>
      ) : finished ? (
        <div className="panel stack story-end">
          <Confetti />
          <strong className="txt-center t-h3">
            סיימת את הסיפור!
          </strong>
          {story.moral && <He className="txt-center">{story.moral}</He>}
          <div className="txt-center small muted">
            {correct} מתוך {story.questions.length} תשובות נכונות · {storyWordsSaved === 1 ? 'מילה אחת נשמרה' : `${storyWordsSaved} מילים נשמרו`}
          </div>
          {nextStory && (
            <Button variant="primary" size="lg" block onClick={() => nav(`${base}/stories/${nextStory.id}`)}>
              לסיפור הבא
            </Button>
          )}
          <ButtonLink to={`${base}/words`} size="lg" block>
            המילים שלי
          </ButtonLink>
        </div>
      ) : (
        <div className="actions story-next">
          <Button variant="primary" size="lg" block onClick={() => setShown((n) => n + 1)} autoFocus>
            המשך
          </Button>
        </div>
      )}
      <div ref={endRef} />

    </main>
  );
}

/** A line split into tappable words. Punctuation and spaces stay as text. */
function LineWords({ text, story, savedSet, onTap }: { text: string; story: Story; savedSet: Set<string>; onTap: (key: string, word: string) => void }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part) || !part) return part;
        const m = part.match(/^([^\p{L}\p{N}']*)(.*?)([^\p{L}\p{N}']*)$/u);
        const [, lead = '', core = '', trail = ''] = m ?? [];
        const key = core.toLowerCase().replace(/[‘’]/g, "'");
        const g = core ? glossFor(story, key) : undefined;
        if (!g) return <span key={i} className="wt">{part}</span>;
        return (
          <span key={i} className="wt">
            {lead}
            <button type="button" className="word-tap" data-saved={savedSet.has(g.lemma)} onClick={() => onTap(key, core)}>
              {core}
            </button>
            {trail}
          </span>
        );
      })}
    </>
  );
}
