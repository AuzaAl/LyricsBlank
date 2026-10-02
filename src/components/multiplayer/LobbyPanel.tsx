'use client';

import React, { useState } from 'react';
import {
  CircleCheckIcon,
  RefreshCwIcon,
  PlayIcon,
  SparklesIcon,
} from '@/components/icons';
import type { RoomSnapshot, RoomConfig } from '@/lib/room-store';
import type { Difficulty } from '@/types/lyrics';
import type { GameMode } from '@/lib/scoring';

interface LobbyPanelProps {
  room: RoomSnapshot;
  playerId: string | null;
  isHost: boolean;
  onSetReady: (ready: boolean) => void;
  onSetConfig: (patch: Partial<RoomConfig>) => void;
  onStart: () => void;
  onLeave: () => void;
  /** Host-only: load a song by YouTube URL / ID. */
  onLoadSong: (queryOrUrl: string) => void;
  isLoadingSong: boolean;
}

const MODE_LABEL: Record<GameMode, string> = {
  classic: 'Classic Race',
  flow: 'Flow Race',
  sprint: 'Sprint',
};

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
const SPRINT_OPTIONS = [30, 60, 90];

export const LobbyPanel: React.FC<LobbyPanelProps> = ({
  room,
  playerId,
  isHost,
  onSetReady,
  onSetConfig,
  onStart,
  onLeave,
  onLoadSong,
  isLoadingSong,
}) => {
  const [copied, setCopied] = useState(false);
  const [songInput, setSongInput] = useState('');

  const me = room.players.find((p) => p.id === playerId);
  const allReady =
    room.players.length > 0 && room.players.every((p) => p.ready || p.status === 'ready');

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${room.code}`
      : `/?room=${room.code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const songReady = !!room.config.song?.videoId;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto scrollbar-none">
      <div className="w-full max-w-2xl ytm-frosted rounded-[20px] border border-white/10 shadow-2xl shadow-black/60 p-6 sm:p-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40">Room Code</div>
            <div className="text-3xl font-semibold text-white tracking-[0.3em] mt-1">
              {room.code}
            </div>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white transition-all"
          >
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </button>
        </div>

        {/* Config summary */}
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80">
            {MODE_LABEL[room.config.mode]}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 capitalize">
            {room.config.difficulty}
          </span>
          {room.config.mode === 'sprint' && room.config.sprintSeconds && (
            <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80">
              {room.config.sprintSeconds}s
            </span>
          )}
          {songReady && (
            <span className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 truncate max-w-[240px]">
              🎵 {room.config.song.title}
              {room.config.song.artist ? ` — ${room.config.song.artist}` : ''}
            </span>
          )}
          {!songReady && (
            <span className="px-3 py-1.5 rounded-full bg-ytm-brand/15 border border-ytm-brand/30 text-white/90">
              Song not set
            </span>
          )}
        </div>

        {/* Host: song picker */}
        {isHost && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!songInput.trim()) return;
              onLoadSong(songInput.trim());
              setSongInput('');
            }}
            className="mb-4 flex items-center gap-2"
          >
            <input
              type="text"
              value={songInput}
              onChange={(e) => setSongInput(e.target.value)}
              placeholder="Paste a YouTube link or ID to set the song…"
              disabled={isLoadingSong}
              className="flex-1 h-11 px-4 rounded-xl bg-white/[0.06] border border-transparent focus:border-white/30 text-white placeholder-white/40 text-sm transition-colors focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoadingSong || !songInput.trim()}
              className="h-11 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white text-sm font-medium transition-all disabled:opacity-40"
            >
              {isLoadingSong ? 'Loading…' : 'Load'}
            </button>
          </form>
        )}

        {/* Host config controls */}
        {isHost && (
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
              <SparklesIcon size={13} /> Host Settings
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['classic', 'flow', 'sprint'] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onSetConfig({ mode: m })}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    room.config.mode === m
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.05] text-white/60 hover:text-white'
                  }`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => onSetConfig({ difficulty: d })}
                  className={`capitalize px-3 py-1.5 rounded-full text-xs transition-colors ${
                    room.config.difficulty === d
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.05] text-white/60 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {room.config.mode === 'sprint' && (
              <div className="flex flex-wrap items-center gap-2">
                {SPRINT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSetConfig({ sprintSeconds: s })}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      room.config.sprintSeconds === s
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/[0.05] text-white/60 hover:text-white'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Player list */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
            Players ({room.players.length}/8)
          </div>
          <div className="space-y-2">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm text-white font-medium">
                    {p.name}
                    {p.id === playerId && <span className="text-white/40"> (you)</span>}
                  </span>
                  {p.isHost && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-ytm-brand/20 text-white/90">
                      HOST
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {p.ready || p.status === 'ready' ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CircleCheckIcon size={14} /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-white/40">
                      <RefreshCwIcon size={13} className="animate-spin" /> Loading…
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onSetReady(!(me?.ready || me?.status === 'ready'))}
            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-full font-medium text-sm transition-all ${
              me?.ready || me?.status === 'ready'
                ? 'bg-white/[0.08] text-white border border-white/20'
                : 'bg-white text-black hover:scale-[1.01]'
            }`}
          >
            {me?.ready || me?.status === 'ready' ? 'Cancel Ready' : 'Ready Up'}
          </button>

          {isHost && (
            <button
              onClick={onStart}
              disabled={!allReady || !songReady}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-ytm-brand text-white font-medium text-sm hover:scale-[1.01] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlayIcon size={16} />
              <span>Start Race</span>
            </button>
          )}
        </div>

        {isHost && !songReady && (
          <p className="text-xs text-white/40 mt-3 text-center">
            Paste a YouTube link above to set the song before starting.
          </p>
        )}

        <button
          onClick={onLeave}
          className="w-full mt-3 text-xs text-white/40 hover:text-white/70 transition-colors py-2"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};
