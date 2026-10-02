'use client';

import React from 'react';
import type { Standing } from '@/lib/room-store';
import type { GameMode } from '@/lib/scoring';

interface RaceScoreboardProps {
  standings: Standing[];
  playerId: string | null;
  mode: GameMode;
  /** Running clock in ms (classic), or remaining ms (sprint). */
  clockMs?: number;
  clockLabel?: string;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Top-strip live scoreboard. Progress bars animate via CSS transitions; the
 * list is keyed by playerId so rows are NOT re-mounted on each update.
 */
export const RaceScoreboard: React.FC<RaceScoreboardProps> = ({
  standings,
  playerId,
  mode,
  clockMs,
  clockLabel,
}) => {
  return (
    <div className="w-full max-w-[1700px] mx-auto px-6 lg:px-12 xl:px-16 pt-2 shrink-0">
      <div className="rounded-2xl ytm-frosted border border-white/10 px-4 py-2.5 flex items-center gap-4 overflow-x-auto scrollbar-none">
        {clockMs !== undefined && (
          <div className="shrink-0 flex flex-col items-center pr-3 border-r border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              {clockLabel ?? 'Time'}
            </span>
            <span className="text-lg font-semibold text-white tabular-nums">
              {formatTime(clockMs)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 min-w-0">
          {standings.map((s) => {
            const isMe = s.playerId === playerId;
            const pct = s.totalLines > 0 ? ((s.lineIndex + 1) / s.totalLines) * 100 : 0;
            return (
              <div key={s.playerId} className="flex items-center gap-2 shrink-0 min-w-[150px]">
                <span
                  className={`text-xs font-semibold tabular-nums w-4 text-center ${
                    s.rank === 1 ? 'text-ytm-brand' : 'text-white/50'
                  }`}
                >
                  {s.rank}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs truncate max-w-[90px] ${
                        isMe ? 'text-white font-semibold' : 'text-white/70'
                      }`}
                    >
                      {s.name}
                    </span>
                    <span className="text-[10px] text-white/40 tabular-nums">{s.score}</span>
                  </div>
                  <div className="w-[110px] h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isMe ? 'bg-ytm-brand' : 'bg-white/50'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {s.status === 'finished' && (
                  <span className="text-[10px] text-emerald-400 shrink-0">✓</span>
                )}
                {s.status === 'dnf' && (
                  <span className="text-[10px] text-red-400 shrink-0">DNF</span>
                )}
              </div>
            );
          })}
        </div>

        {mode === 'classic' && (
          <span className="ml-auto shrink-0 text-[10px] text-white/40 uppercase tracking-wider">
            First to finish
          </span>
        )}
      </div>
    </div>
  );
};
