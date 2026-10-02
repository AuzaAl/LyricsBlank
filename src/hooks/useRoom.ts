'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ProgressSnapshot,
  RoomConfig,
  RoomSnapshot,
  ServerEvent,
  Standing,
} from '@/lib/room-store';
import type { GameMode } from '@/lib/scoring';
import type { Difficulty } from '@/types/lyrics';

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'finished';

export interface UseRoomState {
  room: RoomSnapshot | null;
  phase: RoomPhase;
  playerId: string | null;
  isHost: boolean;
  standings: Standing[];
  results: Standing[] | null;
  countdown: number | null;
  startAt: number | null;
  sprintSeconds: number | null;
  timeUp: boolean;
  error: string | null;
  connected: boolean;
}

export interface UseRoomActions {
  createRoom: (input: {
    name: string;
    config: Partial<RoomConfig>;
  }) => Promise<void>;
  joinRoom: (code: string, name: string) => Promise<void>;
  setReady: (ready: boolean) => void;
  setConfig: (patch: Partial<RoomConfig>) => void;
  start: () => void;
  reportProgress: (snapshot: ProgressSnapshot) => void;
  finish: (input: { finishTimeMs?: number; score: number; accuracy: number }) => void;
  leave: () => void;
  rematch: () => void;
}

const STORAGE_KEY = 'lyricsblank.room';

interface StoredCreds {
  code: string;
  playerId: string;
  token: string;
}

function loadCreds(): StoredCreds | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredCreds) : null;
  } catch {
    return null;
  }
}

function saveCreds(creds: StoredCreds): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } catch {
    // ignore
  }
}

