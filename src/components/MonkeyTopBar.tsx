'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Difficulty } from '@/types/lyrics';
import {
  ArrowRightIcon,
  RefreshCwIcon,
  ZapIcon,
} from '@/components/icons';

interface MonkeyTopBarProps {
  difficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
  onSubmitUrl: (urlOrQuery: string) => void;
  isLoadingSong: boolean;
  timingOffsetMs: number;
  onAdjustOffset: (deltaMs: number) => void;
  onResetOffset: () => void;
  xpEarned: number;
}

/**
 * YT Music top nav (design.md §3/§6): 64px, transparent over the wash,
 * 480px pill search with 50%-white placeholder, monochrome chips.
 * Brand red is reserved for the logo mark and the progress bar.
 */
export const MonkeyTopBar: React.FC<MonkeyTopBarProps> = ({
  difficulty,
  onSelectDifficulty,
  onSubmitUrl,
  isLoadingSong,
  timingOffsetMs,
  onAdjustOffset,
  onResetOffset,
  xpEarned,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    onSubmitUrl(searchInput.trim());
    setSearchInput('');
  };

  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

  return (
    <header className="w-full h-16 shrink-0 px-6 flex items-center justify-between gap-6 z-20 select-none">
      {/* Left: Brand + Centered Pill Search Input */}
      <div className="flex items-center gap-6 flex-1 max-w-2xl">


        {/* Global Pill Search Bar — 480px, 50%-white placeholder */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 max-w-[480px] flex items-center"
        >
          <div className="absolute left-3.5 text-white/50 pointer-events-none">
            <Search size={15} strokeWidth={2} />
          </div>
          <input
            type="text"
            placeholder="Search songs, albums, artists, or paste a YouTube link"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-[42px] pl-10 pr-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] focus:bg-white/[0.12] border border-transparent focus:border-white/30 text-white placeholder-white/50 text-sm transition-colors duration-150 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoadingSong || !searchInput.trim()}
            className="absolute right-2.5 p-1.5 rounded-full text-white/70 hover:text-white disabled:opacity-30 active:scale-[0.96] transition-transform duration-100"
            title="Search / Load"
          >
            {isLoadingSong ? (
              <RefreshCwIcon size={14} className="animate-spin text-white" />
            ) : (
              <ArrowRightIcon size={14} />
            )}
          </button>
        </form>
      </div>

      {/* Right Controls: Difficulty Pills, Sync Offset & XP — monochrome chips */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Difficulty Selector */}
        <div className="flex items-center bg-white/[0.05] border border-white/10 rounded-full p-0.5 text-xs">
          {difficulties.map((d) => {
            const isActive = difficulty === d;
            return (
              <button
                key={d}
                onClick={() => onSelectDifficulty(d)}
                className={`capitalize px-3 py-1 rounded-full text-xs transition-colors duration-150 active:scale-[0.96] ${
                  isActive
                    ? 'bg-white text-black font-semibold'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Timing Offset Sync Pill */}
        <div className="hidden lg:flex items-center bg-white/[0.05] border border-white/10 rounded-full p-0.5 text-xs">
          <button
            onClick={() => onAdjustOffset(-500)}
            className="px-2.5 py-1 rounded-full text-white/50 hover:text-white active:scale-[0.96] transition-all text-xs"
            title="Delay lyrics (-0.5s)"
          >
            -0.5s
          </button>
          <button
            onClick={onResetOffset}
            className="px-2.5 py-1 font-medium text-white hover:bg-white/[0.06] rounded-full transition-all text-xs"
            title="Reset timing offset"
          >
            Sync {timingOffsetMs !== 0 ? `${(timingOffsetMs / 1000).toFixed(1)}s` : '0s'}
          </button>
          <button
            onClick={() => onAdjustOffset(500)}
            className="px-2.5 py-1 rounded-full text-white/50 hover:text-white active:scale-[0.96] transition-all text-xs"
            title="Advance lyrics (+0.5s)"
          >
            +0.5s
          </button>
        </div>

        {/* User XP Streak Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-medium text-white">
          <ZapIcon size={14} className="text-white/70" />
          <span className="tabular-nums text-white/90">+{xpEarned} XP</span>
        </div>
      </div>
    </header>
  );
};
