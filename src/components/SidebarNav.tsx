'use client';

import React from 'react';
import {
  Disc3Icon,
  SparklesIcon,
  KeyboardIcon,
} from '@/components/icons';

interface SidebarNavProps {
  onOpenShortcuts: () => void;
}

/**
 * YT Music mini-guide rail (design.md §3): 72px icon-only column,
 * transparent over the ambient wash, active item gets a white
 * rounded pill behind the icon, ink at rgba(255,255,255,0.7).
 */
export const SidebarNav: React.FC<SidebarNavProps> = ({ onOpenShortcuts }) => {
  return (
    <aside className="hidden md:flex w-[72px] shrink-0 flex-col items-center justify-between py-4 z-20 select-none">
      {/* Top Icons */}
      <div className="flex flex-col items-center gap-5">
        {/* Brand mark — red disc, YTM logo language */}
        <div className="p-2 rounded-full bg-ytm-brand text-white shadow-lg shadow-black/40">
          <Disc3Icon size={18} />
        </div>

        <div className="w-8 h-px bg-white/10" />

        {/* Home / Practice — active white pill */}
        <button
          className="w-10 h-10 rounded-2xl bg-white/[0.1] text-white flex items-center justify-center active:scale-[0.96] hover:bg-white/[0.15] transition-all"
          title="Lyrics Listening Practice"
        >
          <Disc3Icon size={20} />
        </button>

        {/* Explore / Featured — ink 70% */}
        <button
          className="w-10 h-10 rounded-2xl text-white/70 hover:text-white hover:bg-white/[0.05] flex items-center justify-center active:scale-[0.96] transition-all"
          title="Featured Songs"
        >
          <SparklesIcon size={20} />
        </button>
      </div>

      {/* Bottom Shortcuts / Help Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onOpenShortcuts}
          className="w-10 h-10 rounded-2xl text-white/70 hover:text-white hover:bg-white/[0.05] flex items-center justify-center active:scale-[0.96] transition-all"
          title="Keyboard Shortcuts"
        >
          <KeyboardIcon size={20} />
        </button>
      </div>
    </aside>
  );
};
