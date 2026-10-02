'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppChrome } from '@/components/shell/AppChrome';
import { PracticeView } from '@/components/shell/PracticeView';
import { CreateJoinModal } from '@/components/multiplayer/CreateJoinModal';
import { LobbyPanel } from '@/components/multiplayer/LobbyPanel';
import { CountdownOverlay } from '@/components/multiplayer/CountdownOverlay';
import { RaceScoreboard } from '@/components/multiplayer/RaceScoreboard';
import { RaceResultsModal } from '@/components/multiplayer/RaceResultsModal';
import { useRoom } from '@/hooks/useRoom';
import { usePracticeEngine, PracticeEngine } from '@/hooks/usePracticeEngine';
import { computeScore, makeScoreConfig, GameMode } from '@/lib/scoring';
import type { ProgressSnapshot, RoomConfig } from '@/lib/room-store';

interface MultiplayerShellProps {
  /** Room code from a shared invite link (?room=ABC12), if any. */
  initialRoomCode?: string | null;
  onExit: () => void;
}

/**
 * Derive a ProgressSnapshot straight from the lesson (mirrors computeScore) so
 * the server never needs the answer key — clients stay authoritative (design §6).
 */
function buildSnapshot(engine: PracticeEngine, mode: GameMode, elapsedMs: number): ProgressSnapshot {
  const lesson = engine.lesson;
  if (!lesson) {
    return {
      lineIndex: 0,
      blanksDone: 0,
      correct: 0,
      wrong: 0,
      hints: 0,
      skips: 0,
      combo: 0,
      score: 0,
      accuracy: 1,
      activeTimeMs: elapsedMs,
      totalLines: 0,
    };
  }

  const result = computeScore(lesson, makeScoreConfig(mode, lesson.difficulty), elapsedMs);
  return {
    lineIndex: Math.max(0, engine.activeLineIndex),
    blanksDone: result.correct + result.skips,
    correct: result.correct,
    wrong: result.wrong,
    hints: result.hints,
    skips: result.skips,
    combo: result.maxCombo,
    score: result.score,
    accuracy: result.accuracy,
    activeTimeMs: elapsedMs,
    totalLines: lesson.lines.length,
  };
}

/**
 * Multiplayer layer (design §8). Wraps the same engine + practice UI as solo,
 * and injects the lobby → countdown → racing → results flow on top.
 */
