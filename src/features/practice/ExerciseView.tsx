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
import { TapText } from '@/ui/Gloss';
import { questionSpeech, splitSentences } from '@/services/speech/textPrep';
import { AudioPlayer } from '@/ui/AudioPlayer';
import { seededShuffle } from './shuffle';
import { useServices } from '@/app/services';
import { domainOf } from '@/domain/skills/taxonomy';
import { CheckIcon, XIcon } from '@/ui/icons';
import { Sheet } from '@/ui/Sheet';
import { LessonView } from '@/features/lessons/LessonView';
import { sounds } from '@/services/sound';

type Props = {
  item: Exclude<ContentItem, { type: 'open-writing' }>;
  passage?: Passage | undefined;
  support: SupportLanguage;
  seed: string;
  policy?: FlowPolicy;
  /** full: explanation + Continue. brief: flash and auto-advance. none: advance at once. */
  feedback?: 'full' | 'brief' | 'none';
  onDone: (outcome: ItemOutcome) => void;
};

/**
 * One exercise. Implements "teach, don't solve": wrong answers unlock a hint,
 * a second hint, an explanation, and only then the answer.
 */
export function ExerciseView({ item, passage, support, seed, policy = 'teach', feedback = 'full', onDone }: Props) {
  const [flow, dispatch] = useReducer(
    (s: FlowState, a: Parameters<typeof flowReducer>[1]) => flowReducer(s, a, item.hints.length, policy),
    Date.now(),
    initialFlow,
  );
  const [last, setLast] = useState<CheckResult | null>(null);
  const [lessonOpen, setLessonOpen] = useState(false);
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

  // Quick modes move on by themselves.
  useEffect(() => {
    if (!finished || feedback === 'full') return;
    const t = setTimeout(() => onDone(toOutcome(flow)), feedback === 'brief' ? 650 : 0);
    return () => clearTimeout(t);
  }, [finished, feedback, flow, onDone]);
  const listen = item.modality === 'listen';
  const audioText = ('audioText' in item && item.audioText) || item.prompt;
  const canSpeakPrompt = listen || (!!item.word && item.prompt === item.word.lemma);
  const instruction = chooseText(item.instruction, support);

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
    <div className="exercise">
      <div className={`ex-instruction tone-${domainOf(item.skill)}`}>
        <span className="dot" style={{ background: 'var(--c-fg)' }} />
        <BiText text={instruction} />
      </div>

      {passage && <PassagePanel passage={passage} locked={glossLocked || (item.skill === 'reading.vocabulary-in-context' && !finished)} />}

      {listen && (
        <div className="center" style={{ minHeight: 140 }}>
          <div className="row" style={{ gap: 'var(--s-4)' }}>
            <SpeakButton text={audioText} large label="השמעה" onPlayed={() => dispatch({ type: 'replay' })} />
            <SpeakButton text={audioText} slow label="השמעה איטית מאוד" onPlayed={() => dispatch({ type: 'replay' })} />
          </div>
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
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLessonOpen(true)}>
          <He>{`לשיעור המלא: ${lesson.title.he}`}</He>
        </button>
      )}
      <Sheet open={lessonOpen} onClose={() => setLessonOpen(false)} label={lesson?.title.he ?? 'שיעור'}>
        {lesson && <LessonView lesson={lesson} />}
      </Sheet>

      {finished && feedback === 'full' ? (
        <div className={`banner ${flow.phase === 'solved' ? 'banner-good' : 'banner-bad'}`} role="status" aria-live="polite">
          <AfterAnswer item={item} flow={flow} support={support} listen={listen} audioText={audioText} />
          {lesson && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLessonOpen(true)}>
              <He>{`לשיעור המלא: ${lesson.title.he}`}</He>
            </button>
          )}
          <button className={`btn btn-block ${flow.phase === 'solved' ? 'btn-good' : 'btn-bad'}`} onClick={() => onDone(toOutcome(flow))} autoFocus>
            המשך
          </button>
        </div>
      ) : (
      <div className="actions">
        {finished ? null : (
          <>
            {!(feedback === 'brief' && item.type === 'choice') && (
              <button className="btn btn-primary" form={`answer-${item.id}`} type="submit">
                {feedback === 'none' ? 'הבא' : 'בדיקה'}
              </button>
            )}
            {policy === 'teach' && (
              <button className="btn" type="button" onClick={() => dispatch({ type: 'hint' })} disabled={flow.explanationShown}>
                רמז
              </button>
            )}
            <button className="btn btn-ghost" type="button" onClick={() => dispatch({ type: 'skip', at: Date.now() })}>
              דילוג
            </button>
          </>
        )}
      </div>
      )}
    </div>
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
  return (
    <div className="row prompt-card" style={{ alignItems: 'center' }}>
      {isHe ? (
        <p className={`grow ${isWord ? 'prompt-word' : 'prompt'}`}>{typeof content === 'string' ? <He>{content}</He> : content}</p>
      ) : (
        <En as="p" className={`grow ${isWord ? 'prompt-word' : 'prompt'}`}>
          {content}
        </En>
      )}
      {canSpeak ? (
        <SpeakButton text={item.prompt} />
      ) : (
        !isHe && <SpeakButton text={finished && fill && item.prompt.includes('___') ? item.prompt.replace('___', fill) : questionSpeech(item.prompt)} label="הקראת השאלה" />
      )}
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
  const finished = isFinished(flow);
  const endMark = /[?!]$/.test(item.answer.trim()) ? item.answer.trim().slice(-1) : '.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (finished || !placed.length) return;
    const words = placed.map((id) => tiles.find((t) => t.id === id)!.text);
    onSubmit(words.join(' '), checkOrder(item, words));
  };

  return (
    <form id={`answer-${item.id}`} onSubmit={submit} className="stack" style={{ gap: 'var(--s-4)' }}>
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
            onClick={() => setPlaced((p) => [...p, t.id])}
          >
            {t.text}
          </button>
        ))}
      </div>
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
  const finished = isFinished(flow);
  const missed = new Set(flow.attempts.filter((a) => !a.correct).map((a) => a.answer));

  const tap = (i: number) => {
    if (finished) return;
    if (i !== item.wrongIndex) {
      onSubmit(`${i}:`, checkFix(item, i, null));
      return;
    }
    setPicked(i);
    setChoice(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (finished || picked === null || choice === null) return;
    onSubmit(`${picked}:${choice}`, checkFix(item, picked, choice));
    setChoice(null);
  };

  return (
    <form id={`answer-${item.id}`} onSubmit={submit} className="stack" style={{ gap: 'var(--s-4)' }}>
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
        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          <span className="small muted">במה להחליף את המילה?</span>
          <div className="options" role="group" aria-label="תיקונים">
            {fixes.map((f) => (
              <button
                key={f || '∅'}
                type="button"
                className="option"
                dir={f ? 'ltr' : undefined}
                aria-pressed={choice === f}
                data-state={missed.has(`${picked}:${f}`) ? 'wrong' : undefined}
                disabled={missed.has(`${picked}:${f}`)}
                onClick={() => setChoice(f)}
              >
                {f ? <En>{f}</En> : <He>למחוק את המילה</He>}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
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
        <strong style={{ color: 'var(--good-ink)' }}>{fill}</strong>
      ) : (
        <span aria-label="מילה חסרה" style={{ display: 'inline-block', minWidth: '3.5em', borderBottom: '3px solid var(--primary-fg)', margin: '0 3px', verticalAlign: 'baseline' }}>
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
  const finished = isFinished(flow);
  const wrong = new Set(flow.attempts.filter((a) => !a.correct).map((a) => a.answer));
  const isEnglish = item.promptLanguage === 'en' && !(item.word && item.prompt === item.word.lemma);
  const listen = item.modality === 'listen';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected || finished) return;
    onSubmit(selected, checkChoice(item, selected));
    setSelected(null);
  };

  return (
    <form id={`answer-${item.id}`} className="options" onSubmit={submit} role="group" aria-label="תשובות">
      {options.map((o, idx) => {
        const state = finished && o.id === item.correctOptionId ? 'correct' : wrong.has(o.id) ? 'wrong' : undefined;
        // After answering, English options can be tapped word by word.
        const text = isEnglish ? <En>{finished ? <TapText text={o.text} /> : o.text}</En> : <He>{o.text}</He>;
        // Hearing the options of a listening item would give the answer away.
        const speak = isEnglish && !(listen && !finished) && <SpeakButton text={o.text} label="הקראת התשובה" />;
        if (finished) {
          return (
            <div key={o.id} className="option-row">
              <div className="option" dir={isEnglish ? 'ltr' : undefined} data-state={state} aria-disabled="true">
                <span className="key" aria-hidden="true">
                  {'ABCDEF'[idx]}
                </span>
                {text}
              </div>
              {speak}
            </div>
          );
        }
        return (
          <div key={o.id} className="option-row">
          <button
            type="button"
            className="option"
            dir={isEnglish ? 'ltr' : undefined}
            aria-pressed={selected === o.id}
            data-state={state}
            disabled={finished || wrong.has(o.id)}
            onClick={() => {
              if (instant) {
                if (!finished) onSubmit(o.id, checkChoice(item, o.id));
                return;
              }
              if (selected && selected !== o.id) onChange();
              setSelected(o.id);
            }}
          >
            <span className="key" aria-hidden="true">
              {'ABCDEF'[idx]}
            </span>
            {text}
          </button>
          {speak}
          </div>
        );
      })}
    </form>
  );
}

function TypedInput({ item, flow, onSubmit }: { item: TypedItem; flow: FlowState; onSubmit: (answer: string, r: CheckResult) => void }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const finished = isFinished(flow);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (finished || !value.trim()) return;
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
        className="input"
        dir="ltr"
        lang="en"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={finished}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        inputMode="text"
        placeholder="לכתוב כאן באנגלית"
        style={{ fontFamily: 'var(--font-en)' }}
      />
    </form>
  );
}

function Help({ item, flow, last, support }: { item: Props['item']; flow: FlowState; last: CheckResult | null; support: SupportLanguage }) {
  if (isFinished(flow)) return null;
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
          <span className="feedback-tag">רמז {i + 1}</span>
          <BiText text={chooseText(h, support)} />
        </div>,
      );
    }
  }
  if (flow.explanationShown) {
    blocks.push(
      <div key="ex" className="feedback feedback-info" role="status">
        <span className="feedback-tag" style={{ color: 'var(--primary-fg)' }}>הסבר</span>
        <BiText text={chooseText(item.explanation, support)} />
      </div>,
    );
  }
  return blocks.length ? <div className="stack" aria-live="polite">{blocks}</div> : null;
}

