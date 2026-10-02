'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Difficulty } from '@/types/lyrics';
import {
  ArrowRightIcon,
  RefreshCwIcon,
  SparklesIcon,
} from '@/components/icons';

interface LandingCardProps {
  onSubmitUrl: (urlOrQuery: string) => void;
  isLoadingSong: boolean;
  difficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
}

const SAMPLES = [
  {
    videoId: '1G4isv_Fylg',
    title: 'Paradise',
    artist: 'Coldplay',
    genre: 'Pop / Rock',
    thumbnailUrl: 'https://i.ytimg.com/vi/1G4isv_Fylg/hqdefault.jpg',
  },
  {
    videoId: 'hLQl3WQQoQ0',
    title: 'Someone Like You',
    artist: 'Adele',
    genre: 'Ballad / Soul',
    thumbnailUrl: 'https://i.ytimg.com/vi/hLQl3WQQoQ0/hqdefault.jpg',
  },
  {
    videoId: 'RBumgq5yVgA',
    title: 'Let Her Go',
    artist: 'Passenger',
    genre: 'Folk',
    thumbnailUrl: 'https://i.ytimg.com/vi/RBumgq5yVgA/hqdefault.jpg',
  },
  {
    videoId: 'YQHsXMglC9A',
    title: 'Hello',
    artist: 'Adele',
    genre: 'Pop / Soul',
    thumbnailUrl: 'https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg',
  },
];

/**
 * Default landing view (design.md §1/§6 language): a frosted card
 * centered on the ambient wash prompting for a YouTube music link.
 * No song is auto-loaded.
 */
export const LandingCard: React.FC<LandingCardProps> = ({
  onSubmitUrl,
  isLoadingSong,
  difficulty,
  onSelectDifficulty,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isLoadingSong) return;
    onSubmitUrl(urlInput.trim());
  };

  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto scrollbar-none">
      <div className="w-full max-w-xl ytm-frosted rounded-[20px] border border-white/10 shadow-2xl shadow-black/60 p-6 sm:p-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 rounded-full bg-ytm-brand flex items-center justify-center text-white shadow-lg shadow-black/40 shrink-0">
            ▶
          </div>
          <div>
            <h1 className="text-xl font-medium text-white tracking-tight">
              LyricsBlank
            </h1>
            <p className="text-sm text-white/50 mt-0.5">
              Turn any YouTube music video into a listening exercise
            </p>
          </div>
        </div>

        {/* Link Input */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative flex items-center">
            <div className="absolute left-4 text-white/50 pointer-events-none">
              <Search size={15} strokeWidth={2} />
            </div>
            <input
              type="text"
              autoFocus
              placeholder="Paste a YouTube link — youtube.com/watch?v=..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setErrorMessage('');
              }}
              disabled={isLoadingSong}
              className="w-full h-12 pl-11 pr-4 rounded-full bg-white/[0.06] border border-transparent focus:border-white/30 hover:bg-white/[0.1] text-white placeholder-white/50 text-sm transition-colors duration-150 focus:outline-none disabled:opacity-50"
            />
          </div>

          {errorMessage && (
            <p className="text-xs text-monkey-error font-medium">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={isLoadingSong || !urlInput.trim()}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-white text-black font-medium text-sm hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-black/40"
          >
            {isLoadingSong ? (
              <>
                <RefreshCwIcon size={16} className="animate-spin" />
                <span>Fetching lyrics &amp; timestamps…</span>
              </>
            ) : (
              <>
                <span>Start Practice</span>
                <ArrowRightIcon size={16} />
              </>
            )}
          </button>
        </form>

        {/* Difficulty Selector */}
        <div className="mt-5 flex items-center justify-center">
          <div className="flex items-center bg-white/[0.05] border border-white/10 rounded-full p-0.5 text-xs">
            {difficulties.map((d) => {
              const isActive = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => onSelectDifficulty(d)}
                  className={`capitalize px-3.5 py-1.5 rounded-full text-xs transition-colors duration-150 active:scale-[0.96] ${
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
        </div>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-white/10" />
          <span className="absolute px-3 bg-[#181818] text-[11px] text-white/50 uppercase tracking-wider">
            or try a demo
          </span>
        </div>

        {/* Curated Samples */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLES.map((sample) => (
            <button
              key={sample.videoId}
              onClick={() => onSubmitUrl(`https://www.youtube.com/watch?v=${sample.videoId}`)}
              disabled={isLoadingSong}
              className="group flex flex-col items-start p-2.5 rounded-[14px] bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/20 text-left transition-all disabled:opacity-50"
            >
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/50 mb-2.5">
                <img
                  src={sample.thumbnailUrl}
                  alt={sample.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex items-center gap-1.5 w-full">
                <h4 className="text-xs font-medium text-white truncate">
                  {sample.title}
                </h4>
                <SparklesIcon size={12} className="text-white/50 shrink-0" />
              </div>
              <p className="text-[11px] text-white/50 truncate">{sample.artist}</p>
              <span className="text-[10px] text-white/40 font-medium">
                {sample.genre}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