export const MultiplayerShell: React.FC<MultiplayerShellProps> = ({ initialRoomCode, onExit }) => {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const {
    room,
    phase,
    playerId,
    isHost,
    standings,
    results,
    countdown,
    startAt,
    sprintSeconds,
    error,
    createRoom,
    joinRoom,
    setReady,
    setConfig,
    start,
    reportProgress,
    finish,
    leave,
    rematch,
  } = useRoom();

  const mode: GameMode = room?.config.mode ?? 'classic';

  // Latest-ref bridges so effects never depend on unstable callbacks.
  const setConfigRef = useRef(setConfig);
  setConfigRef.current = setConfig;
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const reportProgressRef = useRef(reportProgress);
  reportProgressRef.current = reportProgress;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const startAtRef = useRef(startAt);
  startAtRef.current = startAt;

  const engine = usePracticeEngine({
    mode,
    // Real-time modes lock the clock to 1.0x (anti-cheat, design §5).
    lockPlaybackRate: mode !== 'classic',
    // Classic forces auto-pause ON; real-time forces it OFF.
    forcedAutoPause: mode === 'classic',
    // Host-controlled timing offset → locked to 0 for fairness.
    lockedTimingOffsetMs: room ? 0 : undefined,
    lockedDifficulty: room?.config.difficulty,
    // Host picks the song; broadcast it so every client loads the same one.
    onSongLoaded: (meta) => {
      if (isHostRef.current) {
        setConfigRef.current({
          song: { videoId: meta.videoId, title: meta.title, artist: meta.artist },
        });
      }
    },
    onFinished: (result) => {
      const finishTimeMs = startAtRef.current ? Date.now() - startAtRef.current : undefined;
      finishRef.current({
        finishTimeMs: modeRef.current === 'classic' ? finishTimeMs : undefined,
        score: result.score,
        accuracy: result.accuracy,
      });
    },
  });

  const { currentSong, lesson, stats, activeLineIndex, isLoadingSong, loadSong } = engine;

  // ---- Load the room's song locally whenever the host changes it ----
  const loadSongRef = useRef(loadSong);
  loadSongRef.current = loadSong;
  const localVideoId = currentSong?.videoId;
  const roomVideoId = room?.config.song?.videoId;

  useEffect(() => {
    if (!roomVideoId) return;
    if (localVideoId === roomVideoId) return;
    loadSongRef.current(roomVideoId);
  }, [roomVideoId, localVideoId]);

  // ---- Race clock (classic wall-clock / sprint countdown) ----
  useEffect(() => {
    if (phase !== 'racing') return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  const elapsedMs = startAt ? Math.max(0, nowMs - startAt) : 0;
  const sprintRemainingMs =
    startAt && sprintSeconds ? Math.max(0, startAt + sprintSeconds * 1000 - nowMs) : undefined;

  // ---- Report progress to the room (throttled to ~2x/s) ----
  const lastReportRef = useRef(0);
  useEffect(() => {
    if (phase !== 'racing' || !lesson) return;
    const now = Date.now();
    if (now - lastReportRef.current < 450) return;
    lastReportRef.current = now;
    reportProgressRef.current(buildSnapshot(engine, mode, elapsedMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, stats, activeLineIndex, phase, elapsedMs]);

  // ---- Seek to the first line when the gun fires ----
  const seekedForRaceRef = useRef(false);
  useEffect(() => {
    if (phase === 'racing' && !seekedForRaceRef.current) {
      seekedForRaceRef.current = true;
      engine.seekToLine(lesson?.lines[0]?.startTimeMs ?? 0);
    }
    if (phase !== 'racing') seekedForRaceRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- Actions ----
  const handleCreate = useCallback(
    (input: { name: string; config: Partial<RoomConfig> }) => {
      createRoom(input);
    },
    [createRoom]
  );

  const handleJoin = useCallback(
    (code: string, name: string) => {
      joinRoom(code, name);
    },
    [joinRoom]
  );

  const handleLeave = useCallback(() => {
    leave();
    onExit();
  }, [leave, onExit]);

  const handleRematch = useCallback(() => {
    rematch();
    engine.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rematch, engine.reload]);

  const artUrl = currentSong
    ? `https://i.ytimg.com/vi/${currentSong.videoId}/maxresdefault.jpg`
    : '';

  const inLobby = phase === 'lobby';
  const clockMs = mode === 'sprint' ? sprintRemainingMs : mode === 'classic' ? elapsedMs : undefined;
  const clockLabel = mode === 'sprint' ? 'Left' : 'Time';

  return (
    <AppChrome
      artUrl={artUrl}
      fallbackUrl={currentSong?.thumbnailUrl}
      onOpenShortcuts={() => setIsShortcutsOpen(true)}
      isShortcutsOpen={isShortcutsOpen}
      onCloseShortcuts={() => setIsShortcutsOpen(false)}
      overlay={
        <>
          {!room && (
            <CreateJoinModal
              isOpen
              onClose={onExit}
              onCreate={handleCreate}
              onJoin={handleJoin}
              error={error}
              defaultTab={initialRoomCode ? 'join' : 'create'}
              defaultCode={initialRoomCode ?? ''}
            />
          )}

          {room && phase === 'countdown' && (
            <CountdownOverlay key={countdown ?? 3} from={countdown ?? 3} label="Get ready…" />
          )}

          <RaceResultsModal
            isOpen={!!results}
            standings={results ?? standings}
            playerId={playerId}
            mode={mode}
            onRematch={handleRematch}
            onLeave={handleLeave}
          />
        </>
      }
    >
      {room ? (
        inLobby ? (
          <LobbyPanel
            room={room}
            playerId={playerId}
            isHost={isHost}
            onSetReady={setReady}
            onSetConfig={setConfig}
            onStart={start}
            onLeave={handleLeave}
            onLoadSong={engine.loadSong}
            isLoadingSong={isLoadingSong}
          />
        ) : (
          <PracticeView
            engine={engine}
            topSlot={
              phase === 'racing' ? (
                <RaceScoreboard
                  standings={standings}
                  playerId={playerId}
                  mode={mode}
                  clockMs={clockMs}
                  clockLabel={clockLabel}
                />
              ) : undefined
            }
          />
        )
      ) : null}
    </AppChrome>
  );
};
