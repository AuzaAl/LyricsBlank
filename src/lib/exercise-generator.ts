import { Difficulty, LyricLine, SongLesson, SongMetadata } from '@/types/lyrics';

/**
 * Common English grammatical particles that are less interesting to blank
 */
const TRIVIAL_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'is', 'it', 'was', 'as'
]);

/**
 * Selects words to turn into blanks according to selected difficulty.
 * Guarantees that only complete, whole words are blanked (never syllables or fragments).
 */
export function generateExercise(
  metadata: SongMetadata,
  rawLines: LyricLine[],
  difficulty: Difficulty
): SongLesson {
  let totalBlanks = 0;

  // Clone lines to prevent mutating original
  const lines: LyricLine[] = rawLines.map((line) => {
    // Collect candidate indices for whole words
    const candidateIndices: number[] = [];

    line.words.forEach((w, index) => {
      // Must be a complete word with at least 2 characters
      // Avoid stutter/hyphenated repetitions like "ooh-ooh"
      if (w.cleanText.length >= 2 && !w.text.endsWith('-')) {
        candidateIndices.push(index);
      }
    });

    if (candidateIndices.length === 0) {
      return { ...line, hasBlank: false };
    }

    // Determine how many blanks for this line
    let targetBlankCount = 0;
    if (difficulty === 'easy') {
      targetBlankCount = Math.min(1, Math.ceil(candidateIndices.length * 0.18));
    } else if (difficulty === 'medium') {
      targetBlankCount = Math.max(1, Math.round(candidateIndices.length * 0.35));
    } else if (difficulty === 'hard') {
      targetBlankCount = Math.max(1, Math.round(candidateIndices.length * 0.55));
    } else if (difficulty === 'expert') {
      targetBlankCount = Math.max(1, Math.round(candidateIndices.length * 0.8));
    }

    // Score candidates: favor substantial content words (length >= 3, non-trivial)
    const scoredCandidates = candidateIndices.map((idx) => {
      const w = line.words[idx];
      let score = w.cleanText.length;
      if (TRIVIAL_WORDS.has(w.cleanText)) score -= 4;
      if (w.text.includes('-')) score -= 5; // penalize hyphenated words
      return { idx, score };
    });

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);
    const chosenIndices = new Set(
      scoredCandidates.slice(0, targetBlankCount).map((c) => c.idx)
    );

    let lineHasBlank = false;
    const wordsWithBlanks = line.words.map((w, idx) => {
      if (chosenIndices.has(idx)) {
        totalBlanks++;
        lineHasBlank = true;
        return {
          ...w,
          isBlank: true,
          userAnswer: '',
          isCorrect: undefined,
          wrongAttempts: 0,
          hintsUsed: 0,
        };
      }
      return { ...w, isBlank: false };
    });

    return {
      ...line,
      words: wordsWithBlanks,
      hasBlank: lineHasBlank,
    };
  });

  return {
    id: `lesson-${metadata.videoId}-${difficulty}`,
    metadata,
    difficulty,
    totalBlanks,
    lines,
  };
}
