import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChoiceItem, ContentItem, FixItem, OrderItem, Passage, TypedItem } from '@/domain/content/schema';
import { checkChoice, checkFix, checkOrder, checkTyped, fixTokens, orderTokens, type CheckResult } from '@/domain/learning/answerCheck';
import { flowReducer, initialFlow, isFinished, toOutcome, type FlowPolicy, type FlowState } from '@/domain/learning/exerciseFlow';
import { chooseText, type SupportLanguage } from '@/domain/learning/languageSupport';
import type { ItemOutcome } from '@/domain/learning/events';
import type { Bilingual } from '@/domain/content/schema';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SpeakButton } from '@/ui/SpeakButton';
import { GlossScope, TapText } from '@/ui/Gloss';
import { questionSpeech, splitSentences } from '@/services/speech/textPrep';
import { AudioPlayer } from '@/ui/AudioPlayer';
import { seededShuffle } from './shuffle';
import { useServices } from '@/app/services';
import { domainOf } from '@/domain/skills/taxonomy';
import { CheckIcon, InfoIcon, LessonIcon, XIcon } from '@/ui/icons';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { LessonView } from '@/features/lessons/LessonView';
import { AnchorCard } from '@/ui/AnchorCard';
import { sounds } from '@/services/sound';

/** Taps on "המשך" sooner than this after answering are the tail of a double tap. */
export const CONTINUE_DELAY_MS = 350;

type Props = {
  item: Exclude<ContentItem, { type: 'open-writing' }>;
  passage?: Passage | undefined;
  support: SupportLanguage;
  seed: string;
  policy?: FlowPolicy;
  /** full: explanation + Continue. brief: flash and auto-advance. none: advance at once. */
  feedback?: 'full' | 'brief' | 'none';
  /** Called once, the moment the item is answered (before any feedback), to save the answer. */
  onAnswer?: (outcome: ItemOutcome) => unknown;
  onDone: (outcome: ItemOutcome) => void;
  /** False in timed rounds: a tapped word shows its meaning but is not kept in "my words". */
  saveWords?: boolean;
};

/**
 * One exercise. Implements "teach, don't solve": wrong answers unlock a hint,
 * a second hint, an explanation, and only then the answer.
 */