function clearCreds(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * SSE client for the multiplayer room. Opens an EventSource on mount once we
 * have credentials and reconnects automatically (the browser retries SSE), which
 * pairs with the server's 10s disconnect grace window.
 */
export function useRoom(): UseRoomState & UseRoomActions {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [phase, setPhase] = useState<RoomPhase>('lobby');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [results, setResults] = useState<Standing[] | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [sprintSeconds, setSprintSeconds] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const credsRef = useRef<StoredCreds | null>(null);

  // ----- SSE connection -----
  const connect = useCallback((creds: StoredCreds) => {
    credsRef.current = creds;
    setPlayerId(creds.playerId);

    if (esRef.current) esRef.current.close();

    const url = `/api/room/${creds.code}/events?playerId=${encodeURIComponent(
      creds.playerId
    )}&token=${encodeURIComponent(creds.token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handle = (event: MessageEvent) => {
      let payload: ServerEvent;
      try {
        payload = JSON.parse(event.data) as ServerEvent;
      } catch {
        return;
      }
      switch (payload.type) {
        case 'room':
          setRoom(payload.room);
          setPhase(payload.room.phase);
          break;
        case 'playerJoined':
          setRoom((prev) =>
            prev && !prev.players.some((p) => p.id === payload.player.id)
              ? { ...prev, players: [...prev.players, payload.player] }
              : prev
          );
          break;
        case 'playerLeft':
          setRoom((prev) =>
            prev ? { ...prev, players: prev.players.filter((p) => p.id !== payload.playerId) } : prev
          );
          break;
        case 'playerReady':
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  players: prev.players.map((p) =>
                    p.id === payload.playerId ? { ...p, ready: payload.ready } : p
                  ),
                }
              : prev
          );
          break;
        case 'countdown':
          setPhase('countdown');
          setCountdown(payload.seconds);
          break;
        case 'go':
          setPhase('racing');
          setStartAt(payload.startAt);
          setSprintSeconds(payload.sprintSeconds ?? null);
          setCountdown(null);
          break;
        case 'standings':
          setStandings(payload.standings);
          break;
        case 'playerFinished':
          setStandings((prev) =>
            prev.map((s) =>
              s.playerId === payload.playerId
                ? { ...s, score: payload.score, finishTimeMs: payload.finishTimeMs, status: 'finished' }
                : s
            )
          );
          break;
        case 'playerDnf':
          setStandings((prev) =>
            prev.map((s) => (s.playerId === payload.playerId ? { ...s, status: 'dnf' } : s))
          );
          break;
        case 'timeUp':
          setTimeUp(true);
          break;
        case 'results':
          setResults(payload.standings);
          setPhase('finished');
          break;
        case 'error':
          setError(payload.message);
          break;
      }
    };

    // The server sends named events; register listeners for each type.
    const types: ServerEvent['type'][] = [
      'room',
      'playerJoined',
      'playerLeft',
      'playerReady',
      'countdown',
      'go',
      'standings',
      'playerFinished',
      'playerDnf',
      'timeUp',
      'results',
      'error',
    ];
    for (const t of types) es.addEventListener(t, handle as EventListener);
  }, []);

  // Restore credentials on mount (survives refresh within the grace window).
  useEffect(() => {
    const stored = loadCreds();
    if (stored) connect(stored);
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  // ----- Actions -----
  const postAction = useCallback(
    async (code: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/room/${code}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      return data;
    },
    []
  );

  const createRoom = useCallback(
    async (input: { name: string; config: Partial<RoomConfig> }) => {
      setError(null);
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create room');
        return;
      }
      const creds: StoredCreds = { code: data.code, playerId: data.playerId, token: data.token };
      saveCreds(creds);
      setRoom(data.room);
      setPhase(data.room.phase);
      connect(creds);
    },
    [connect]
  );

  const joinRoom = useCallback(
    async (code: string, name: string) => {
      setError(null);
      const upper = code.trim().toUpperCase();
      try {
        const data = await postAction(upper, { action: 'join', name });
        const creds: StoredCreds = { code: upper, playerId: data.playerId, token: data.token };
        saveCreds(creds);
        connect(creds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room');
      }
    },
    [connect, postAction]
  );

  const withCreds = useCallback(
    (body: Record<string, unknown>) => {
      const creds = credsRef.current;
      if (!creds) return;
      postAction(creds.code, {
        ...body,
        playerId: creds.playerId,
        token: creds.token,
      }).catch((err) => setError(err instanceof Error ? err.message : 'Action failed'));
    },
    [postAction]
  );

  const setReady = useCallback((ready: boolean) => withCreds({ action: 'ready', ready }), [withCreds]);
  const setConfig = useCallback(
    (patch: Partial<RoomConfig>) => withCreds({ action: 'config', config: patch }),
    [withCreds]
  );
  const start = useCallback(() => withCreds({ action: 'start' }), [withCreds]);
  const reportProgress = useCallback(
    (snapshot: ProgressSnapshot) => withCreds({ action: 'progress', snapshot }),
    [withCreds]
  );
  const finish = useCallback(
    (input: { finishTimeMs?: number; score: number; accuracy: number }) =>
      withCreds({ action: 'finish', ...input }),
    [withCreds]
  );

  const leave = useCallback(() => {
    withCreds({ action: 'leave' });
    esRef.current?.close();
    esRef.current = null;
    clearCreds();
    setRoom(null);
    setStandings([]);
    setResults(null);
    setPhase('lobby');
    setPlayerId(null);
  }, [withCreds]);

  const rematch = useCallback(() => {
    // Reset local race view; server keeps the room so the host can restart.
    setResults(null);
    setTimeUp(false);
    setStandings([]);
    withCreds({ action: 'ready', ready: false });
    setPhase('lobby');
  }, [withCreds]);

  const isHost = !!room && !!playerId && room.hostId === playerId;

  return {
    room,
    phase,
    playerId,
    isHost,
    standings,
    results,
    countdown,
    startAt,
    sprintSeconds,
    timeUp,
    error,
    connected,
    createRoom,
    joinRoom,
    setReady,
    setConfig,
    start,
    reportProgress,
    finish,
    leave,
    rematch,
  };
}

export type { GameMode, Difficulty };
