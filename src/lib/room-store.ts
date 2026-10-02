import {
  Difficulty,
} from '@/types/lyrics';
import type { GameMode } from '@/lib/scoring';

/**
 * In-memory multiplayer room store.
 *
 * ⚠️ Process-local. This works only when self-hosted as a single long-lived Node
 * process (npm start / Docker / Fly / Railway). It does NOT work on Vercel
 * serverless, where each invocation has its own memory.
 *
 * The Map lives on globalThis so it survives Next.js HMR during dev.
 */

export type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'finished';
export type PlayerStatus =
  | 'connected'
  | 'ready'
  | 'racing'
  | 'finished'
  | 'dnf'
  | 'disconnected';

export interface RoomConfig {
  mode: GameMode;
  difficulty: Difficulty;
  song: { videoId: string; title: string; artist: string };
  accuracyGate: number;
  sprintSeconds?: number;
}

export interface ProgressSnapshot {
  lineIndex: number;
  totalLines: number;
  blanksDone: number;
  correct: number;
  wrong: number;
  hints: number;
  skips: number;
  combo: number;
  score: number;
  accuracy: number;
  activeTimeMs: number;
}

export const EMPTY_PROGRESS: ProgressSnapshot = {
  lineIndex: 0,
  totalLines: 0,
  blanksDone: 0,
  correct: 0,
  wrong: 0,
  hints: 0,
  skips: 0,
  combo: 0,
  score: 0,
  accuracy: 1,
  activeTimeMs: 0,
};

export interface Player {
  id: string;
  token: string;
  name: string;
  isHost: boolean;
  status: PlayerStatus;
  ready: boolean;
  progress: ProgressSnapshot;
  finishTimeMs?: number;
  updatedAt: number;
  /** epoch ms when the player most recently went offline; undefined if online */
  disconnectedAt?: number;
}

export interface RoomConnection {
  playerId: string;
  send: (event: ServerEvent) => void;
  close: () => void;
}

export interface Room {
  code: string;
  phase: RoomPhase;
  config: RoomConfig;
  hostId: string;
  players: Map<string, Player>;
  conns: Map<string, RoomConnection>;
  createdAt: number;
  startedAt?: number;
  sprintEndsAt?: number;
  emptySince?: number;
}

// ---------- Server → client events ----------

export type ServerEvent =
  | { type: 'room'; room: RoomSnapshot }
  | { type: 'playerJoined'; player: PublicPlayer }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerReady'; playerId: string; ready: boolean }
  | { type: 'countdown'; seconds: number }
  | { type: 'go'; startAt: number; sprintSeconds?: number }
  | { type: 'standings'; standings: Standing[] }
  | { type: 'playerFinished'; playerId: string; finishTimeMs?: number; score: number }
  | { type: 'playerDnf'; playerId: string; reason: string }
  | { type: 'timeUp' }
  | { type: 'results'; standings: Standing[] }
  | { type: 'error'; message: string };

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  status: PlayerStatus;
  ready: boolean;
  progress: ProgressSnapshot;
  finishTimeMs?: number;
}

export interface Standing {
  playerId: string;
  name: string;
  score: number;
  accuracy: number;
  lineIndex: number;
  totalLines: number;
  finishTimeMs?: number;
  status: PlayerStatus;
  rank: number;
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  config: RoomConfig;
  hostId: string;
  players: PublicPlayer[];
  startedAt?: number;
  sprintEndsAt?: number;
}

// ---------- Constants ----------

export const MAX_PLAYERS = 8;
export const DISCONNECT_GRACE_MS = 10_000;
export const ROOM_TTL_MS = 5 * 60 * 1000;
export const COUNTDOWN_SECONDS = 3;

// ---------- Store ----------

const globalStore = globalThis as unknown as { __rooms?: Map<string, Room> };
if (!globalStore.__rooms) {
  globalStore.__rooms = new Map<string, Room>();
}
export const rooms: Map<string, Room> = globalStore.__rooms;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}

export function generateToken(): string {
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );
}

export function createPlayer(id: string, name: string, isHost: boolean): Player {
  return {
    id,
    token: generateToken(),
    name,
    isHost,
    status: 'connected',
    ready: false,
    progress: { ...EMPTY_PROGRESS },
    updatedAt: Date.now(),
  };
}

export function toPublicPlayer(p: Player): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    status: p.status,
    ready: p.ready,
    progress: p.progress,
    finishTimeMs: p.finishTimeMs,
  };
}

export function toRoomSnapshot(room: Room): RoomSnapshot {
  return {
    code: room.code,
    phase: room.phase,
    config: room.config,
    hostId: room.hostId,
    players: Array.from(room.players.values()).map(toPublicPlayer),
    startedAt: room.startedAt,
    sprintEndsAt: room.sprintEndsAt,
  };
}

/** Broadcast an event to every connected player in a room. */
export function broadcast(room: Room, event: ServerEvent): void {
  for (const conn of room.conns.values()) {
    try {
      conn.send(event);
    } catch {
      // Dead connection; cleanup handled by disconnect detection.
    }
  }
}

export function sendTo(room: Room, playerId: string, event: ServerEvent): void {
  const conn = room.conns.get(playerId);
  if (!conn) return;
  try {
    conn.send(event);
  } catch {
    // ignore
  }
}

/** Compute live standings for a room. */
export function computeStandings(room: Room): Standing[] {
  const list = Array.from(room.players.values()).map((p) => ({
    playerId: p.id,
    name: p.name,
    score: p.progress.score,
    accuracy: p.progress.accuracy,
    lineIndex: p.progress.lineIndex,
    totalLines: p.progress.totalLines,
    finishTimeMs: p.finishTimeMs,
    status: p.status,
    rank: 0,
  }));

  const mode = room.config.mode;
  list.sort((a, b) => {
    if (mode === 'classic') {
      // Finishers by finish time, then everyone else by score.
      const aFin = a.finishTimeMs;
      const bFin = b.finishTimeMs;
      if (aFin !== undefined && bFin !== undefined) return aFin - bFin;
      if (aFin !== undefined) return -1;
      if (bFin !== undefined) return 1;
      return b.score - a.score || b.accuracy - a.accuracy;
    }
    // score ↓ → accuracy ↓ → faster finish ↑
    if (b.score !== a.score) return b.score - a.score;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    const at = a.finishTimeMs ?? Number.MAX_SAFE_INTEGER;
    const bt = b.finishTimeMs ?? Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  list.forEach((s, i) => (s.rank = i + 1));
  return list;
}

/**
 * Promote the longest-connected online player to host. Returns the new host id,
 * or null if no online players remain.
 */
export function migrateHost(room: Room): string | null {
  const candidates = Array.from(room.players.values())
    .filter((p) => p.status !== 'disconnected' && room.conns.has(p.id))
    .sort((a, b) => a.updatedAt - b.updatedAt);

  if (candidates.length === 0) return null;

  for (const p of room.players.values()) p.isHost = false;
  const newHost = candidates[0];
  newHost.isHost = true;
  room.hostId = newHost.id;
  return newHost.id;
}

/** Remove empty rooms past their TTL. */
export function gcRooms(): void {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const hasConns = room.conns.size > 0;
    if (!hasConns) {
      room.emptySince = room.emptySince ?? now;
      if (now - room.emptySince > ROOM_TTL_MS) rooms.delete(code);
    } else {
      room.emptySince = undefined;
    }
  }
}
