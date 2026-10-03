import type { ReactNode } from 'react';
import type { ArtName } from '@/ui/art';
import {
  BoltIcon,
  BookIcon,
  BookmarkIcon,
  ExamIcon,
  GrammarIcon,
  GymIcon,
  LessonIcon,
  LinkIcon,
  MicIcon,
  RepeatIcon,
  RiddleIcon,
  SearchIcon,
  TranslateIcon,
  TreeIcon,
  TrophyIcon,
  VocabIcon,
} from '@/ui/icons';

type Entry = { path: string; art: ArtName; tone: string; icon: ReactNode; title: string; sub: string };

/** Every practice mode that is not on the home screen, by what it trains. */
export const GROUPS: { title: string; lead: string; items: Entry[] }[] = [
  {
    title: 'קוראים ומדברים',
    lead: 'סיפורים, מילים שנשמרו והגייה',
    items: [
      { path: 'stories', art: 'stories', tone: 'reading', icon: <BookIcon />, title: 'סיפורים', sub: 'סיפורים ושיחות בכל הרמות' },
      { path: 'words', art: 'words', tone: 'vocabulary', icon: <BookmarkIcon />, title: 'המילים שלי', sub: 'מילים ששמרתי מהסיפורים' },
      { path: 'shadow', art: 'speaking', tone: 'speaking', icon: <MicIcon />, title: 'חזרה בקול', sub: 'להקשיב, להגיד, להשוות' },
    ],
  },
  {
    title: 'כותבים ומתקנים',
    lead: 'לבנות משפטים נכונים באנגלית',
    items: [
      { path: 'practice/translate', art: 'translate', tone: 'writing', icon: <TranslateIcon />, title: 'תרגום', sub: 'מעברית לאנגלית' },
      { path: 'practice/fix', art: 'target', tone: 'grammar', icon: <SearchIcon />, title: 'מצא את הטעות', sub: 'משפט עם טעות אחת' },
      { path: 'practice/sentences', art: 'writing', tone: 'listening', icon: <GrammarIcon />, title: 'בונים משפטים', sub: 'לסדר מילים למשפט' },
      { path: 'practice/chunks', art: 'vocabulary', tone: 'vocabulary', icon: <LinkIcon />, title: 'צירופים קבועים', sub: 'make a decision, take a shower' },
      { path: 'practice/families', art: 'vocabulary', tone: 'reading', icon: <TreeIcon />, title: 'משפחות מילים', sub: 'happy, happiness, unhappy' },
    ],
  },
  {
    title: 'משחקים ואתגרים',
    lead: 'לבדוק את עצמי, בקצב שלי או נגד השעון',
    items: [
      { path: 'practice/quiz', art: 'games', tone: 'games', icon: <TrophyIcon />, title: 'חידון', sub: '10 שאלות, בלי רמזים' },
      { path: 'practice/lightning', art: 'lightning', tone: 'speaking', icon: <BoltIcon />, title: 'סבב בזק', sub: '60 שניות, כמה שיותר תשובות' },
      { path: 'practice/exam', art: 'test', tone: 'primary', icon: <ExamIcon />, title: 'מבחן', sub: 'בסגנון בגרות, עם ציון לפי תחום' },
      { path: 'practice/riddles', art: 'riddle', tone: 'listening', icon: <RiddleIcon />, title: 'חידות', sub: 'חשיבה באנגלית' },
      { path: 'match', art: 'games', tone: 'writing', icon: <VocabIcon />, title: 'התאמת זוגות', sub: 'מילים ופירושים' },
    ],
  },
  {
    title: 'לומדים ומחזקים',
    lead: 'הסברים, וחזרה על מה שקשה',
    items: [
      { path: 'learn', art: 'lessons', tone: 'grammar', icon: <LessonIcon />, title: 'שיעורים', sub: 'הסברים ודוגמאות עם הקראה' },
      { path: 'practice/mistakes', art: 'progress', tone: 'writing', icon: <GymIcon />, title: 'חדר כושר', sub: 'לטעויות שחוזרות' },
      { path: 'practice/review', art: 'words', tone: 'vocabulary', icon: <RepeatIcon />, title: 'חזרה', sub: 'מה שמתחיל להישכח' },
    ],
  },
];

export const MORE_COUNT = GROUPS.reduce((n, g) => n + g.items.length, 0);

