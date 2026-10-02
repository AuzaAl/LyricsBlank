import {
  Room,
  Player,
  ServerEvent,
  RoomConfig,
  ProgressSnapshot,
  EMPTY_PROGRESS,
  MAX_PLAYERS,
  COUNTDOWN_SECONDS,
  createPlayer,
  generateRoomCode,
  generateToken,
  broadcast,
  sendTo,
  toRoomSnapshot,
  toPublicPlayer,
  computeStandings,
  migrateHost,
  gcRooms,
} from '@/lib/room-store';
import { rooms } from '@/lib/room-store';

export interface ActionContext {
  room: Room;
  player: Player;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Extra payload returned to the caller (e.g. on join). */
  data?: Record<string, unknown>;
}

const VALID_MODES = new Set(['classic', 'flow', 'sprint']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'expert']);

// ---------- Create ----------

export function createRoom(input: {
  name: string;
  config: Partial<RoomConfig>;
}): { room: Room; player: Player } {
  gcRooms();

  const mode = (input.config?.mode ?? 'classic') as RoomConfig['mode'];
  const difficulty = (input.config?.difficulty ?? 'medium') as RoomConfig['difficulty'];

  const code = generateRoomCode();
  const playerId = `p-${generateToken().slice(0, 10)}`;

  const room: Room = {
    code,
    phase: 'lobby',
    config: {
      mode: VALID_MODES.has(mode) ? mode : 'classic',
      difficulty: VALID_DIFFICULTIES.has(difficulty) ? difficulty : 'medium',
      song: input.config?.song ?? { videoId: '', title: '', artist: '' },
      accuracyGate: input.config?.accuracyGate ?? 0.8,
      sprintSeconds: input.config?.sprintSeconds,
    },
    hostId: playerId,
    players: new Map(),
    conns: new Map(),
    createdAt: Date.now(),
  };

  const player = createPlayer(playerId, input.name || 'Host', true);
  room.players.set(playerId, player);
  rooms.set(code, room);

  return { room, player };
}

// ---------- Join ----------

export function joinRoom(
  room: Room,
  input: { name: string }
): ActionResult & { player?: Player } {
  if (room.phase !== 'lobby') {
    return { ok: false, error: 'Race already started — room is closed.' };
  }
  if (room.players.size >= MAX_PLAYERS) {
    return { ok: false, error: `Room is full (max ${MAX_PLAYERS}).` };
  }

  const playerId = `p-${generateToken().slice(0, 10)}`;
  const player = createPlayer(playerId, input.name || 'Player', false);
  room.players.set(playerId, player);
  return { ok: true, player };
}

// ---------- Reconnect ----------

export function reconnect(
  room: Room,
  playerId: string,
  token: string
): Player | null {
  const player = room.players.get(playerId);
  if (!player || player.token !== token) return null;
  player.status = room.phase === 'racing' ? 'racing' : player.status;
  player.disconnectedAt = undefined;
  player.updatedAt = Date.now();
  return player;
}

// ---------- Start (host only) ----------

export function startRace(room: Room, player: Player): ActionResult {
  if (!player.isHost) return { ok: false, error: 'Only the host can start.' };
  if (room.phase !== 'lobby') return { ok: false, error: 'Race already started.' };

  const allReady = Array.from(room.players.values()).every(
    (p) => p.status !== 'disconnected' && p.ready
  );
  if (!allReady) return { ok: false, error: 'All players must be ready.' };

  room.phase = 'countdown';
  broadcast(room, { type: 'countdown', seconds: COUNTDOWN_SECONDS });

  // Server-side countdown → GO.
  setTimeout(() => beginRace(room), COUNTDOWN_SECONDS * 1000);
  return { ok: true };
}