const PRAISE = ['מצוין!', 'נכון!', 'יפה מאוד!', 'בדיוק!', 'כל הכבוד!'];

function AfterAnswer({ item, flow, support, listen, audioText }: { item: Props['item']; flow: FlowState; support: SupportLanguage; listen: boolean; audioText: string }) {
  const solved = flow.phase === 'solved';
  const clean = solved && flow.attempts.length === 1 && flow.hintsShown === 0 && !flow.explanationShown;
  const praise = PRAISE[[...item.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PRAISE.length]!;
  const header = solved ? (clean ? praise : 'נכון! יפה שהמשכת לנסות') : flow.phase === 'skipped' ? 'דילגנו. נחזור לזה בהמשך' : 'לא נורא, ככה לומדים';
  const model = modelAnswer(item);
  const sentence =
    item.prompt.includes('___') || listen || item.type === 'order' || item.type === 'fix' || item.tags.includes('translate') ? audioText : undefined;
  const example = item.word?.example;

  return (
    <>
      <div className="banner-head">
        <span className="banner-icon">{solved ? <CheckIcon size={22} /> : <XIcon size={20} />}</span>
        <span>{header}</span>
      </div>
      <div className="banner-body">
        {!solved && model && (
          <div style={{ fontWeight: 650 }}>
            התשובה הנכונה: <En>{model}</En>
          </div>
        )}
        {item.type === 'fix' && item.meaning && <He className="small">{item.meaning}</He>}
        {!flow.explanationShown && <BiText text={chooseText(item.explanation, support)} className="small" />}
        {sentence && (
          <div className="row">
            <En className="grow">{sentence}</En>
            <SpeakButton text={sentence} />
          </div>
        )}
        {item.word && (
          <>
            <div className="row">
              <En className="grow">
                <strong>{item.word.lemma}</strong>
              </En>
              <SpeakButton text={item.word.lemma} />
            </div>
            {example && example !== sentence && (
              <div className="row">
                <En className="grow small">{example}</En>
                <SpeakButton text={example} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function BiText({ text, className = '' }: { text: ReturnType<typeof chooseText>; className?: string }) {
  const main = text.primaryLang === 'en' ? <En>{text.primary}</En> : <He>{text.primary}</He>;
  return (
    <div className={className}>
      <div>{main}</div>
      {text.secondary && (
        <div className="secondary small muted">{text.secondaryLang === 'he' ? <He>{text.secondary}</He> : <En>{text.secondary}</En>}</div>
      )}
    </div>
  );
}

export type { Bilingual };
