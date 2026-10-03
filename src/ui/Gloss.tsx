import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/app/services';
import { useSpeechPrefs } from '@/app/speechPrefs';
import { loadDictionary, lookup, wordKey } from '@/services/dictionary';
import type { Sense } from '@content/dictionary';
import { STORY_STOPWORDS } from '@/domain/content/schema';
import { En } from './En';
import { He } from './He';
import { SpeakButton } from './SpeakButton';
import { BookmarkIcon, CloseIcon } from './icons';

/** One word the learner tapped, with its meanings and the sentence it came from. */
export interface GlossEntry {
  word: string;
  senses: Sense[];
  sentence?: string;
  storyId?: string;
  /** False: show the meaning but do not keep the word (timed rounds). */
  save?: boolean;
  /** The GlossScope it was opened in; closing that scope closes the popup. */
  scope?: symbol;
}

const Ctx = createContext<{ open: (g: GlossEntry) => void; closeScope: (scope: symbol) => void } | null>(null);

/**
 * Shows the meaning of a tapped English word at the bottom of the screen,
 * reads it aloud, and keeps it in "my words". One per screen.
 */
export function GlossProvider({ children }: { children: ReactNode }) {
  // Kept with the screen it was opened on: another screen (the next story) starts without it.
  const [opened, setGloss] = useState<{ entry: GlossEntry; path: string } | null>(null);
  const { pathname } = useLocation();
  const gloss = opened?.path === pathname ? opened.entry : null;
  const { sid } = useParams();
  const { store, speech } = useServices();
  const prefs = useSpeechPrefs();
  const saved = useLiveQuery(() => (sid ? store.savedWords(sid) : []), [store, sid]);
  const savedSet = useMemo(() => new Set((saved ?? []).map((w) => w.lemma)), [saved]);

  const open = useCallback(
    (g: GlossEntry) => {
      setGloss({ entry: g, path: pathname });
      const first = g.senses[0];
      if (!first) return;
      void speech.speak(first.lemma, { ...prefs, key: `gloss-${first.lemma}` });
      // Very common words ("the", "is") are shown but not saved.
      if (sid && g.save !== false && !STORY_STOPWORDS.has(first.lemma.toLowerCase())) void store.saveWord(sid, { lemma: first.lemma, he: g.senses.map((s) => s.he).join(', '), ...(g.sentence ? { example: g.sentence } : {}), ...(g.storyId ? { storyId: g.storyId } : {}) });
    },
    [pathname, prefs, sid, speech, store],
  );

  const closeScope = useCallback((scope: symbol) => setGloss((o) => (o?.entry.scope === scope ? null : o)), []);

  const lemma = gloss?.senses[0]?.lemma;

  return (
    <Ctx.Provider value={useMemo(() => ({ open, closeScope }), [open, closeScope])}>
      {children}
      {gloss && lemma && (
        <div className="gloss-pop" role="dialog" aria-label="פירוש המילה">
          <div className="spread">
            <div className="row gap-2">
              <En className="gloss-word">{lemma}</En>
              <SpeakButton text={lemma} />
            </div>
            <button className="icon-btn" onClick={() => setGloss(null)} aria-label="סגירה">
              <CloseIcon />
            </button>
          </div>
          {gloss.senses.map((s, i) => (
            <He key={i} className={i === 0 ? 'gloss-he' : 'gloss-he muted small'}>
              {gloss.senses.length > 1 ? `${i + 1}. ${s.he}` : s.he}
            </He>
          ))}
          {wordKey(gloss.word) !== lemma.toLowerCase() && <En className="xs muted">{gloss.word}</En>}
          {sid && (gloss.save !== false || savedSet.has(lemma)) && (
            <div className="spread">
              <span className="xs muted row gap-1">
                <BookmarkIcon size={16} />
                {savedSet.has(lemma) ? 'נשמרה ב״המילים שלי״' : STORY_STOPWORDS.has(lemma.toLowerCase()) ? 'מילה נפוצה מאוד' : 'שומרים...'}
              </span>
              {savedSet.has(lemma) && (
                <button
                  className="link-btn xs"
                  onClick={() => {
                    void store.removeWord(sid, lemma);
                    setGloss(null);
                  }}
                >
                  להסיר
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useGloss() {
  return useContext(Ctx);
}

const ScopeCtx = createContext<{ scope?: symbol; save: boolean }>({ save: true });

/**
 * A part of the screen (one exercise) whose meaning popup closes with it, so
 * the next question starts without the last one's popup. With save={false}
 * tapped words are shown but not kept in "my words".
 */
export function GlossScope({ save = true, children }: { save?: boolean; children: ReactNode }) {
  const g = useGloss();
  const ref = useRef(g);
  useEffect(() => {
    ref.current = g;
  }, [g]);
  const [scope] = useState(() => Symbol('gloss-scope'));
  // Only on unmount: the provider's functions change identity with the route and settings.
  useEffect(() => () => ref.current?.closeScope(scope), [scope]);
  const value = useMemo(() => ({ scope, save }), [scope, save]);
  return <ScopeCtx.Provider value={value}>{children}</ScopeCtx.Provider>;
}

/**
 * English text whose words can be tapped for a translation. With `locked`
 * (e.g. before answering a vocabulary question) it renders as plain text, so
 * the translation never gives the answer away.
 */
export function TapText({ text, locked = false, sentence }: { text: string; locked?: boolean; sentence?: string }) {
  const g = useGloss();
  const { scope, save } = useContext(ScopeCtx);
  const [dict, setDict] = useState<Record<string, Sense[]> | null>(null);
  useEffect(() => {
    if (locked || !g) return;
    let live = true;
    void loadDictionary().then((d) => live && setDict(d));
    return () => {
      live = false;
    };
  }, [locked, g]);
  if (locked || !g || !dict) return <>{text}</>;
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        if (!part || /^\s+$/.test(part)) return part;
        const senses = lookup(dict, part);
        if (!senses) return <span key={i} className="wt">{part}</span>;
        const m = part.match(/^([^\p{L}\p{N}']*)(.*?)([^\p{L}\p{N}']*)$/u);
        const [, lead = '', core = part, trail = ''] = m ?? [];
        return (
          <span key={i} className="wt">
            {lead}
            <span
              role="button"
              tabIndex={0}
              className="word-tap"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                g.open({ word: core, senses, sentence: sentence ?? text, save, ...(scope ? { scope } : {}) });
              }}
            >
              {core}
            </span>
            {trail}
          </span>
        );
      })}
    </>
  );
}