export function ExerciseView({ item, passage, support, seed, policy = 'teach', feedback = 'full', onAnswer, onDone, saveWords = true }: Props) {
  const [flow, dispatch] = useReducer(
    (s: FlowState, a: Parameters<typeof flowReducer>[1]) => flowReducer(s, a, item.hints.length, policy),
    Date.now(),
    initialFlow,
  );
  const [last, setLast] = useState<CheckResult | null>(null);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const { content, speech } = useServices();
  // Moving to the next item or leaving the session stops this item's audio.
  useEffect(() => () => speech.stop(), [speech]);
  const lesson = content.lessonsForSkill(item.skill)[0];
  const finished = isFinished(flow);
  // Translating words must not give the answer away: vocabulary items and
  // tests unlock it only after answering.
  const glossLocked = !finished && (domainOf(item.skill) === 'vocabulary' || policy === 'test');

  useEffect(() => {
    if (flow.phase === 'solved') sounds.correct();
    else if (flow.phase === 'revealed') sounds.wrong();
  }, [flow.phase]);

  // The answer is saved when given, not on "המשך": leaving on the feedback
  // must not lose it (and a test answer must not be tried again).
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;
  useEffect(() => {
    if (!finished) return;
    // A failed save is retried by "המשך", which reports the error.
    void Promise.resolve(answerRef.current?.(toOutcome(flow))).catch(() => {});
    // Once per answer: later flow changes (replays) do not save again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // Quick modes move on by themselves.
  useEffect(() => {
    if (!finished || feedback === 'full') return;
    const t = setTimeout(() => onDone(toOutcome(flow)), feedback === 'brief' ? 650 : 0);
    return () => clearTimeout(t);
  }, [finished, feedback, flow, onDone]);
  // "המשך" sits where "בדיקה" was: the second tap of a double tap on
  // "בדיקה" must not skip the feedback. Continue works a moment later.
  const [continueArmed, setContinueArmed] = useState(false);
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => setContinueArmed(true), CONTINUE_DELAY_MS);
    return () => clearTimeout(t);
  }, [finished]);
  const onContinue = () => {
    if (continueArmed) onDone(toOutcome(flow));
  };
  const listen = item.modality === 'listen';
  const audioText = ('audioText' in item && item.audioText) || item.prompt;
  const canSpeakPrompt = listen || (!!item.word && item.prompt === item.word.lemma);
  const instruction = chooseText(item.instruction, support);
  // Action bar: never three styles in one bar. Skip moves out of the bar
  // (a quiet text button under the answers) whenever there is a main action.
  const hasCheck = !(feedback === 'brief' && item.type === 'choice');
  const hasHint = policy === 'teach';
  const skipInline = hasCheck || hasHint;

  const submit = (answer: string, result: CheckResult) => {
    setLast(result);
    dispatch({
      type: 'submit',
      attempt: {
        answer,
        correct: result.correct,
        ...(result.misconception ? { misconception: result.misconception } : {}),
        ...(result.nearMiss ? { nearMiss: true } : {}),
        atMs: Date.now(),
      },
    });
  };

  return (
    <GlossScope save={saveWords}>
      <div className="exercise">
        <div className={`ex-instruction tone-${domainOf(item.skill)}`}>
          <span className="dot" />
          <BiText text={instruction} />
        </div>

        {passage && <PassagePanel passage={passage} locked={glossLocked || (item.skill === 'reading.vocabulary-in-context' && !finished)} />}

        {listen && (
          <div className="listen-stage">
            <SpeakButton text={audioText} size="hero" label="השמעה" onPlayed={() => dispatch({ type: 'replay' })} />
            <SpeakButton text={audioText} slow label="השמעה איטית מאוד" onPlayed={() => dispatch({ type: 'replay' })} />
          </div>
        )}

        {(item.type === 'order' ? item.promptLanguage === 'he' : item.type !== 'fix') && (
          <Prompt item={item} finished={finished} canSpeak={canSpeakPrompt && !listen} glossLocked={glossLocked} />
        )}

        {item.type === 'order' ? (
          <OrderInput item={item} seed={seed} flow={flow} onSubmit={submit} />
        ) : item.type === 'fix' ? (
          <FixInput item={item} seed={seed} flow={flow} onSubmit={submit} />
        ) : item.type === 'choice' ? (
          <ChoiceInput
            item={item}
            seed={seed}
            flow={flow}
            instant={feedback === 'brief'}
            onChange={() => dispatch({ type: 'change-selection' })}
            onSubmit={submit}
          />
        ) : (
          <TypedInput item={item} flow={flow} onSubmit={submit} />
        )}

        {policy === 'teach' && <Help item={item} flow={flow} last={last} support={support} />}

        {lesson && feedback === 'full' && flow.explanationShown && !finished && (
          <LessonLink title={lesson.title.he} onOpen={() => setLessonOpen(true)} />
        )}

        {!finished && skipInline && (
          <Button variant="tertiary" className="self-center" onClick={() => dispatch({ type: 'skip', at: Date.now() })}>
            לדלג על השאלה
          </Button>
        )}

        <Sheet open={lessonOpen} onClose={() => setLessonOpen(false)} label={lesson?.title.he ?? 'שיעור'}>
          {lesson && <LessonView lesson={lesson} />}
        </Sheet>

        {finished && feedback === 'full' ? (
          <>
            <FeedbackStrip
              item={item}
              flow={flow}
              support={support}
              onWhy={() => setWhyOpen(true)}
              onContinue={onContinue}
            />
            <Sheet
              open={whyOpen}
              onClose={() => setWhyOpen(false)}
              label="הסבר"
              title="הסבר"
              footer={
                <Button variant="primary" size="lg" block onClick={onContinue}>
                  המשך
                </Button>
              }
            >
              <Explanation
                item={item}
                flow={flow}
                support={support}
                listen={listen}
                audioText={audioText}
                onLesson={
                  lesson
                    ? () => {
                        setWhyOpen(false);
                        setLessonOpen(true);
                      }
                    : undefined
                }
                lessonTitle={lesson?.title.he}
              />
            </Sheet>
          </>
        ) : (
          !finished && (
            <div className="actions">
              <div className={`btn-row${hasHint && hasCheck ? ' lead' : ''}`}>
                {hasHint && (
                  <Button size="lg" onClick={() => dispatch({ type: 'hint' })} disabled={flow.explanationShown}>
                    רמז
                  </Button>
                )}
                {hasCheck && (
                  <Button variant="primary" size="lg" form={`answer-${item.id}`} type="submit">
                    {feedback === 'none' ? 'הבא' : 'בדיקה'}
                  </Button>
                )}
                {!skipInline && (
                  <Button size="lg" onClick={() => dispatch({ type: 'skip', at: Date.now() })}>
                    דילוג
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </GlossScope>
  );
}

/** "לשיעור המלא": the lesson title stays one Hebrew line, English kept inline. */
function LessonLink({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <button type="button" className="lesson-link" onClick={onOpen}>
      <span className="tile-icon sm tone-primary">
        <LessonIcon size={18} />
      </span>
      <span className="grow stack gap-0">
        <span className="t-micro muted">לשיעור המלא</span>
        <He inline className="t-strong">{title}</He>
      </span>
    </button>
  );
}

/** Reading passage: seekable player, the sentence being read is highlighted, words can be tapped. */
function PassagePanel({ passage, locked }: { passage: Passage; locked: boolean }) {
  const sentences = useMemo(() => splitSentences(passage.text), [passage.text]);
  const segments = useMemo(() => sentences.map((text) => ({ text })), [sentences]);
  const [on, setOn] = useState<number | null>(null);
  return (
    <div className="panel stack">
      <En className="small muted">{passage.title}</En>
      <AudioPlayer segments={segments} onSegment={setOn} />
      <p className="passage" dir="ltr" lang="en">
        {sentences.map((s, i) => (
          <span key={i}>
            <span className="sent" data-on={on === i}>
              <TapText text={s} locked={locked} />
            </span>{' '}
          </span>
        ))}
      </p>
    </div>
  );
}

function Prompt({ item, finished, canSpeak, glossLocked }: { item: Props['item']; finished: boolean; canSpeak: boolean; glossLocked: boolean }) {
  if (item.type === 'fix') return null;
  const isHe = 'promptLanguage' in item && item.promptLanguage === 'he';
  const isWord = !!item.word && (item.prompt === item.word.lemma || item.prompt === item.word.he);
  const fill = finished ? modelAnswer(item) : undefined;
  const content = renderCloze(item.prompt, fill, isHe ? undefined : { locked: glossLocked });
  const speakText = canSpeak ? item.prompt : finished && fill && item.prompt.includes('___') ? item.prompt.replace('___', fill) : questionSpeech(item.prompt);
  const speak = (canSpeak || !isHe) && <SpeakButton text={speakText} label={canSpeak ? 'השמעה' : 'הקראת השאלה'} />;
  // English prompts read left to right with the speaker at the line's end.
  return (
    <div className={`prompt-card prompt-row${isWord ? ' is-word' : ''}`} dir={isHe ? 'rtl' : 'ltr'}>
      {isHe ? (
        <p className={`grow ${isWord ? 'prompt-word' : 'prompt'}`}>{typeof content === 'string' ? <He>{content}</He> : content}</p>
      ) : (
        <En as="p" className={`grow ${isWord ? 'prompt-word' : 'prompt'}`}>
          {content}
        </En>
      )}
      {speak}
    </div>
  );
}

function modelAnswer(item: Props['item']): string | undefined {
  if (item.type === 'typed') return item.answers[0];
  if (item.type === 'order') return item.answer;
  if (item.type === 'fix') return item.corrected;
  return item.options.find((o) => o.id === item.correctOptionId)?.text;
}

/** Build the sentence: tap tiles from the bank into the answer line; tap again to remove. */
function OrderInput({ item, seed, flow, onSubmit }: { item: OrderItem; seed: string; flow: FlowState; onSubmit: (answer: string, r: CheckResult) => void }) {
  const tiles = useMemo(() => {
    const words = [...orderTokens(item), ...item.distractors.map((d) => d.text)].map((text, i) => ({ id: i, text }));
    let shuffled = seededShuffle(words, `${seed}:${item.id}`);
    // Never start in the correct order.
    if (shuffled.slice(0, orderTokens(item).length).map((w) => w.text).join(' ') === orderTokens(item).join(' ')) shuffled = [...shuffled.slice(1), shuffled[0]!];
    return shuffled;
  }, [item, seed]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [empty, setEmpty] = useState(false);
  const finished = isFinished(flow);
  const endMark = /[?!]$/.test(item.answer.trim()) ? item.answer.trim().slice(-1) : '.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (finished) return;
    if (!placed.length) return setEmpty(true);
    const words = placed.map((id) => tiles.find((t) => t.id === id)!.text);
    onSubmit(words.join(' '), checkOrder(item, words));
  };

  return (
    <form id={`answer-${item.id}`} onSubmit={submit} className="stack gap-4">
      <div className="order-line prompt-card" dir="ltr" lang="en" aria-label="המשפט שלך">
        {placed.length === 0 && <span className="muted small" dir="rtl" lang="he">להקיש על המילים למטה</span>}
        {placed.map((id) => (
          <button key={id} type="button" className="word-tile placed" disabled={finished} onClick={() => setPlaced((p) => p.filter((x) => x !== id))}>
            {tiles.find((t) => t.id === id)!.text}
          </button>
        ))}
        {/* The end mark is fixed, so a statement cannot be rebuilt as a question. */}
        <span className="order-end" aria-label={endMark === '?' ? 'שאלה' : 'משפט'}>
          {endMark}
        </span>
      </div>
      <div className="order-bank" dir="ltr" lang="en">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            className="word-tile"
            disabled={finished || placed.includes(t.id)}
            data-used={placed.includes(t.id)}
            onClick={() => {
              setPlaced((p) => [...p, t.id]);
              setEmpty(false);
            }}
          >
            {t.text}
          </button>
        ))}
      </div>
      {empty && <EmptyAnswer>קודם להקיש על המילים ולבנות מהן משפט.</EmptyAnswer>}
    </form>
  );
}

/**
 * Spot the mistake: tap the wrong word, then choose its fix. A wrong word
 * counts as an attempt at once; the right word opens the fixes.
 */
function FixInput({ item, seed, flow, onSubmit }: { item: FixItem; seed: string; flow: FlowState; onSubmit: (answer: string, r: CheckResult) => void }) {
  const tokens = useMemo(() => fixTokens(item), [item]);
  const fixes = useMemo(() => seededShuffle([item.correction, ...item.distractors], `${seed}:${item.id}`), [item, seed]);
  const [picked, setPicked] = useState<number | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const finished = isFinished(flow);
  const missed = new Set(flow.attempts.filter((a) => !a.correct).map((a) => a.answer));

  const tap = (i: number) => {
    if (finished) return;
    setEmpty(false);
    if (i !== item.wrongIndex) {
      onSubmit(`${i}:`, checkFix(item, i, null));
      return;
    }
    setPicked(i);
    setChoice(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (finished) return;
    if (picked === null || choice === null) return setEmpty(true);
    onSubmit(`${picked}:${choice}`, checkFix(item, picked, choice));
    setChoice(null);
  };

  return (
    <form id={`answer-${item.id}`} onSubmit={submit} className="stack gap-4">
      <div className="fix-line prompt-card" dir="ltr" lang="en" aria-label="המשפט">
        {tokens.map((t, i) => (
          <button
            key={i}
            type="button"
            className="fix-word"
            aria-pressed={picked === i}
            data-state={finished && i === item.wrongIndex ? 'wrong-word' : missed.has(`${i}:`) ? 'missed' : undefined}
            disabled={finished || missed.has(`${i}:`)}
            onClick={() => tap(i)}
          >
            {t}
          </button>
        ))}
      </div>
      {picked !== null && !finished && (
        <div className="stack gap-2">
          <span className="small muted">במה להחליף את המילה?</span>
          <div className="options" role="group" aria-label="תיקונים">
            {fixes.map((f, idx) => (
              <OptionRow
                key={f || '∅'}
                index={idx}
                dir={f ? 'ltr' : 'rtl'}
                selected={choice === f}
                state={missed.has(`${picked}:${f}`) ? 'wrong' : undefined}
                disabled={missed.has(`${picked}:${f}`)}
                onPick={() => {
                  setChoice(f);
                  setEmpty(false);
                }}
              >
                {f ? <En>{f}</En> : <He>למחוק את המילה</He>}
              </OptionRow>
            ))}
          </div>
        </div>
      )}
      {empty && <EmptyAnswer>{picked === null ? 'קודם להקיש על המילה השגויה במשפט.' : 'קודם לבחור במה להחליף את המילה.'}</EmptyAnswer>}
    </form>
  );
}

/** A gentle note when "בדיקה" or "הבא" is pressed before answering. Not an attempt. */
function EmptyAnswer({ children }: { children: string }) {
  return (
    <div className="feedback feedback-hint" role="status">
      {children}
    </div>
  );
}

function renderCloze(prompt: string, fill?: string, tap?: { locked: boolean }): ReactNode {
  const t = (s: string | undefined) => (tap && s ? <TapText text={s} locked={tap.locked} sentence={prompt.replace('___', fill ?? '___')} /> : s);
  if (!prompt.includes('___')) return tap ? t(prompt) : prompt;
  const [before, after] = prompt.split('___');
  return (
    <>
      {t(before)}
      {fill ? (
        <strong className="fill">{fill}</strong>
      ) : (
        <span aria-label="מילה חסרה" className="blank">
          &nbsp;
        </span>
      )}
      {t(after)}
    </>
  );
}

function ChoiceInput({
  item,
  seed,
  flow,
  instant,
  onChange,
  onSubmit,
}: {
  item: ChoiceItem;
  seed: string;
  flow: FlowState;
  instant: boolean;
  onChange: () => void;
  onSubmit: (answer: string, r: CheckResult) => void;
}) {
  const options = useMemo(() => seededShuffle(item.options, `${seed}:${item.id}`), [item, seed]);
  const [selected, setSelected] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const finished = isFinished(flow);
  const wrong = new Set(flow.attempts.filter((a) => !a.correct).map((a) => a.answer));
  const isEnglish = item.promptLanguage === 'en' && !(item.word && item.prompt === item.word.lemma);
  const listen = item.modality === 'listen';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (finished) return;
    if (!selected) return setEmpty(true);
    onSubmit(selected, checkChoice(item, selected));
    setSelected(null);
  };

  return (
    <form id={`answer-${item.id}`} className="options" onSubmit={submit} role="group" aria-label="תשובות">
      {options.map((o, idx) => {
        const state = finished && o.id === item.correctOptionId ? 'correct' : wrong.has(o.id) ? 'wrong' : finished ? 'dim' : undefined;
        // After answering, English options can be tapped word by word.
        const text = isEnglish ? <En>{finished ? <TapText text={o.text} /> : o.text}</En> : <He>{o.text}</He>;
        // Hearing the options of a listening item would give the answer away.
        const speak = isEnglish && !(listen && !finished) && <SpeakButton text={o.text} size="inline" label="הקראת התשובה" />;
        return (
          <OptionRow
            key={o.id}
            index={idx}
            dir={isEnglish ? 'ltr' : 'rtl'}
            selected={selected === o.id}
            state={state}
            disabled={finished || wrong.has(o.id)}
            static={finished}
            end={speak}
            onPick={() => {
              if (instant) {
                if (!finished) onSubmit(o.id, checkChoice(item, o.id));
                return;
              }
              if (selected && selected !== o.id) onChange();
              setSelected(o.id);
              setEmpty(false);
            }}
          >
            {text}
          </OptionRow>
        );
      })}
      {empty && <EmptyAnswer>קודם לבחור תשובה.</EmptyAnswer>}
    </form>
  );
}

/**
 * One answer row: [key chip | text | inline speaker]. In English rows the key
 * sits on the left and the speaker on the right; Hebrew rows mirror that.
 * The speaker is its own button inside the row, so the row has one layout.
 * States: selected (accent), correct (check replaces the key), wrong (X
 * replaces the key). No strike-through and no red text.
 */
function OptionRow({
  index,
  dir,
  selected,
  state,
  disabled,
  static: isStatic = false,
  end,
  onPick,
  children,
}: {
  index: number;
  dir: 'ltr' | 'rtl';
  selected: boolean;
  state: 'correct' | 'wrong' | 'dim' | undefined;
  disabled: boolean;
  static?: boolean;
  end?: ReactNode;
  onPick: () => void;
  children: ReactNode;
}) {
  const key = state === 'correct' ? <CheckIcon size={16} /> : state === 'wrong' ? <XIcon size={14} /> : 'ABCDEF'[index];
  const srState = state === 'correct' ? 'התשובה הנכונה' : state === 'wrong' ? 'לא נכון' : undefined;
  const inner = (
    <>
      <span className="key" aria-hidden="true">
        {key}
      </span>
      <span className="option-text">{children}</span>
      {srState && <span className="sr-only">{srState}</span>}
    </>
  );
  return (
    <div className="option" dir={dir} data-state={state} data-selected={selected || undefined}>
      {isStatic ? (
        <div className="option-hit">{inner}</div>
      ) : (
        <button type="button" className="option-hit" aria-pressed={selected} disabled={disabled} onClick={onPick}>
          {inner}
        </button>
      )}
      {end && <span className="option-end">{end}</span>}
    </div>
  );
}

function TypedInput({ item, flow, onSubmit }: { item: TypedItem; flow: FlowState; onSubmit: (answer: string, r: CheckResult) => void }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const finished = isFinished(flow);

  const [hebrew, setHebrew] = useState(false);
  const [empty, setEmpty] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (finished) return;
    if (!value.trim()) return setEmpty(true);
    // The shared phone's keyboard is often left in Hebrew: that is not an attempt.
    if (isHebrewOnly(value)) {
      setHebrew(true);
      return;
    }
    onSubmit(value, checkTyped(item, value));
    // Keep the keyboard open and the text selected for a quick retry.
    requestAnimationFrame(() => ref.current?.select());
  };

  return (
    <form id={`answer-${item.id}`} onSubmit={submit}>
      <label className="sr-only" htmlFor={`in-${item.id}`}>
        תשובה
      </label>
      <input
        ref={ref}
        id={`in-${item.id}`}
        className="input en"
        dir="ltr"
        lang="en"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setHebrew(false);
          setEmpty(false);
        }}
        disabled={finished}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        inputMode="text"
        placeholder="לכתוב כאן באנגלית"
      />
      {hebrew && (
        <div className="feedback feedback-hint" role="status">
          המקלדת בעברית. צריך לעבור לאנגלית ולכתוב שוב.
        </div>
      )}
      {empty && <EmptyAnswer>קודם לכתוב תשובה באנגלית.</EmptyAnswer>}
    </form>
  );
}

