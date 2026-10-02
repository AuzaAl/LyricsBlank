'use client';

import React, { useState } from 'react';
import { XIcon, PlayIcon, PlusIcon } from '@/components/icons';
import type { RoomConfig } from '@/lib/room-store';
import type { Difficulty } from '@/types/lyrics';
import type { GameMode } from '@/lib/scoring';

interface CreateJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; config: Partial<RoomConfig> }) => void;
  onJoin: (code: string, name: string) => void;
  error?: string | null;
  /** Open directly on the Join tab (used by ?room= invite links). */
  defaultTab?: 'create' | 'join';
  /** Pre-fill the room code field (used by ?room= invite links). */
  defaultCode?: string;
}

const MODES: { id: GameMode; label: string; desc: string }[] = [
  { id: 'classic', label: 'Classic Race', desc: 'Pause-gated · fastest to finish' },
  { id: 'flow', label: 'Flow Race', desc: 'Real-time · highest score' },
  { id: 'sprint', label: 'Sprint', desc: 'Real-time · most points in time' },
];

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
const SPRINT_OPTIONS = [30, 60, 90];

export const CreateJoinModal: React.FC<CreateJoinModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onJoin,
  error,
  defaultTab = 'create',
  defaultCode = '',
}) => {
  const [tab, setTab] = useState<'create' | 'join'>(defaultTab);
  const [name, setName] = useState('');
  const [code, setCode] = useState(defaultCode.toUpperCase());
  const [mode, setMode] = useState<GameMode>('classic');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [sprintSeconds, setSprintSeconds] = useState(60);

  if (!isOpen) return null;

  const handleCreate = () => {
    onCreate({
      name: name.trim() || 'Host',
      config: {
        mode,
        difficulty,
        sprintSeconds: mode === 'sprint' ? sprintSeconds : undefined,
      },
    });
  };

  const handleJoin = () => {
    if (!code.trim()) return;
    onJoin(code.trim(), name.trim() || 'Player');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-xl rounded-[20px] ytm-frosted border border-white/10 p-6 sm:p-8 shadow-2xl shadow-black">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <XIcon size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-full bg-ytm-brand flex items-center justify-center text-white shadow-lg shadow-black/40 shrink-0">
            <PlayIcon size={18} />
          </div>
          <div>
            <h1 className="text-xl font-medium text-white tracking-tight">Multiplayer Race</h1>
            <p className="text-sm text-white/50 mt-0.5">Race friends through a song</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-white/[0.05] border border-white/10 rounded-full p-0.5 text-xs mb-5 w-fit">
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`capitalize px-4 py-1.5 rounded-full transition-colors duration-150 ${
                tab === t ? 'bg-white text-black font-semibold' : 'text-white/50 hover:text-white'
              }`}
            >
              {t === 'create' ? 'Create Room' : 'Join Room'}
            </button>
          ))}
        </div>

        {/* Nickname */}
        <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
          Nickname
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full h-11 px-4 rounded-xl bg-white/[0.06] border border-transparent focus:border-white/30 text-white placeholder-white/40 text-sm transition-colors focus:outline-none mb-5"
        />

        {tab === 'create' ? (
          <>
            {/* Mode */}
            <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
              Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    mode === m.id
                      ? 'bg-white/[0.1] border-white/30'
                      : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{m.label}</div>
                  <div className="text-[10px] text-white/40 mt-1 leading-snug">{m.desc}</div>
                </button>
              ))}
            </div>

            {/* Difficulty */}
            <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
              Difficulty
            </label>
            <div className="flex items-center bg-white/[0.05] border border-white/10 rounded-full p-0.5 text-xs mb-5 w-fit">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`capitalize px-3.5 py-1.5 rounded-full transition-colors duration-150 ${
                    difficulty === d
                      ? 'bg-white text-black font-semibold'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Sprint duration */}
            {mode === 'sprint' && (
              <>
                <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
                  Sprint Duration
                </label>
                <div className="flex items-center bg-white/[0.05] border border-white/10 rounded-full p-0.5 text-xs mb-5 w-fit">
                  {SPRINT_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSprintSeconds(s)}
                      className={`px-3.5 py-1.5 rounded-full transition-colors duration-150 ${
                        sprintSeconds === s
                          ? 'bg-white text-black font-semibold'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-400 font-medium mb-3">{error}</p>}

            <button
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-white text-black font-medium text-sm hover:scale-[1.01] active:scale-[0.99] transition-transform"
            >
              <PlusIcon size={16} />
              <span>Create Room</span>
            </button>
          </>
        ) : (
          <>
            <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
              Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC12"
              maxLength={5}
              className="w-full h-14 px-4 rounded-xl bg-white/[0.06] border border-transparent focus:border-white/30 text-white placeholder-white/40 text-2xl tracking-[0.4em] font-semibold text-center uppercase transition-colors focus:outline-none mb-5"
            />

            {error && <p className="text-xs text-red-400 font-medium mb-3">{error}</p>}

            <button
              onClick={handleJoin}
              disabled={code.trim().length < 5}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-white text-black font-medium text-sm hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Join Room</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