/** Called after the countdown elapses (server-side timer). */
export function beginRace(room: Room): void {
  if (room.phase !== 'countdown') return;
  room.phase = 'racing';
  room.startedAt = Date.now();
  if (room.config.mode === 'sprint' && room.config.sprintSeconds) {
    room.sprintEndsAt = room.startedAt + room.config.sprintSeconds * 1000;
    // Server-authoritative sprint timer.
    const sprintMs = room.config.sprintSeconds * 1000;
    setTimeout(() => {
      if (room.phase !== 'racing') return;
      broadcast(room, { type: 'timeUp' });
      endRace(room);
    }, sprintMs);
  }
  for (const p of room.players.values()) {
    if (p.status !== 'disconnected') p.status = 'racing';
  }
  broadcast(room, {
    type: 'go',
    startAt: room.startedAt,
    sprintSeconds: room.config.sprintSeconds,
  });
}

// ---------- Progress / finish ----------

export function updateProgress(
  room: Room,
  player: Player,
  snapshot: ProgressSnapshot
): void {
  if (room.phase !== 'racing') return;
  player.progress = { ...EMPTY_PROGRESS, ...snapshot };
  player.updatedAt = Date.now();
  broadcast(room, { type: 'standings', standings: computeStandings(room) });
}

export function finishPlayer(
  room: Room,
  player: Player,
  input: { finishTimeMs?: number; score: number; accuracy: number }
): void {
  player.status = 'finished';
  player.finishTimeMs = input.finishTimeMs;
  player.progress = { ...player.progress, score: input.score, accuracy: input.accuracy };
  player.updatedAt = Date.now();

  broadcast(room, {
    type: 'playerFinished',
    playerId: player.id,
    finishTimeMs: input.finishTimeMs,
    score: input.score,
  });
  broadcast(room, { type: 'standings', standings: computeStandings(room) });

  maybeFinishRace(room);
}

/** End the race once everyone is finished (or timed out / dnf). */
export function maybeFinishRace(room: Room): void {
  if (room.phase !== 'racing') return;
  const active = Array.from(room.players.values()).filter((p) => p.status !== 'dnf');
  const allDone = active.every((p) => p.status === 'finished');
  if (allDone && active.length > 0) {
    endRace(room);
  }
}

export function endRace(room: Room): void {
  if (room.phase === 'finished') return;
  room.phase = 'finished';
  broadcast(room, { type: 'results', standings: computeStandings(room) });
}

// ---------- Leave ----------

export function leaveRoom(room: Room, player: Player): void {
  room.players.delete(player.id);
  room.conns.delete(player.id);
  broadcast(room, { type: 'playerLeft', playerId: player.id });

  if (player.isHost) {
    const newHost = migrateHost(room);
    if (newHost) {
      broadcast(room, { type: 'room', room: toRoomSnapshot(room) });
    } else {
      // No one left online — room will be GC'd.
      room.emptySince = Date.now();
    }
  }

  if (room.players.size === 0) {
    room.emptySince = Date.now();
  }
}

// ---------- Ready ----------

export function setReady(room: Room, player: Player, ready: boolean): void {
  player.ready = ready;
  player.status = ready ? 'ready' : 'connected';
  player.updatedAt = Date.now();
  broadcast(room, { type: 'playerReady', playerId: player.id, ready });
}

// ---------- Config (host only) ----------

export function updateConfig(
  room: Room,
  player: Player,
  patch: Partial<RoomConfig>
): ActionResult {
  if (!player.isHost) return { ok: false, error: 'Only the host can change settings.' };
  if (room.phase !== 'lobby') return { ok: false, error: 'Race already started.' };

  if (patch.mode && VALID_MODES.has(patch.mode)) room.config.mode = patch.mode;
  if (patch.difficulty && VALID_DIFFICULTIES.has(patch.difficulty)) {
    room.config.difficulty = patch.difficulty;
  }
  if (patch.song) room.config.song = patch.song;
  if (typeof patch.accuracyGate === 'number') room.config.accuracyGate = patch.accuracyGate;
  if (typeof patch.sprintSeconds === 'number') room.config.sprintSeconds = patch.sprintSeconds;

  broadcast(room, { type: 'room', room: toRoomSnapshot(room) });
  return { ok: true };
}

export { broadcast, sendTo, toRoomSnapshot, toPublicPlayer, generateToken };
