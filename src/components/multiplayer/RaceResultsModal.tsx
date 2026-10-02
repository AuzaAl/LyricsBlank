'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { PartyPopperIcon, RotateCcwIcon, ArrowRightIcon } from '@/components/icons';
import type { Standing } from '@/lib/room-store';
import type { GameMode } from '@/lib/scoring';

interface RaceResultsModalProps {
  isOpen: boolean;
  standings: Standing[];
  playerId: string | null;
  mode: GameMode;
  onRematch: () => void;
  onLeave: () => void;
}

function formatTime(ms?: number): string {
  if (ms === undefined) return '—';
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  isOpen,
  standings,
  playerId,
  mode,
  onRematch,
  onLeave,
}) => {
  const winner = standings[0];

  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f03', '#3ea6ff', '#4ade80', '#ffffff'],
        });
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const iWon = winner?.playerId === playerId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-[20px] ytm-frosted border border-white/10 p-6 sm:p-8 shadow-2xl shadow-black">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-3xl bg-ytm-brand/15 text-ytm-brand border border-ytm-brand/20">
            <PartyPopperIcon size={40} />
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-white tracking-tight text-center">
          {iWon ? 'You win!' : winner ? `${winner.name} wins!` : 'Race Over'}
        </h2>

        <div className="mt-6 space-y-2">
          <div className="grid grid-cols-[28px_1fr_auto_auto] gap-3 px-3 text-[10px] uppercase tracking-wider text-white/40">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">{mode === 'classic' ? 'Time' : 'Score'}</span>
            <span className="text-right">Acc</span>
          </div>
          {standings.map((s) => {
            const isMe = s.playerId === playerId;
            return (
              <div
                key={s.playerId}
                className={`grid grid-cols-[28px_1fr_auto_auto] gap-3 items-center px-3 py-2.5 rounded-xl border ${
                  isMe
                    ? 'bg-white/[0.08] border-white/20'
                    : 'bg-white/[0.03] border-white/[0.06]'
                }`}
              >
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    s.rank === 1 ? 'text-ytm-brand' : 'text-white/50'
                  }`}
                >
                  {s.rank}
                </span>
                <span className={`text-sm truncate ${isMe ? 'text-white font-semibold' : 'text-white/80'}`}>
                  {s.name}
                  {isMe && <span className="text-white/40"> (you)</span>}
                  {s.status === 'dnf' && <span className="text-red-400 text-xs"> · DNF</span>}
                </span>
                <span className="text-sm text-white tabular-nums text-right">
                  {mode === 'classic' ? formatTime(s.finishTimeMs) : s.score}
                </span>
                <span className="text-sm text-white/60 tabular-nums text-right">
                  {Math.round(s.accuracy * 100)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={onRematch}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-white text-black font-medium text-sm hover:scale-[1.01] transition-transform"
          >
            <RotateCcwIcon size={16} />
            <span>Back to Lobby</span>
          </button>
          <button
            onClick={onLeave}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/10 text-sm font-medium transition-all"
          >
            <ArrowRightIcon size={16} />
            <span>Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
};
