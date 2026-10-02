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
      playerRef.current.seekTo(Math.max(0, adjustedLines[0].startTimeMs / 1000 - 1));
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

  // Find active line
  const activeLineIndex = React.useMemo(() => {
    if (!lesson || lesson.lines.length === 0) return -1;
    const idx = lesson.lines.findIndex(
      (l) => currentTimeMs >= l.startTimeMs && currentTimeMs <= l.endTimeMs
    );
    if (idx !== -1) return idx;
    for (let i = 0; i < lesson.lines.length; i++) {
      if (currentTimeMs < lesson.lines[i].startTimeMs) return Math.max(0, i - 1);
    }
    return lesson.lines.length - 1;
  }, [lesson, currentTimeMs]);

  const activeLine = activeLineIndex >= 0 ? lesson?.lines[activeLineIndex] : undefined;

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
    playerRef.current?.play();
  }, []);

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

  const seekToLine = useCallback((ms: number) => {
    playerRef.current?.seekTo(Math.max(0, ms / 1000 - 0.2));
  }, []);

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

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
    togglePlay,
    closeCompleteModal,
    resetSession,
    setPlaying: setIsPlaying,
    setCurrentTimeMs,
    setDurationMs,
  };
}
