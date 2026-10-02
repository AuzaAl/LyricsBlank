'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { PracticeStats } from '@/types/lyrics';
import {
  PartyPopperIcon,
  SparklesIcon,
  ZapIcon,
  RotateCcwIcon,
  ArrowRightIcon,
  XIcon,
} from '@/components/icons';

interface LessonCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PracticeStats;
  onPlayAgain: () => void;
  onChangeSong: () => void;
  songTitle: string;
  artist: string;
}

export const LessonCompleteModal: React.FC<LessonCompleteModalProps> = ({
  isOpen,
  onClose,
  stats,
  onPlayAgain,
  onChangeSong,
  songTitle,
  artist,
}) => {
  useEffect(() => {
    if (isOpen) {
      // Launch celebratory confetti burst
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#e2b714', '#00f0ff', '#4ade80', '#ffffff'],
        });
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in font-mono select-none">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-3xl p-6 sm:p-8 shadow-2xl shadow-black text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-monkey-sub hover:text-white hover:bg-white/5 transition-all"
        >
          <XIcon size={20} />
        </button>

        {/* Celebration Header */}
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-3xl bg-monkey-main/15 text-monkey-main border border-monkey-main/20 ring-4 ring-monkey-main/10 shadow-lg shadow-monkey-main/20">
            <PartyPopperIcon size={40} />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-wide">Lesson Completed!</h2>
        <p className="text-xs text-monkey-sub mt-1">
          {songTitle} — {artist}
        </p>

        {/* Big Score Card */}
        <div className="my-6 p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-wider text-monkey-sub">Accuracy</span>
            <span
              className={`text-3xl font-extrabold mt-1 ${
                stats.accuracy >= 90
                  ? 'text-monkey-green'
                  : stats.accuracy >= 70
                  ? 'text-monkey-main'
                  : 'text-white'
              }`}
            >
              {stats.accuracy}%
            </span>
          </div>

          <div className="w-px h-10 bg-white/10" />

          <div className="flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-wider text-monkey-sub">XP Earned</span>
            <div className="flex items-center gap-1.5 mt-1 text-monkey-main">
              <ZapIcon size={24} className="text-monkey-main" />
              <span className="text-3xl font-extrabold">+{stats.xpEarned}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-xs">
          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
            <div className="text-monkey-sub text-[10px]">CORRECT</div>
            <div className="text-monkey-green font-bold text-base mt-0.5">
              {stats.correctCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
            <div className="text-monkey-sub text-[10px]">MISSED / SKIPPED</div>
            <div className="text-red-400 font-bold text-base mt-0.5">
              {stats.incorrectCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
            <div className="text-monkey-sub text-[10px]">HINTS USED</div>
            <div className="text-monkey-cyan font-bold text-base mt-0.5">
              {stats.hintsUsed}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              onClose();
              onPlayAgain();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-monkey-main hover:bg-yellow-400 text-black font-bold text-sm transition-all shadow-lg shadow-monkey-main/20"
          >
            <RotateCcwIcon size={18} />
            <span>Play Again</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onChangeSong();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/10 text-sm font-semibold transition-all"
          >
            <SparklesIcon size={18} />
            <span>Try Another Song</span>
          </button>
        </div>
      </div>
    </div>
  );
};
