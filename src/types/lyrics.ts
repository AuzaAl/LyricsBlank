export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface LyricWord {
  id: string;
  text: string;
  cleanText: string; // alphanumeric lowercase without punctuation
  startTimeMs: number;
  endTimeMs: number;
  isBlank: boolean;
  userAnswer?: string;
  isCorrect?: boolean;
  /** Number of incorrect submit attempts (blank only) — drives scoring */
  wrongAttempts?: number;
  /** Number of hint letters revealed (blank only) — drives scoring */
  hintsUsed?: number;
  /** True if the player explicitly skipped this blank — drives scoring */
  skipped?: boolean;
  /** Video time (ms) when the blank was answered — real-time window scoring */
  answeredAtMs?: number;
}

export interface LyricLine {
  id: string;
  lineNumber: number;
  startTimeMs: number;
  endTimeMs: number;
  rawText: string;
  words: LyricWord[];
  hasBlank: boolean;
}

export interface SongMetadata {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  durationMs?: number;
  /** Native video dimensions (from oEmbed) — used to size the player frame. */
  width?: number;
  height?: number;
}

export interface SongLesson {
  id: string;
  metadata: SongMetadata;
  difficulty: Difficulty;
  totalBlanks: number;
  lines: LyricLine[];
}

export interface PracticeStats {
  totalBlanks: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  hintsUsed: number;
  accuracy: number;
  xpEarned: number;
  wpm: number;
}
