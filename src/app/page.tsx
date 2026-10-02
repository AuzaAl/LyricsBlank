'use client';

import React, { useEffect, useState } from 'react';
import { SoloShell } from '@/components/shell/SoloShell';
import { MultiplayerShell } from '@/components/shell/MultiplayerShell';

/**
 * Thin router. Solo is the default; a `?room=CODE` query (from a shared invite
 * link) routes into the multiplayer shell.
 */
export default function Home() {
  const [roomCode, setRoomCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setRoomCode(room.trim().toUpperCase());
  }, []);

  if (roomCode) {
    return (
      <MultiplayerShell
        initialRoomCode={roomCode}
        onExit={() => {
          setRoomCode(null);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  return <SoloShell />;
}
