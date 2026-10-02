'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPlayerRef } from '@/components/CinematicVideoPlayer';
import { fetchBiniLyricsTtml } from '@/lib/binilyrics';
import { parseTtml, applyTimingOffset } from '@/lib/ttml-parser';
import { generateExercise } from '@/lib/exercise-generator';
import { extractYouTubeVideoId, fetchYouTubeMetadata } from '@/lib/youtube';
import {
  extractPaletteFromImage,
  DEFAULT_PALETTE,
  VideoColorPalette,
} from '@/lib/color-extractor';
import { sfx } from '@/lib/audio-sfx';
import { findActiveLineIndex, INSTRUMENTAL_THRESHOLD_MS } from '@/lib/instrumental';
import { computeScore, makeScoreConfig, ScoreResult, GameMode } from '@/lib/scoring';
import {
  Difficulty,
  LyricLine,
  PracticeStats,
  SongLesson,
  SongMetadata,
} from '@/types/lyrics';

const EMPTY_STATS: PracticeStats = {
  totalBlanks: 0,
  answeredCount: 0,
  correctCount: 0,
  incorrectCount: 0,
  hintsUsed: 0,
  accuracy: 100,
  xpEarned: 0,
  wpm: 0,
};

export interface BlankAnsweredEvent {
  wordId: string;
  lineIndex: number;
  correct: boolean;
  skipped: boolean;
  hintCount: number;
}

export interface PracticeEngineOptions {
  /** Mode used when computing a final ScoreResult (defaults to a neutral solo config). */
  mode?: GameMode;
  /** Called whenever a blank is answered (correct or skipped). */
  onBlankAnswered?: (evt: BlankAnsweredEvent) => void;
  /** Called when the active lyric line changes. */
  onLineChanged?: (lineIndex: number) => void;
  /** Called once when all blanks are answered. */
  onFinished?: (result: ScoreResult) => void;
  /** Called when a song finishes loading (multiplayer broadcasts it to the room). */
  onSongLoaded?: (meta: SongMetadata) => void;
  /** Real-time modes: lock playback rate to 1.0x (anti-cheat). */
  lockPlaybackRate?: boolean;
  /** Multiplayer: force a host-controlled timing offset instead of local state. */
  lockedTimingOffsetMs?: number;
  /** Multiplayer: force the room's difficulty instead of local state. */
  lockedDifficulty?: Difficulty;
  /** Classic: force auto-pause ON; real-time: force OFF. */
  forcedAutoPause?: boolean;
  /**
   * Classic gate: block playback/seek from passing a line that still has an
   * unanswered blank. Defaults to `mode === 'classic'`.
   */
  enforceLineCompletion?: boolean;
}

export interface PracticeEngine {
  // State
  currentSong: SongMetadata | null;
  difficulty: Difficulty;
  autoPause: boolean;
  soundOn: boolean;
  isLoadingSong: boolean;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  palette: VideoColorPalette;
  timingOffsetMs: number;
  lesson: SongLesson | null;
  stats: PracticeStats;
  isCompleteModalOpen: boolean;

  // Derived
  activeLine: LyricLine | undefined;
  activeLineIndex: number;
  autoPauseLineEndMs: number | null;
  playerRef: React.RefObject<VideoPlayerRef | null>;

  // Actions
  loadSong: (queryOrUrl: string) => Promise<void>;
  reload: () => void;
  selectDifficulty: (d: Difficulty) => void;
  adjustOffset: (deltaMs: number) => void;
  resetOffset: () => void;
  correctAnswer: (wordId: string, answer: string) => void;
  incorrectAnswer: (wordId: string, answer: string) => void;
  skipWord: (wordId: string) => void;
  useHint: (wordId: string) => void;
  replayLine: () => void;
  resumePlay: () => void;
  cyclePlaybackRate: () => void;
  toggleSound: () => void;
  toggleAutoPause: () => void;
  seekToLine: (ms: number) => void;
  /** Gated raw seek (bottom-bar scrubber). Honors the Classic completion gate. */
  seekToMs: (ms: number) => void;
  togglePlay: () => void;
  closeCompleteModal: () => void;
  resetSession: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTimeMs: (ms: number) => void;
  setDurationMs: (ms: number) => void;
}

