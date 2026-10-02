'use client';

import React from 'react';
import { KeyboardIcon, XIcon } from '@/components/icons';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Tab', desc: 'Replay audio of current lyric line' },
    { key: 'Space', desc: 'Play / Pause YouTube video' },
    { key: 'Ctrl + H', desc: 'Reveal next letter hint for active blank' },
    { key: 'Esc', desc: 'Skip current blank word and reveal answer' },
    { key: 'Enter', desc: 'Check and submit current typed answer' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in font-mono select-none">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl shadow-black">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-monkey-sub hover:text-white hover:bg-white/5 transition-all"
        >
          <XIcon size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-2xl bg-monkey-cyan/15 text-monkey-cyan border border-monkey-cyan/20">
            <KeyboardIcon size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
            <p className="text-xs text-monkey-sub">Monkeytype-inspired ergonomics</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs"
            >
              <span className="text-monkey-text">{sc.desc}</span>
              <kbd className="px-2 py-1 rounded-md bg-white/10 border border-white/20 text-white font-bold">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
