import { NextRequest, NextResponse } from 'next/server';
import { rooms, ProgressSnapshot, EMPTY_PROGRESS, broadcast, toPublicPlayer } from '@/lib/room-store';
import {
  joinRoom,
  startRace,
  updateProgress,
  finishPlayer,
  leaveRoom,
  setReady,
  updateConfig,
} from '@/lib/room-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/room/[code]/action
 * Body: { action: 'join'|'ready'|'progress'|'finish'|'start'|'leave', ... }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;

  try {
    // ---- join: no player identity yet ----
    if (action === 'join') {
      const res = joinRoom(room, { name: String(body.name ?? 'Player').slice(0, 24) });
      if (!res.ok || !res.player) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      // Notify existing players so their lobby lists update live.
      broadcast(room, { type: 'playerJoined', player: toPublicPlayer(res.player) });
      return NextResponse.json({
        ok: true,
        playerId: res.player.id,
        token: res.player.token,
      });
    }

    // ---- all other actions require playerId + token ----
    const playerId = String(body.playerId ?? '');
    const token = String(body.token ?? '');
    const player = room.players.get(playerId);
    if (!player || player.token !== token) {
      return NextResponse.json({ error: 'Invalid player credentials' }, { status: 403 });
    }

    switch (action) {
      case 'ready': {
        setReady(room, player, Boolean(body.ready));
        return NextResponse.json({ ok: true });
      }
      case 'start': {
        const res = startRace(room, player);
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      case 'config': {
        const res = updateConfig(room, player, body.config ?? {});
        return NextResponse.json(res, { status: res.ok ? 200 : 400 });
      }
      case 'progress': {
        const snapshot: ProgressSnapshot = {
          ...EMPTY_PROGRESS,
          ...(body.snapshot ?? {}),
        };
        updateProgress(room, player, snapshot);
        return NextResponse.json({ ok: true });
      }
      case 'finish': {
        finishPlayer(room, player, {
          finishTimeMs: typeof body.finishTimeMs === 'number' ? body.finishTimeMs : undefined,
          score: Number(body.score ?? 0),
          accuracy: Number(body.accuracy ?? 1),
        });
        return NextResponse.json({ ok: true });
      }
      case 'leave': {
        leaveRoom(room, player);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
