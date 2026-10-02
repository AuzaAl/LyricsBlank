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
  const [multiplayer, setMultiplayer] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomCode(room.trim().toUpperCase());
      setMultiplayer(true);
    } else if (params.get('mp')) {
      // "Play with friends" entry: open the create/join modal, no room yet.
      setMultiplayer(true);
    }
  }, []);

  if (multiplayer) {
    return (
      <MultiplayerShell
        initialRoomCode={roomCode}
        onExit={() => {
          setMultiplayer(false);
          setRoomCode(null);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  return (
    <SoloShell
      onOpenMultiplayer={() => {
        setMultiplayer(true);
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', `${window.location.pathname}?mp=1`);
        }
      }}
    />
  );
}