/** Hebrew letters and no English ones: typed with the Hebrew keyboard. */
export function isHebrewOnly(s: string): boolean {
  return /[\u05D0-\u05EA]/.test(s) && !/[A-Za-z]/.test(s);
}

function Help({ item, flow, last, support }: { item: Props['item']; flow: FlowState; last: CheckResult | null; support: SupportLanguage }) {
  const { content } = useServices();
  if (isFinished(flow)) return null;
  const anchor = content.anchorFor(item);
  const blocks: ReactNode[] = [];
  if (flow.lastHelp === 'spelling' && last?.nearMiss) {
    blocks.push(
      <div key="sp" className="feedback feedback-hint" role="status">
        כמעט. כדאי לבדוק את האיות.
      </div>,
    );
  }
  if (last && !last.correct && last.feedback) {
    blocks.push(
      <div key="fb" className="feedback feedback-info" role="status">
        <BiText text={chooseText(last.feedback, support)} />
      </div>,
    );
  }
  for (let i = 0; i < flow.hintsShown; i++) {
    const h = item.hints[i];
    if (h) {
      blocks.push(
        <div key={`h${i}`} className="feedback feedback-hint" role="status">
          <span className="feedback-tag">
            <LessonIcon size={16} />
            רמז {i + 1}
          </span>
          <BiText text={chooseText(h, support)} />
        </div>,
      );
    }
  }
  if (flow.explanationShown) {
    blocks.push(
      <div key="ex" className="feedback feedback-info" role="status">
        <span className="feedback-tag accent">
          <InfoIcon size={16} />
          הסבר
        </span>
        <BiText text={chooseText(item.explanation, support)} />
      </div>,
    );
    if (anchor) blocks.push(<AnchorCard key="anchor" anchor={anchor} />);
  }
  return blocks.length ? <div className="stack gap-2" aria-live="polite">{blocks}</div> : null;
}

