'use client';

import React from 'react';
import {
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  VolumeIcon,
  GaugeIcon,
  ZapIcon,
} from '@/components/icons';
import { PracticeStats, SongMetadata } from '@/types/lyrics';

interface PlayerBottomBarProps {
  metadata: SongMetadata;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReplayLine: () => void;
  currentTimeMs: number;
  durationMs: number;
  onSeek: (seconds: number) => void;
  playbackRate: number;
  onCyclePlaybackRate: () => void;
  stats: PracticeStats;
  autoPause: boolean;
  onToggleAutoPause: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

/**
 * YT Music player bar (design.md §3/§6): fixed 72px, frosted with
 * backdrop blur(25px), red (#f03) hairline progress pinned to the top,
 * controls inked at rgba(255,255,255,0.7).
 */
export const PlayerBottomBar: React.FC<PlayerBottomBarProps> = ({
  metadata,
  isPlaying,
  onTogglePlay,
  onReplayLine,
  currentTimeMs,
  durationMs,
  onSeek,
  playbackRate,
  onCyclePlaybackRate,
  stats,
  autoPause,
  onToggleAutoPause,
  soundOn,
  onToggleSound,
}) => {
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <footer className="relative w-full h-[72px] shrink-0 px-6 flex flex-col justify-center ytm-frosted z-30 select-none">
      {/* Top red hairline scrubber — brand red lives here only */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] group cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = (e.clientX - rect.left) / rect.width;
          if (durationMs > 0) {
            onSeek((pos * durationMs) / 1000);
          }
        }}
      >
        {/* Track */}
        <div className="absolute inset-0 bg-white/[0.2]" />
        {/* Buffered / played fill */}
        <div
          className="absolute top-0 left-0 bottom-0 bg-ytm-brand group-hover:bg-[#ff3355] transition-colors"
          style={{ width: `${progressPercent}%` }}
        />
        {/* Knob appears on hover — YTM behavior */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 bg-ytm-brand rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Left: Thumbnail & Song Info — 16px/500 title, white/50 artist */}
        <div className="flex items-center gap-3 min-w-[200px] max-w-[300px]">
          <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-black/50 shrink-0 border border-white/10 shadow-md">
            <img
              src={metadata.thumbnailUrl}
              alt={metadata.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-medium text-white truncate tracking-tight leading-tight">
              {metadata.title || 'Paradise'}
            </h4>
            <p className="text-xs text-white/50 truncate font-normal mt-0.5">
              {metadata.artist || 'Coldplay'}
            </p>
          </div>
        </div>

        {/* Center: Playback Transport Controls — ink white/70 */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onReplayLine}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/[0.05] active:scale-[0.96] transition-all text-xs font-medium"
            title="Replay Line (Tab)"
          >
            <RotateCcwIcon size={15} />
            <span className="hidden sm:inline">Replay</span>
          </button>

          {/* White Circular Play Button (BiniLyrics blyrics-fs-play language) */}
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-[0.96] transition-transform shadow-lg shadow-black/40 flex items-center justify-center shrink-0"
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <PauseIcon size={18} className="text-black" />
            ) : (
              <PlayIcon size={18} className="text-black ml-0.5" />
            )}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-white/50 tabular-nums font-medium ml-1">
            <span className="text-white/80">{formatTime(currentTimeMs)}</span>
            <span>/</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </div>

        {/* Right: Controls & Accuracy — monochrome chips */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Speed Toggle */}
          <button
            onClick={onCyclePlaybackRate}
            className="px-2.5 py-1 rounded-full text-white/70 hover:text-white hover:bg-white/[0.05] active:scale-[0.96] transition-all text-xs flex items-center gap-1 font-medium"
            title="Playback Speed"
          >
            <GaugeIcon size={13} />
            <span>{playbackRate}x</span>
          </button>

          {/* Auto Pause Toggle */}
          <button
            onClick={onToggleAutoPause}
            className={`px-3 py-1 rounded-full text-xs border active:scale-[0.96] transition-all font-medium ${
              autoPause
                ? 'bg-white/[0.1] text-white border-white/20'
                : 'bg-transparent text-white/30 border-white/10'
            }`}
            title="Toggle Auto-pause at blanks"
          >
            Auto-Pause: {autoPause ? 'ON' : 'OFF'}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className={`p-1.5 rounded-full border active:scale-[0.96] transition-all ${
              soundOn
                ? 'text-white bg-white/[0.08] border-white/10'
                : 'text-white/30 border-white/10'
            }`}
            title="Sound FX"
          >
            <VolumeIcon size={15} />
          </button>

          {/* Accuracy & XP */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs">
            <span className="text-white/40 text-[11px]">Acc</span>
            <span className="font-medium text-white tabular-nums">
              {stats.totalBlanks > 0 ? `${stats.accuracy}%` : '100%'}
            </span>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1 text-white/90 font-medium tabular-nums">
              <ZapIcon size={13} />
              <span>+{stats.xpEarned}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