/**
 * Owns ALL game state for a practice session (solo or multiplayer).
 * Extracted verbatim from the original page.tsx to keep solo behaviour identical
 * while allowing multiplayer to layer callbacks + locked config on top.
 */
export function usePracticeEngine(options: PracticeEngineOptions = {}): PracticeEngine {
  const {
    mode = 'classic',
    onBlankAnswered,
    onLineChanged,
    onFinished,
    onSongLoaded,
    lockPlaybackRate = false,
    lockedTimingOffsetMs,
    lockedDifficulty,
    forcedAutoPause,
    enforceLineCompletion,
  } = options;

  const [currentSong, setCurrentSong] = useState<SongMetadata | null>(null);
  const [difficultyState, setDifficultyState] = useState<Difficulty>('medium');
  const [autoPauseState, setAutoPauseState] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [isLoadingSong, setIsLoadingSong] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [palette, setPalette] = useState<VideoColorPalette>(DEFAULT_PALETTE);

  const [timingOffsetState, setTimingOffsetState] = useState(0);
  const [loadNonce, setLoadNonce] = useState(0);

  const [lesson, setLesson] = useState<SongLesson | null>(null);
  const [baseLines, setBaseLines] = useState<LyricLine[]>([]);
  const [stats, setStats] = useState<PracticeStats>(EMPTY_STATS);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  const playerRef = useRef<VideoPlayerRef>(null);

  // Multiplayer can lock these; otherwise local state wins.
  const timingOffsetMs = lockedTimingOffsetMs ?? timingOffsetState;
  const autoPause = forcedAutoPause ?? autoPauseState;
  const difficulty = lockedDifficulty ?? difficultyState;

  // Keep latest callbacks in refs so effects don't need them as deps.
  const onBlankAnsweredRef = useRef(onBlankAnswered);
  onBlankAnsweredRef.current = onBlankAnswered;
  const onLineChangedRef = useRef(onLineChanged);
  onLineChangedRef.current = onLineChanged;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const onSongLoadedRef = useRef(onSongLoaded);
  onSongLoadedRef.current = onSongLoaded;

  // Extract video colors whenever thumbnail changes
  useEffect(() => {
    if (currentSong?.thumbnailUrl) {
      extractPaletteFromImage(currentSong.thumbnailUrl).then((pal) => {
        setPalette(pal);
      });
    }
  }, [currentSong?.thumbnailUrl]);

  // Fetch lyrics when a song is set (not on every offset/difficulty tweak)
  useEffect(() => {
    if (!currentSong) return;
    let cancelled = false;

    const load = async () => {
      setIsLoadingSong(true);
      setBaseLines([]);
      setLesson(null);
      try {
        const { ttml } = await fetchBiniLyricsTtml(
          currentSong.videoId,
          currentSong.title,
          currentSong.artist
        );
        if (cancelled) return;
        const parsed = parseTtml(ttml);
        setBaseLines(parsed);
        onSongLoadedRef.current?.(currentSong);
      } catch (err) {
        console.error('Failed to load song lyrics:', err);
      } finally {
        if (!cancelled) setIsLoadingSong(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong, loadNonce]);

  // (Re)build the exercise from cached lines when timing/difficulty change
  useEffect(() => {
    if (baseLines.length === 0 || !currentSong) return;
    const adjustedLines = applyTimingOffset(baseLines, timingOffsetMs);
    const newLesson = generateExercise(currentSong, adjustedLines, difficulty);
    setLesson(newLesson);
    setStats((prev) => ({
      ...prev,
      totalBlanks: newLesson.totalBlanks,
      answeredCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: 100,
    }));
    if (adjustedLines.length > 0 && playerRef.current) {
      // Start at 0 when the song opens with a long instrumental intro so the
      // note row is visible; otherwise cue just before the first line.
      const firstStart = adjustedLines[0].startTimeMs;
      const startMs =
        firstStart >= INSTRUMENTAL_THRESHOLD_MS ? 0 : Math.max(0, firstStart - 1000);
      playerRef.current.seekTo(startMs / 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLines, difficulty, timingOffsetMs]);

  // Adjust timing offset
  const adjustOffset = useCallback(
    (deltaMs: number) => {
      if (lockedTimingOffsetMs !== undefined) return; // locked by host
      setTimingOffsetState((prev) => prev + deltaMs);
    },
    [lockedTimingOffsetMs]
  );

  const resetOffset = useCallback(() => {
    if (lockedTimingOffsetMs !== undefined) return;
    setTimingOffsetState(0);
  }, [lockedTimingOffsetMs]);

  // Handle URL / Song Search submission
  const loadSong = useCallback(
    async (queryOrUrl: string) => {
      const videoId = extractYouTubeVideoId(queryOrUrl);
      setIsLoadingSong(true);

      try {
        if (videoId) {
          const meta = await fetchYouTubeMetadata(videoId);
          setCurrentSong(meta);
          if (lockedTimingOffsetMs === undefined) setTimingOffsetState(0);
          setLoadNonce((n) => n + 1);
        } else if (currentSong) {
          let cleanTitle = queryOrUrl.trim();
          let cleanArtist = '';
          if (cleanTitle.includes(' - ')) {
            const parts = cleanTitle.split(' - ');
            cleanArtist = parts[0].trim();
            cleanTitle = parts.slice(1).join(' - ').trim();
          }
          setCurrentSong({ ...currentSong, title: cleanTitle, artist: cleanArtist });
          if (lockedTimingOffsetMs === undefined) setTimingOffsetState(0);
          setLoadNonce((n) => n + 1);
        }
      } catch {
        console.error('Failed to resolve song');
      } finally {
        setIsLoadingSong(false);
      }
    },
    [currentSong, lockedTimingOffsetMs]
  );

  const reload = useCallback(() => setLoadNonce((n) => n + 1), []);

  const selectDifficulty = useCallback(
    (newDiff: Difficulty) => {
      if (lockedDifficulty !== undefined) return; // locked by room
      setDifficultyState(newDiff);
    },
    [lockedDifficulty]
  );

  // Find active line (gap-aware: during a long instrumental break → -1)
  const activeLineIndex = React.useMemo(
    () => findActiveLineIndex(lesson?.lines ?? [], currentTimeMs),
    [lesson, currentTimeMs]
  );

  const activeLine = activeLineIndex >= 0 ? lesson?.lines[activeLineIndex] : undefined;

  // ---- Classic gate: playback may never pass an incomplete line ----------
  const enforceCompletion = enforceLineCompletion ?? mode === 'classic';

  /**
   * Index of the first line that still has an unanswered blank (skips count as
   * answered), or -1 when nothing blocks. Pure helper so it can run against a
   * synchronously-updated lesson ref (state updates are async).
   */
  const firstIncompleteLineIndex = useCallback(
    (ls: LyricLine[] | null): number => {
      if (!enforceCompletion || !ls) return -1;
      return ls.findIndex((l) =>
        l.words.some((w) => w.isBlank && w.isCorrect === undefined && !w.skipped)
      );
    },
    [enforceCompletion]
  );

  // Always-fresh lesson (updated synchronously by answer handlers below) so the
  // gate sees the answer that was just submitted, not the previous render.
  const lessonRef = useRef<LyricLine[] | null>(lesson?.lines ?? null);
  lessonRef.current = lesson ? lesson.lines : null;

  /** Line index at a given time (gaps resolve to the preceding line). */
  const lineIndexAt = useCallback((ms: number, ls: LyricLine[]): number => {
    for (let i = 0; i < ls.length; i++) {
      if (ms < ls[i].startTimeMs) return Math.max(0, i - 1);
    }
    return ls.length - 1;
  }, []);


  // Notify line changes
  const prevLineIndexRef = useRef(-1);
  useEffect(() => {
    if (activeLineIndex >= 0 && activeLineIndex !== prevLineIndexRef.current) {
      prevLineIndexRef.current = activeLineIndex;
      onLineChangedRef.current?.(activeLineIndex);
    }
  }, [activeLineIndex]);

  // Auto-pause calculation
  const autoPauseLineEndMs = React.useMemo(() => {
    if (!autoPause || !activeLine || !activeLine.hasBlank) return null;
    const hasUnansweredBlank = activeLine.words.some(
      (w) => w.isBlank && w.isCorrect === undefined && !w.skipped
    );
    if (hasUnansweredBlank) {
      return Math.max(activeLine.startTimeMs + 500, activeLine.endTimeMs - 200);
    }
    return null;
  }, [autoPause, activeLine]);

  /**
   * Classic completion watchdog. Independent of the auto-pause toggle: if
   * playback ever reaches the end of the first incomplete line, we hard-pause
   * so the player can never drift into the next line with blanks left over.
   */
  useEffect(() => {
    if (!isPlaying) return;
    const ls = lessonRef.current;
    const gate = firstIncompleteLineIndex(ls);
    if (gate < 0 || !ls) return;
    const gateLine = ls[gate];
    const lineEnd = Math.max(gateLine.startTimeMs + 500, gateLine.endTimeMs - 200);
    if (currentTimeMs >= lineEnd) {
      playerRef.current?.pause();
    }
  }, [isPlaying, currentTimeMs, firstIncompleteLineIndex]);

  // Emit a final score result when all blanks are answered
  const maybeFinish = useCallback(
    (finishedLesson: SongLesson, elapsedMs: number) => {
      const config = makeScoreConfig(mode, finishedLesson.difficulty);
      const result = computeScore(finishedLesson, config, elapsedMs);
      onFinishedRef.current?.(result);
      return result;
    },
    [mode]
  );

  const findLineIndex = useCallback(
    (wordId: string): number => {
      if (!lesson) return -1;
      return lesson.lines.findIndex((l) => l.words.some((w) => w.id === wordId));
    },
    [lesson]
  );

  // Answer handlers
  const correctAnswer = useCallback(
    (wordId: string, answer: string) => {
      if (!lesson) return;

      const updatedAnsweredCount = stats.answeredCount + 1;
      const updatedCorrectCount = stats.correctCount + 1;
      const newXp = stats.xpEarned + 10;

      const newLines = lesson.lines.map((l) => ({
        ...l,
        words: l.words.map((w) => {
          if (w.id === wordId) {
            return { ...w, userAnswer: answer, isCorrect: true, answeredAtMs: currentTimeMs };
          }
          return w;
        }),
      }));

      const newLesson = { ...lesson, lines: newLines };
      lessonRef.current = newLines;
      setLesson(newLesson);

      const totalAttempts = updatedCorrectCount + stats.incorrectCount;
      const newAccuracy = Math.round((updatedCorrectCount / totalAttempts) * 100);

      setStats((prev) => ({
        ...prev,
        answeredCount: updatedAnsweredCount,
        correctCount: updatedCorrectCount,
        accuracy: newAccuracy,
        xpEarned: newXp,
      }));

      const word = lesson.lines.flatMap((l) => l.words).find((w) => w.id === wordId);
      onBlankAnsweredRef.current?.({
        wordId,
        lineIndex: findLineIndex(wordId),
        correct: true,
        skipped: false,
        hintCount: word?.hintsUsed ?? 0,
      });

      if (updatedAnsweredCount >= lesson.totalBlanks) {
        setTimeout(() => {
          setIsCompleteModalOpen(true);
          maybeFinish(newLesson, currentTimeMs);
        }, 500);
      }
    },
    [lesson, stats, currentTimeMs, findLineIndex, maybeFinish]
  );

  const incorrectAnswer = useCallback(
    (wordId: string) => {
      const updatedIncorrectCount = stats.incorrectCount + 1;
      const totalAttempts = stats.correctCount + updatedIncorrectCount;
      const newAccuracy = Math.round((stats.correctCount / totalAttempts) * 100);

      setStats((prev) => ({
        ...prev,
        incorrectCount: updatedIncorrectCount,
        accuracy: newAccuracy,
      }));

      // Track per-word wrong attempts for scoring
      setLesson((prev) =>
        prev
          ? {
              ...prev,
              lines: prev.lines.map((l) => ({
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, wrongAttempts: (w.wrongAttempts ?? 0) + 1 } : w
                ),
              })),
            }
          : prev
      );
    },
    [stats]
  );

  const skipWord = useCallback(
    (wordId: string) => {
      if (!lesson) return;

      const newLines = lesson.lines.map((l) => ({
        ...l,
        words: l.words.map((w) => {
          if (w.id === wordId) {
            return { ...w, isCorrect: false, skipped: true };
          }
          return w;
        }),
      }));

      const newLesson = { ...lesson, lines: newLines };
      lessonRef.current = newLines;
      setLesson(newLesson);

      const updatedAnsweredCount = stats.answeredCount + 1;
      const updatedIncorrectCount = stats.incorrectCount + 1;
      const totalAttempts = stats.correctCount + updatedIncorrectCount;
      const newAccuracy = Math.round((stats.correctCount / totalAttempts) * 100);

      setStats((prev) => ({
        ...prev,
        answeredCount: updatedAnsweredCount,
        incorrectCount: updatedIncorrectCount,
        accuracy: newAccuracy,
      }));

      onBlankAnsweredRef.current?.({
        wordId,
        lineIndex: findLineIndex(wordId),
        correct: false,
        skipped: true,
        hintCount: 0,
      });

      if (updatedAnsweredCount >= lesson.totalBlanks) {
        setTimeout(() => {
          setIsCompleteModalOpen(true);
          maybeFinish(newLesson, currentTimeMs);
        }, 500);
      }
    },
    [lesson, stats, currentTimeMs, findLineIndex, maybeFinish]
  );

  const useHint = useCallback((wordId: string) => {
    setStats((prev) => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
    setLesson((prev) =>
      prev
        ? {
            ...prev,
            lines: prev.lines.map((l) => ({
              ...l,
              words: l.words.map((w) =>
                w.id === wordId ? { ...w, hintsUsed: (w.hintsUsed ?? 0) + 1 } : w
              ),
            })),
          }
        : prev
    );
  }, []);

  const replayLine = useCallback(() => {
    playerRef.current?.replayCurrentLine();
  }, []);

  const resumePlay = useCallback(() => {
    // Classic gate: never resume past a line that still has an unanswered blank.
    const ls = lessonRef.current;
    const gate = firstIncompleteLineIndex(ls);
    if (gate >= 0 && ls) {
      const gateLine = ls[gate];
      const lineEnd = Math.max(gateLine.startTimeMs + 500, gateLine.endTimeMs - 200);
      if (currentTimeMs >= lineEnd) {
        playerRef.current?.seekTo(Math.max(0, gateLine.startTimeMs / 1000 - 0.2));
      }
    }
    playerRef.current?.play();
  }, [firstIncompleteLineIndex, currentTimeMs]);

  const cyclePlaybackRate = useCallback(() => {
    if (lockPlaybackRate) return; // real-time modes lock to 1.0x
    const rates = [0.75, 0.85, 1, 1.25];
    setPlaybackRate((prev) => {
      const nextIdx = (rates.indexOf(prev) + 1) % rates.length;
      const nextRate = rates[nextIdx];
      playerRef.current?.setPlaybackRate(nextRate);
      return nextRate;
    });
  }, [lockPlaybackRate]);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      sfx.setSoundEnabled(next);
      return next;
    });
  }, []);

  const toggleAutoPause = useCallback(() => {
    if (forcedAutoPause !== undefined) return; // locked by mode
    setAutoPauseState((prev) => !prev);
  }, [forcedAutoPause]);

  const seekToLine = useCallback(
    (ms: number) => {
      // Classic gate: never jump to (or past) a line beyond the first
      // incomplete one — the player must fill the current line first.
      const ls = lessonRef.current;
      const gate = firstIncompleteLineIndex(ls);
      if (gate >= 0 && ls) {
        const target = lineIndexAt(ms, ls);
        if (target > gate) {
          const gateLine = ls[gate];
          playerRef.current?.seekTo(Math.max(0, gateLine.startTimeMs / 1000 - 0.2));
          return;
        }
      }
      playerRef.current?.seekTo(Math.max(0, ms / 1000 - 0.2));
    },
    [firstIncompleteLineIndex, lineIndexAt]
  );

  const seekToMs = useCallback(
    (ms: number) => {
      const ls = lessonRef.current;
      const gate = firstIncompleteLineIndex(ls);
      if (gate >= 0 && ls) {
        const target = lineIndexAt(ms, ls);
        if (target > gate) {
          const gateLine = ls[gate];
          playerRef.current?.seekTo(Math.max(0, gateLine.startTimeMs / 1000 - 0.2));
          return;
        }
      }
      playerRef.current?.seekTo(Math.max(0, ms / 1000));
    },
    [firstIncompleteLineIndex, lineIndexAt]
  );

  const togglePlay = useCallback(() => {
    // Classic gate: if paused at/after an incomplete line, snap back to it
    // instead of letting playback run into the next line.
    if (!isPlaying) {
      const ls = lessonRef.current;
      const gate = firstIncompleteLineIndex(ls);
      if (gate >= 0 && ls) {
        const gateLine = ls[gate];
        const lineEnd = Math.max(gateLine.startTimeMs + 500, gateLine.endTimeMs - 200);
        if (currentTimeMs >= lineEnd) {
          playerRef.current?.seekTo(Math.max(0, gateLine.startTimeMs / 1000 - 0.2));
          playerRef.current?.play();
          return;
        }
      }
    }
    playerRef.current?.togglePlay();
  }, [isPlaying, firstIncompleteLineIndex, currentTimeMs]);

  const closeCompleteModal = useCallback(() => setIsCompleteModalOpen(false), []);

  const resetSession = useCallback(() => {
    setCurrentSong(null);
    setLesson(null);
    setBaseLines([]);
    setIsCompleteModalOpen(false);
  }, []);

  return {
    currentSong,
    difficulty,
    autoPause,
    soundOn,
    isLoadingSong,
    isPlaying,
    currentTimeMs,
    durationMs,
    playbackRate,
    palette,
    timingOffsetMs,
    lesson,
    stats,
    isCompleteModalOpen,
    activeLine,
    activeLineIndex,
    autoPauseLineEndMs,
    playerRef,
    loadSong,
    reload,
    selectDifficulty,
    adjustOffset,
    resetOffset,
    correctAnswer,
    incorrectAnswer,
    skipWord,
    useHint,
    replayLine,
    resumePlay,
    cyclePlaybackRate,
    toggleSound,
    toggleAutoPause,
    seekToLine,
    seekToMs,
    togglePlay,
    closeCompleteModal,
    resetSession,
    setPlaying: setIsPlaying,
    setCurrentTimeMs,
    setDurationMs,
  };
}
