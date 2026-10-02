/**
 * Pronunciation assessment (future stage).
 * Flow: Listen -> Understand -> Repeat -> Record -> Compare -> Improve.
 * Takes a recording and the model text, returns targeted feedback.
 */
export interface PronunciationIssue {
  word: string;
  /** e.g. "vowel-length", "th-sound", "word-stress", "final-consonant" */
  kind: string;
  severity: 'minor' | 'major';
}

export interface PronunciationAssessment {
  overall: number;
  fluency?: number;
  issues: PronunciationIssue[];
}

export interface PronunciationAssessor {
  readonly id: string;
  readonly runsOnDevice: boolean;
  assess(recording: Blob, expectedText: string, accent: 'en-US' | 'en-GB'): Promise<PronunciationAssessment>;
}
