import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { StudentPicker } from '@/features/students/StudentPicker';
import { StudentForm } from '@/features/students/StudentForm';
import { HomeScreen } from '@/features/home/HomeScreen';
import { PracticeScreen } from '@/features/practice/PracticeScreen';
import { ParentDashboard } from '@/features/parent/ParentDashboard';
import { VoiceLab } from '@/features/voice-lab/VoiceLab';
import { LearnHub, LessonScreen } from '@/features/lessons/LearnHub';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { FamilySetup } from '@/features/students/FamilySetup';
import { useStudent } from './hooks';
import { SpeechPrefsProvider } from './speechPrefs';
import type { ReactNode } from 'react';

/** Hash routing works from any static host or file path, and offline. */
export function App() {
  return (
    <HashRouter>
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
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/voices" element={<VoiceLab />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

/** Applies the student's accent and speed to every speaker button below. */
function WithStudentSpeech({ children }: { children: ReactNode }) {
  const { sid } = useParams();
  const student = useStudent(sid);
  const prefs = student ? { accent: student.preferences.accent, rate: student.preferences.speechRate } : { accent: 'en-US' as const, rate: 'normal' as const };
  return <SpeechPrefsProvider value={prefs}>{children}</SpeechPrefsProvider>;
}
