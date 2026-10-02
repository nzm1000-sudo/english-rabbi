import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChoiceItem, ContentItem, Passage, TypedItem } from '@/domain/content/schema';
import { checkChoice, checkTyped, type CheckResult } from '@/domain/learning/answerCheck';
import { flowReducer, initialFlow, isFinished, toOutcome, type FlowPolicy, type FlowState } from '@/domain/learning/exerciseFlow';
import { chooseText, type SupportLanguage } from '@/domain/learning/languageSupport';
import type { ItemOutcome } from '@/domain/learning/events';
import type { Bilingual } from '@/domain/content/schema';
import { En } from '@/ui/En';
import { He } from '@/ui/He';
import { SpeakButton } from '@/ui/SpeakButton';
import { seededShuffle } from './shuffle';
import { useServices } from '@/app/services';
import { domainOf } from '@/domain/skills/taxonomy';
import { CheckIcon, XIcon } from '@/ui/icons';
import { Sheet } from '@/ui/Sheet';
import { LessonView } from '@/features/lessons/LessonView';

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
  const { content } = useServices();
  const lesson = content.lessonsForSkill(item.skill)[0];
  const finished = isFinished(flow);

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

      {passage && (
        <div className="panel stack">
          <div className="spread">
            <En className="small muted">{passage.title}</En>
            <SpeakButton text={passage.text} label="השמעת הקטע" />
          </div>
          <En as="p" className="passage">
            {passage.text}
          </En>
        </div>
      )}

      {listen && (
        <div className="center" style={{ minHeight: 140 }}>
          <SpeakButton text={audioText} large label="השמעה" onPlayed={() => dispatch({ type: 'replay' })} />
        </div>
      )}

      <Prompt item={item} finished={finished} canSpeak={canSpeakPrompt && !listen} />

      {item.type === 'choice' ? (
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
          לשיעור המלא: {lesson.title.he}
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
              לשיעור המלא: {lesson.title.he}
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

function Prompt({ item, finished, canSpeak }: { item: Props['item']; finished: boolean; canSpeak: boolean }) {
  const isHe = item.promptLanguage === 'he';
  const isWord = !!item.word && (item.prompt === item.word.lemma || item.prompt === item.word.he);
  const fill = finished ? (item.type === 'typed' ? item.answers[0] : item.options.find((o) => o.id === item.correctOptionId)?.text) : undefined;
  const content = renderCloze(item.prompt, fill);
  return (
    <div className="row prompt-card" style={{ alignItems: 'center' }}>
      {isHe ? (
        <p className={`grow ${isWord ? 'prompt-word' : 'prompt'}`}>{content}</p>
      ) : (
        <En as="p" className={`grow ${isWord ? 'prompt-word' : 'prompt'}`}>
          {content}
        </En>
      )}
      {canSpeak && <SpeakButton text={item.prompt} />}
    </div>
  );
}

function renderCloze(prompt: string, fill?: string): ReactNode {
  if (!prompt.includes('___')) return prompt;
  const [before, after] = prompt.split('___');
  return (
    <>
      {before}
      {fill ? (
        <strong style={{ color: 'var(--good-ink)' }}>{fill}</strong>
      ) : (
        <span aria-label="מילה חסרה" style={{ display: 'inline-block', minWidth: '3.5em', borderBottom: '3px solid var(--primary-fg)', margin: '0 3px', verticalAlign: 'baseline' }}>
          &nbsp;
        </span>
      )}
      {after}
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
        const text = isEnglish ? <En>{o.text}</En> : <span>{o.text}</span>;
        return (
          <button
            key={o.id}
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
        placeholder="Type here"
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
  const model = item.type === 'typed' ? item.answers[0] : item.options.find((o) => o.id === item.correctOptionId)?.text;
  const sentence = item.prompt.includes('___') || listen ? audioText : undefined;
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
