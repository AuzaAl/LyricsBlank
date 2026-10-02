import { LyricLine } from '@/types/lyrics';

/**
 * Instrumental-break detection (intro / interlude / outro).
 *
 * Mirrors the behaviour of BiniLyrics' own renderer (`am-lyrics`) and
 * Better Lyrics / YouTube Music: a stretch of silence of at least this
 * long between two lyric lines is treated as an instrumental break and
 * rendered as an animated music-note row instead of empty space.
 */
export const INSTRUMENTAL_THRESHOLD_MS = 7000;

export interface InstrumentalGap {
  id: string;
  /** Gap start (ms). 0 for the intro gap. */
  startTimeMs: number;
  /** Gap end (ms). Equals the next line's start, or the song duration for the outro. */
  endTimeMs: number;
  durationMs: number;
  /** Index of the line that precedes the gap. -1 for the intro gap. */
  afterLineIndex: number;
}

/**
 * Finds every silence >= INSTRUMENTAL_THRESHOLD_MS:
 *  - intro  : 0 → first line start
 *  - interlude: line[i].end → line[i+1].start
 *  - outro  : last line end → durationMs (only when the duration is known)
 */
export function findInstrumentalGaps(
  lines: LyricLine[],
  durationMs?: number
): InstrumentalGap[] {
  const gaps: InstrumentalGap[] = [];
  if (!lines || lines.length === 0) return gaps;

  const push = (
    afterLineIndex: number,
    startTimeMs: number,
    endTimeMs: number,
    id: string
  ) => {
    const durationMs = endTimeMs - startTimeMs;
    if (durationMs >= INSTRUMENTAL_THRESHOLD_MS) {
      gaps.push({ id, startTimeMs, endTimeMs, durationMs, afterLineIndex });
    }
  };

  // Intro
  push(-1, 0, lines[0].startTimeMs, 'gap-intro');

  // Interludes
  for (let i = 0; i < lines.length - 1; i++) {
    push(i, lines[i].endTimeMs, lines[i + 1].startTimeMs, `gap-after-${i}`);
  }

  // Outro (only if we know the total duration)
  if (durationMs && durationMs > 0) {
    push(
      lines.length - 1,
      lines[lines.length - 1].endTimeMs,
      durationMs,
      'gap-outro'
    );
  }

  return gaps;
}

/** Returns the gap that contains time `t`, if any. */
export function findGapAt(
  gaps: InstrumentalGap[],
  t: number
): InstrumentalGap | undefined {
  return gaps.find((g) => t >= g.startTimeMs && t < g.endTimeMs);
}

/**
 * Gap-aware active-line lookup shared by the renderer and the engine.
 *
 * - Inside a line → that line's index.
 * - Inside a *long* silence (>= threshold) → -1, so no line is highlighted
 *   and the instrumental note row becomes the active row instead.
 * - Inside a short silence → the previous line stays highlighted (no flicker).
 * - Before the first line → 0 only once the line is imminent; otherwise -1
 *   (so the first lyric is not "active" during a long intro).
 */
export function findActiveLineIndex(lines: LyricLine[], t: number): number {
  if (!lines || lines.length === 0) return -1;

  for (let i = 0; i < lines.length; i++) {
    if (t >= lines[i].startTimeMs && t <= lines[i].endTimeMs) return i;
  }

  const first = lines[0];
  if (t < first.startTimeMs) {
    return first.startTimeMs - t >= INSTRUMENTAL_THRESHOLD_MS ? -1 : 0;
  }

  const last = lines[lines.length - 1];
  if (t > last.endTimeMs) return lines.length - 1;

  for (let i = 0; i < lines.length - 1; i++) {
    if (t > lines[i].endTimeMs && t < lines[i + 1].startTimeMs) {
      const gap = lines[i + 1].startTimeMs - lines[i].endTimeMs;
      return gap >= INSTRUMENTAL_THRESHOLD_MS ? -1 : i;
    }
  }

  return lines.length - 1;
}
