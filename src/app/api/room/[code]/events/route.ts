import { NextRequest } from 'next/server';
import {
  rooms,
  Room,
  ServerEvent,
  DISCONNECT_GRACE_MS,
  toRoomSnapshot,
  broadcast,
  migrateHost,
} from '@/lib/room-store';
import { reconnect, maybeFinishRace } from '@/lib/room-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 15_000;

/**
 * GET /api/room/[code]/events?playerId=&token=
 * Server-Sent Events stream. An open stream == a present player.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return new Response('Room not found', { status: 404 });
  }

  const url = new URL(request.url);
  const playerId = url.searchParams.get('playerId') ?? '';
  const token = url.searchParams.get('token') ?? '';

  const player = reconnect(room, playerId, token);
  if (!player) {
    return new Response('Invalid player credentials', { status: 403 });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const write = (event: ServerEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream already closed.
        }
      };

      // Register this connection (presence).
      room.conns.set(player.id, {
        playerId: player.id,
        send: write,
        close: () => {
          try {
            controller.close();
          } catch {
            // ignore
          }
        },
      });

      // Cancel any pending grace removal — the player is back.
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      player.disconnectedAt = undefined;

      // Send the initial snapshot.
      write({ type: 'room', room: toRoomSnapshot(room) });

      // If a race is already underway, resend start info so the client can sync.
      if (room.phase === 'racing' && room.startedAt) {
        write({
          type: 'go',
          startAt: room.startedAt,
          sprintSeconds: room.config.sprintSeconds,
        });
      }

      // Heartbeat comment to defeat proxy buffering + detect dead peers.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, HEARTBEAT_MS);
    },

    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      room.conns.delete(player.id);

      // Start the grace window before declaring the player DNF.
      const wasRacing = room.phase === 'racing' || room.phase === 'countdown';
      player.disconnectedAt = Date.now();

      graceTimer = setTimeout(() => {
        // Still disconnected after the grace window?
        if (room.conns.has(player.id)) return;

        player.status = 'dnf';
        player.updatedAt = Date.now();
        broadcast(room, {
          type: 'playerDnf',
          playerId: player.id,
          reason: 'disconnected',
        });

        // Host migration if the host was the one who dropped.
        if (player.isHost) {
          const newHost = migrateHost(room);
          if (newHost) broadcast(room, { type: 'room', room: toRoomSnapshot(room) });
        }

        if (wasRacing) {
          maybeFinishRace(room);
        } else {
          // In the lobby: remove the player entirely.
          room.players.delete(player.id);
          broadcast(room, { type: 'playerLeft', playerId: player.id });
        }

        if (room.conns.size === 0) room.emptySince = Date.now();
      }, DISCONNECT_GRACE_MS);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