const PRAISE = ['מצוין!', 'נכון!', 'יפה מאוד!', 'בדיוק!', 'כל הכבוד!'];

/** "Why not the others": the reason each wrong option does not fit, chosen ones first. */
function WhyNot({ item, chosen, support, open }: { item: ChoiceItem; chosen: Set<string>; support: SupportLanguage; open: boolean }) {
  const wrong = item.options.filter((o) => o.id !== item.correctOptionId && o.feedback);
  if (!wrong.length) return null;
  wrong.sort((a, b) => Number(chosen.has(b.id)) - Number(chosen.has(a.id)));
  const isEnglish = item.promptLanguage === 'en';
  return (
    <details className="why-not" open={open}>
      <summary>למה לא האפשרויות האחרות?</summary>
      {wrong.map((o) => (
        <div key={o.id} className="why-not-item" data-chosen={chosen.has(o.id)}>
          <span className="why-not-x" aria-hidden="true">
            <XIcon size={12} />
          </span>
          <span className="grow">
            <strong className="block">{isEnglish ? <En>{o.text}</En> : <He>{o.text}</He>}</strong>
            <BiText text={chooseText(o.feedback!, support)} />
          </span>
        </div>
      ))}
    </details>
  );
}

function headerFor(item: Props['item'], flow: FlowState): string {
  const solved = flow.phase === 'solved';
  const clean = solved && flow.attempts.length === 1 && flow.hintsShown === 0 && !flow.explanationShown;
  const praise = PRAISE[[...item.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PRAISE.length]!;
  return solved ? (clean ? praise : 'נכון! יפה שהמשכת לנסות') : flow.phase === 'skipped' ? 'דילגנו. נחזור לזה בהמשך' : 'לא נורא, ככה לומדים';
}

/**
 * After answering: a compact strip at the bottom that never covers the
 * answers. Correct is green; a miss is amber (red stays on the chosen
 * option only). "למה?" opens the full explanation in a sheet.
 */
function FeedbackStrip({ item, flow, support, onWhy, onContinue }: { item: Props['item']; flow: FlowState; support: SupportLanguage; onWhy: () => void; onContinue: () => void }) {
  const solved = flow.phase === 'solved';
  const skipped = flow.phase === 'skipped';
  const model = modelAnswer(item);
  const tone = solved ? 'good' : skipped ? 'neutral' : 'warn';
  const preview = chooseText(item.explanation, support);
  return (
    <div className="fb-strip" data-tone={tone} role="status" aria-live="polite">
      <div className="fb-head">
        <span className="fb-icon">{solved ? <CheckIcon size={20} /> : skipped ? <InfoIcon size={20} /> : <XIcon size={18} />}</span>
        <div className="grow stack gap-0">
          <strong className="fb-title">{headerFor(item, flow)}</strong>
          {!solved && model && (
            <span className="fb-answer">
              התשובה: <En className="t-strong">{model}</En>
            </span>
          )}
        </div>
      </div>
      {!solved && (
        <p className="fb-preview">{preview.primaryLang === 'en' ? <En>{preview.primary}</En> : <He>{preview.primary}</He>}</p>
      )}
      <div className="btn-row lead">
        <Button size="lg" onClick={onWhy}>
          {solved ? 'הסבר' : 'למה?'}
        </Button>
        <Button variant="primary" size="lg" onClick={onContinue} autoFocus>
          המשך
        </Button>
      </div>
    </div>
  );
}

/** The explanation sheet: the answer, the rule, why not the others, the anchor, the word, the lesson. */
function Explanation({
  item,
  flow,
  support,
  listen,
  audioText,
  onLesson,
  lessonTitle,
}: {
  item: Props['item'];
  flow: FlowState;
  support: SupportLanguage;
  listen: boolean;
  audioText: string;
  onLesson: (() => void) | undefined;
  lessonTitle: string | undefined;
}) {
  const { content } = useServices();
  const anchor = content.anchorFor(item);
  const solved = flow.phase === 'solved';
  const clean = solved && flow.attempts.length === 1 && flow.hintsShown === 0 && !flow.explanationShown;
  const model = modelAnswer(item);
  const sentence =
    item.prompt.includes('___') || listen || item.type === 'order' || item.type === 'fix' || item.tags.includes('translate') ? audioText : undefined;
  const example = item.word?.example;

  return (
    <>
      {(sentence || model) && (
        <section className="ex-section">
          <span className="section-label">התשובה</span>
          <div className="say-row" dir="ltr">
            <En className="grow t-body-lg">{sentence ?? model}</En>
            <SpeakButton text={sentence ?? model!} size="inline" />
          </div>
          {item.type === 'fix' && item.meaning && <He className="muted">{item.meaning}</He>}
        </section>
      )}
      <section className="ex-section">
        <span className="section-label">הכלל</span>
        <BiText text={chooseText(item.explanation, support)} />
      </section>
      {item.type === 'choice' && <WhyNot item={item} chosen={new Set(flow.attempts.map((a) => a.answer))} support={support} open={!solved || !clean} />}
      {anchor && <AnchorCard anchor={anchor} />}
      {item.word && (
        <section className="ex-section">
          <span className="section-label">המילה</span>
          <div className="say-row" dir="ltr">
            <En className="grow t-h3">{item.word.lemma}</En>
            <SpeakButton text={item.word.lemma} size="inline" />
          </div>
          {example && example !== sentence && (
            <div className="say-row" dir="ltr">
              <En className="grow muted">{example}</En>
              <SpeakButton text={example} size="inline" />
            </div>
          )}
        </section>
      )}
      {onLesson && lessonTitle && <LessonLink title={lessonTitle} onOpen={onLesson} />}
    </>
  );
}

/** Hebrew or English help text. English stands on its own LTR line, aligned left. */
function BiText({ text, className = '' }: { text: ReturnType<typeof chooseText>; className?: string }) {
  const main = text.primaryLang === 'en' ? <En as="div">{text.primary}</En> : <div><He>{text.primary}</He></div>;
  return (
    <div className={`bi-text ${className}`}>
      {main}
      {text.secondary &&
        (text.secondaryLang === 'he' ? (
          <div className="secondary small muted">
            <He>{text.secondary}</He>
          </div>
        ) : (
          <En as="div" className="secondary small muted">
            {text.secondary}
          </En>
        ))}
    </div>
  );
}

export type { Bilingual };
