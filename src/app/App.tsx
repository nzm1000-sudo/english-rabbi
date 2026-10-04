import { HashRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useServices } from './services';
import { StudentPicker } from '@/features/students/StudentPicker';
import { StudentForm } from '@/features/students/StudentForm';
import { HomeScreen } from '@/features/home/HomeScreen';
import { PracticeScreen } from '@/features/practice/PracticeScreen';
import { ParentDashboard } from '@/features/parent/ParentDashboard';
import { VoiceLab } from '@/features/voice-lab/VoiceLab';
import { LearnHub, LessonScreen } from '@/features/lessons/LearnHub';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { FamilySetup } from '@/features/students/FamilySetup';
import { MatchGame } from '@/features/games/MatchGame';
import { PathScreen } from '@/features/path/PathScreen';
import { StoriesScreen } from '@/features/stories/StoriesScreen';
import { StoryScreen } from '@/features/stories/StoryScreen';
import { MyWordsScreen } from '@/features/words/MyWordsScreen';
import { ShadowScreen } from '@/features/speaking/ShadowScreen';
import { KidsPlay } from '@/features/kids/KidsPlay';
import { KidsBook, KidsBooks } from '@/features/kids/KidsBooks';
import { StickerAlbum } from '@/features/kids/StickerAlbum';
import { useStudent } from './hooks';
import { parentGate } from './parentGate';
import { SpeechPrefsProvider } from './speechPrefs';
import { GlossProvider } from '@/ui/Gloss';
import type { ReactNode } from 'react';

/** Hash routing works from any static host or file path, and offline. */
export function App() {
  return (
    <HashRouter>
      <StopSpeechOnNavigate />
      <Routes>
        <Route path="/" element={<StudentPicker />} />
        <Route path="/new" element={<StudentForm />} />
        <Route path="/setup" element={<FamilySetup />} />
        {/* Every student screen: an unknown id (old link, deleted data) shows a way back. */}
        <Route path="/s/:sid" element={<KnownStudent />}>
          <Route index element={<WithStudentSpeech><HomeScreen /></WithStudentSpeech>} />
          <Route path="settings" element={<StudentForm />} />
          {/* The old "more practice" screen: its groups now open on the home screen. */}
          <Route path="more" element={<Navigate to=".." relative="path" replace />} />
          <Route path="practice/:mode" element={<WithStudentSpeech><PracticeScreen /></WithStudentSpeech>} />
          <Route path="learn" element={<WithStudentSpeech><LearnHub /></WithStudentSpeech>} />
          <Route path="learn/:lessonId" element={<WithStudentSpeech><LessonScreen /></WithStudentSpeech>} />
          <Route path="progress" element={<ProgressScreen />} />
          <Route path="match" element={<WithStudentSpeech><MatchGame /></WithStudentSpeech>} />
          <Route path="path" element={<PathScreen />} />
          <Route path="stories" element={<StoriesScreen />} />
          <Route path="stories/:storyId" element={<WithStudentSpeech><StoryScreen /></WithStudentSpeech>} />
          <Route path="words" element={<WithStudentSpeech><MyWordsScreen /></WithStudentSpeech>} />
          <Route path="kids/play" element={<WithStudentSpeech><KidsPlay /></WithStudentSpeech>} />
          <Route path="kids/books" element={<WithStudentSpeech><KidsBooks /></WithStudentSpeech>} />
          <Route path="kids/books/:bookId" element={<WithStudentSpeech><KidsBook /></WithStudentSpeech>} />
          <Route path="kids/album" element={<StickerAlbum />} />
          <Route path="shadow" element={<WithStudentSpeech><ShadowScreen /></WithStudentSpeech>} />
        </Route>
        <Route path="/parent" element={<ParentOnly />}>
          <Route index element={<ParentDashboard />} />
          <Route path="voices" element={<VoiceLab />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

/** The parent screens, only after the long press (not by URL or the back button). */
function ParentOnly() {
  return parentGate.isUnlocked() ? <Outlet /> : <Navigate to="/" replace />;
}

/** Renders the student's screens only for a student that exists. */
function KnownStudent() {
  const { sid } = useParams();
  const student = useStudent(sid);
  if (student === undefined) return null;
  if (student === null)
    return (
      <main className="screen empty-state">
        <p className="t-h3">התלמיד לא נמצא</p>
        <Link to="/" replace className="btn btn-primary btn-md">
          לבחירת תלמיד
        </Link>
      </main>
    );
  return <Outlet />;
}

/** Any screen change stops speech, so nothing keeps talking after leaving. */
function StopSpeechOnNavigate() {
  const { pathname, search } = useLocation();
  const { speech } = useServices();
  useEffect(() => {
    speech.stop();
  }, [pathname, search, speech]);
  return null;
}

/** Applies the student's accent and speed to every speaker button below. */
function WithStudentSpeech({ children }: { children: ReactNode }) {
  const { sid } = useParams();
  const student = useStudent(sid);
  const prefs = student ? { accent: student.preferences.accent, rate: student.preferences.speechRate } : { accent: 'en-US' as const, rate: 'normal' as const };
  return (
    <SpeechPrefsProvider value={prefs}>
      <GlossProvider>{children}</GlossProvider>
    </SpeechPrefsProvider>
  );
}
