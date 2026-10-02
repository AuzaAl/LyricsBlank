import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/room-service';
import { toRoomSnapshot } from '@/lib/room-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room, player } = createRoom({
      name: typeof body.name === 'string' ? body.name.slice(0, 24) : 'Host',
      config: body.config ?? {},
    });

    return NextResponse.json({
      code: room.code,
      playerId: player.id,
      token: player.token,
      room: toRoomSnapshot(room),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
