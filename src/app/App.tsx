import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
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
import { useStudent } from './hooks';
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
        <Route path="/s/:sid" element={<WithStudentSpeech><HomeScreen /></WithStudentSpeech>} />
        <Route path="/s/:sid/settings" element={<StudentForm />} />
        <Route path="/s/:sid/practice/:mode" element={<WithStudentSpeech><PracticeScreen /></WithStudentSpeech>} />
        <Route path="/s/:sid/learn" element={<WithStudentSpeech><LearnHub /></WithStudentSpeech>} />
        <Route path="/s/:sid/learn/:lessonId" element={<WithStudentSpeech><LessonScreen /></WithStudentSpeech>} />
        <Route path="/s/:sid/progress" element={<ProgressScreen />} />
        <Route path="/s/:sid/match" element={<WithStudentSpeech><MatchGame /></WithStudentSpeech>} />
        <Route path="/s/:sid/path" element={<PathScreen />} />
        <Route path="/s/:sid/stories" element={<StoriesScreen />} />
        <Route path="/s/:sid/stories/:storyId" element={<WithStudentSpeech><StoryScreen /></WithStudentSpeech>} />
        <Route path="/s/:sid/words" element={<WithStudentSpeech><MyWordsScreen /></WithStudentSpeech>} />
        <Route path="/s/:sid/shadow" element={<WithStudentSpeech><ShadowScreen /></WithStudentSpeech>} />
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/voices" element={<VoiceLab />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
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
