import { Difficulty, LyricLine, LyricWord, SongLesson } from '@/types/lyrics';

/**
 * Pure scoring engine — see docs/multiplayer-design.md §4.
 *
 * Deliberately framework-free and side-effect-free so it can be unit-tested in
 * isolation and, if ranked play is ever needed, moved server-side unchanged.
 */

export type GameMode = 'classic' | 'flow' | 'sprint';

export interface ScoreConfig {
  mode: GameMode;
  difficulty: Difficulty;
  /** Classic only: minimum accuracy (0..1) to be classified as a finisher */
  accuracyGate: number;
  /** Seconds per blank used as par time for the classic speed term */
  secondsPerBlank: number;
  /** Whether the consecutive-correct combo multiplier applies (real-time only) */
  comboEnabled: boolean;
  /** Max combo multiplier bonus, e.g. 0.2 = +20% */
  comboMaxBonus: number;
  /** Number of correct answers to reach the full combo bonus */
  comboCapStreak: number;
}

export const DEFAULT_SCORE_CONFIG: Omit<ScoreConfig, 'mode' | 'difficulty'> = {
  accuracyGate: 0.8,
  secondsPerBlank: 6,
  comboEnabled: true,
  comboMaxBonus: 0.2,
  comboCapStreak: 10,
};

export const POINTS_PER_BLANK = 100;
export const WRONG_PENALTY = 0.25;
export const HINT_PENALTY = 0.15;

export interface ScoreResult {
  score: number;
  basePoints: number;
  speedBonus: number;
  comboMultiplier: number;
  totalBlanks: number;
  correct: number;
  wrong: number;
  hints: number;
  skips: number;
  accuracy: number; // 0..1
  maxCombo: number;
  /** Classic gate: accuracy >= accuracyGate */
  passedGate: boolean;
}

/**
 * Quality of a single blank, clamped to [0, 1].
 * correct first-try = 1.0, each wrong = −0.25, each hint = −0.15, skip = 0.
 */
export function blankQuality(word: LyricWord): number {
  if (!word.isBlank) return 1;
  if (word.skipped) return 0;
  if (word.isCorrect !== true) return 0; // unanswered blank scores nothing

  const wrong = word.wrongAttempts ?? 0;
  const hints = word.hintsUsed ?? 0;
  const q = 1 - wrong * WRONG_PENALTY - hints * HINT_PENALTY;
  return Math.max(0, Math.min(1, q));
}

/**
 * Longest run of consecutive correct blanks (skips/wrongs break the streak).
 */
function computeMaxCombo(lines: LyricLine[]): number {
  let max = 0;
  let run = 0;
  for (const line of lines) {
    for (const w of line.words) {
      if (!w.isBlank) continue;
      if (w.isCorrect === true && !w.skipped) {
        run++;
        max = Math.max(max, run);
      } else if (w.skipped || w.isCorrect === false) {
        run = 0;
      }
    }
  }
  return max;
}

function comboMultiplierFor(streak: number, config: ScoreConfig): number {
  if (!config.comboEnabled || config.comboCapStreak <= 0) return 1;
  const ratio = Math.min(1, streak / config.comboCapStreak);
  return 1 + ratio * config.comboMaxBonus;
}

/**
 * Compute the full score for a finished (or in-progress) lesson.
 *
 * @param lesson      the lesson with per-word answer state
 * @param config      mode/difficulty + tuning
 * @param elapsedMs   wall-clock time from GO to now/finish (classic speed term)
 */
export function computeScore(
  lesson: SongLesson,
  config: ScoreConfig,
  elapsedMs = 0
): ScoreResult {
  let basePoints = 0;
  let correct = 0;
  let wrong = 0;
  let hints = 0;
  let skips = 0;

  for (const line of lesson.lines) {
    for (const w of line.words) {
      if (!w.isBlank) continue;
      if (w.skipped) skips++;
      else if (w.isCorrect === true) correct++;
      wrong += w.wrongAttempts ?? 0;
      hints += w.hintsUsed ?? 0;
      basePoints += POINTS_PER_BLANK * blankQuality(w);
    }
  }

  const totalBlanks = lesson.totalBlanks;
  const attempts = correct + wrong + skips;
  const accuracy = attempts > 0 ? correct / attempts : 1;

  // Combo (real-time only)
  const maxCombo = computeMaxCombo(lesson.lines);
  const comboMultiplier = comboMultiplierFor(maxCombo, config);

  // Speed term
  let speedBonus = 0;
  if (config.mode === 'classic') {
    // Wall-clock from GO; thinking time always counts (fairest — see design §4).
    const parMs = totalBlanks * config.secondsPerBlank * 1000;
    if (parMs > 0 && elapsedMs > 0) {
      const ratio = Math.max(0, Math.min(1, (parMs - elapsedMs) / parMs));
      speedBonus = ratio * 0.2 * (totalBlanks * POINTS_PER_BLANK);
    }
  }
  // Real-time modes: no manual speed term — the TTML window is the clock.

  const score = Math.round(basePoints * comboMultiplier + speedBonus);

  return {
    score,
    basePoints: Math.round(basePoints),
    speedBonus: Math.round(speedBonus),
    comboMultiplier,
    totalBlanks,
    correct,
    wrong,
    hints,
    skips,
    accuracy,
    maxCombo,
    passedGate: accuracy >= config.accuracyGate,
  };
}

/** Build a ScoreConfig from a mode + difficulty + optional overrides. */
export function makeScoreConfig(
  mode: GameMode,
  difficulty: Difficulty,
  overrides: Partial<Omit<ScoreConfig, 'mode' | 'difficulty'>> = {}
): ScoreConfig {
  const realTime = mode === 'flow' || mode === 'sprint';
  return {
    mode,
    difficulty,
    ...DEFAULT_SCORE_CONFIG,
    comboEnabled: realTime,
    ...overrides,
  };
}
