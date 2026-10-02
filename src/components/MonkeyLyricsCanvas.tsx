'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { LyricLine, LyricWord } from '@/types/lyrics';
import { sfx } from '@/lib/audio-sfx';
import {
  CircleCheckIcon,
  SparklesIcon,
  ChevronRightIcon,
  RotateCcwIcon,
} from '@/components/icons';

interface MonkeyLyricsCanvasProps {
  lines: LyricLine[];
  currentTimeMs: number;
  onCorrectAnswer: (wordId: string, answer: string) => void;
  onIncorrectAnswer: (wordId: string, answer: string) => void;
  onReplayLine: () => void;
  onResumePlay: () => void;
  onSkipWord: (wordId: string) => void;
  onUseHint: (wordId: string) => void;
  onSeekLine?: (timeMs: number) => void;
  onTogglePlay?: () => void;
}

export const MonkeyLyricsCanvas: React.FC<MonkeyLyricsCanvasProps> = ({
  lines,
  currentTimeMs,
  onCorrectAnswer,
  onIncorrectAnswer,
  onReplayLine,
  onResumePlay,
  onSkipWord,
  onUseHint,
  onSeekLine,
  onTogglePlay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Find currently active line based on currentTimeMs
  const activeLineIndex = useMemo(() => {
    if (!lines || lines.length === 0) return 0;
    const index = lines.findIndex(
      (l) => currentTimeMs >= l.startTimeMs && currentTimeMs <= l.endTimeMs
    );
    if (index !== -1) return index;

    // In-between lines
    for (let i = 0; i < lines.length; i++) {
      if (currentTimeMs < lines[i].startTimeMs) {
        return Math.max(0, i - 1);
      }
    }
    return lines.length - 1;
  }, [lines, currentTimeMs]);

  const activeLine = lines[activeLineIndex];

  // Find active blank word to type
  const activeBlankWord = useMemo(() => {
    if (!activeLine) return null;
    const pendingInActiveLine = activeLine.words.find(
      (w) => w.isBlank && w.isCorrect === undefined
    );
    if (pendingInActiveLine) return pendingInActiveLine;

    // Search upcoming lines
    for (let i = activeLineIndex; i < lines.length; i++) {
      const pending = lines[i].words.find((w) => w.isBlank && w.isCorrect === undefined);
      if (pending) return pending;
    }
    return null;
  }, [activeLine, activeLineIndex, lines]);

  const [typedInput, setTypedInput] = useState('');
  const [shakeError, setShakeError] = useState(false);

  // Auto-focus hidden input
  useEffect(() => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [activeBlankWord]);

  // Center active line smoothly with am-lyrics style transition
  useEffect(() => {
    const activeEl = document.getElementById(`lyric-line-${activeLineIndex}`);
    if (activeEl && containerRef.current) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeBlankWord) return;

    const val = e.target.value;
    setTypedInput(val);
    sfx.playKeyClick();

    const normalizedTarget = activeBlankWord.cleanText;
    const normalizedInput = val.toLowerCase().replace(/[^a-z0-9']/g, '').trim();

    if (normalizedInput === normalizedTarget) {
      sfx.playCorrect();
      onCorrectAnswer(activeBlankWord.id, val);
      setTypedInput('');
      onResumePlay();
    }
  };

  const triggerError = useCallback(() => {
    sfx.playError();
    setShakeError(true);
    setTimeout(() => setShakeError(false), 300);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onReplayLine();
      return;
    }

    if (e.key === ' ' && typedInput.trim() === '') {
      e.preventDefault();
      onTogglePlay?.();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (!activeBlankWord) return;
      const normalizedTarget = activeBlankWord.cleanText;
      const normalizedInput = typedInput.toLowerCase().replace(/[^a-z0-9']/g, '').trim();

      if (normalizedInput === normalizedTarget) {
        sfx.playCorrect();
        onCorrectAnswer(activeBlankWord.id, typedInput);
        setTypedInput('');
        onResumePlay();
      } else {
        triggerError();
        onIncorrectAnswer(activeBlankWord.id, typedInput);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (activeBlankWord) {
        onSkipWord(activeBlankWord.id);
        setTypedInput('');
        onResumePlay();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      if (activeBlankWord) {
        onUseHint(activeBlankWord.id);
      }
      return;
    }
  };

  const requestHint = () => {
    if (activeBlankWord) {
      onUseHint(activeBlankWord.id);
      const target = activeBlankWord.cleanText;
      const currentLen = typedInput.length;
      if (currentLen < target.length) {
        setTypedInput(target.slice(0, currentLen + 1));
        sfx.playKeyClick();
      }
    }
  };

  // Render individual word with default am-lyrics animation style
  const renderWord = (w: LyricWord, isCurrentLine: boolean) => {
    // Normal non-blank word
    if (!w.isBlank) {
      if (!isCurrentLine) {
        return (
          <span
            key={w.id}
            className="inline-block mr-2.5 sm:mr-3 transition-colors duration-300"
          >
            {w.text}
          </span>
        );
      }

      // Inside Active Line: default BiniLyrics / am-lyrics animation
      const isWordActive =
        currentTimeMs >= w.startTimeMs && currentTimeMs <= w.endTimeMs;
      const isWordPast = currentTimeMs > w.endTimeMs;

      let wordClass = 'text-white/40 transition-colors duration-200';
      if (isWordActive) {
        wordClass =
          'text-white -translate-y-0.5 drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-150';
      } else if (isWordPast) {
        wordClass = 'text-white transition-colors duration-200';
      }

      return (
        <span
          key={w.id}
          className={`inline-block mr-2.5 sm:mr-3 ${wordClass}`}
        >
          {w.text}
        </span>
      );
    }

    // Word IS a Blank:
    // Case A: Correctly answered (Clean minimal checkmark)
    if (w.isCorrect === true) {
      return (
        <span
          key={w.id}
          className="inline-flex items-center gap-1 mr-2.5 sm:mr-3 text-emerald-400 font-semibold transition-all"
        >
          <span>{w.text}</span>
          <CircleCheckIcon size={16} className="text-emerald-400 shrink-0 inline" />
        </span>
      );
    }

    // Case B: Skipped / Missed
    if (w.isCorrect === false) {
      return (
        <span
          key={w.id}
          className="inline-block mr-2.5 sm:mr-3 text-red-400/80 line-through font-semibold"
          title={`Answer: ${w.text}`}
        >
          {w.text}
        </span>
      );
    }

    // Case C: Currently active blank being typed (WAY MORE SIMPLE inline input)
    const isActiveTarget = activeBlankWord?.id === w.id;
    if (isActiveTarget) {
      return (
        <span
          key={w.id}
          className={`relative inline-flex items-baseline mr-2.5 sm:mr-3 px-2 py-0.5 rounded-md bg-white/[0.08] border-b-2 transition-all ${
            shakeError
              ? 'border-red-500 animate-subtle-shake'
              : 'border-white text-white'
          }`}
        >
          <span className="font-semibold text-white tracking-wide">
            {typedInput}
          </span>
          {/* Subtle blinking cursor */}
          <span className="inline-block w-[2px] h-[1em] bg-white animate-pulse ml-0.5 align-middle" />
          {/* Subtle placeholder dashes for remaining length */}
          {typedInput.length < w.cleanText.length && (
            <span className="text-white/20 font-normal tracking-widest ml-1 select-none">
              {'_'.repeat(w.cleanText.length - typedInput.length)}
            </span>
          )}
        </span>
      );
    }

    // Case D: Pending blank in another line
    return (
      <span
        key={w.id}
        className="inline-block mr-2.5 sm:mr-3 px-1 border-b border-white/20 text-white/30 font-normal tracking-wider"
      >
        {'_'.repeat(Math.max(3, w.cleanText.length))}
      </span>
    );
  };

  return (
    <div
      className="relative flex-1 min-h-0 w-full h-full flex flex-col justify-between py-4 px-2 sm:px-4 select-none"
      onClick={() => hiddenInputRef.current?.focus()}
    >
      <input
        ref={hiddenInputRef}
        type="text"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        value={typedInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      {/* Spacious Scrollable Lyrics Container with semibold clean typography */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-12 py-[26vh] scrollbar-none text-left"
      >
        {lines.map((line, idx) => {
          const isActive = idx === activeLineIndex;
          const distance = Math.abs(idx - activeLineIndex);

          // Depth cascade (design.md §5): blur+opacity per distance,
          // font weight 600 everywhere, active line pure white scale(1)
          const depth = Math.min(distance, 4);

          return (
            <div
              id={`lyric-line-${idx}`}
              key={line.id}
              data-depth={depth}
              onClick={() => onSeekLine?.(line.startTimeMs)}
              className={`lyric-line flex flex-wrap items-baseline cursor-pointer select-none text-2xl sm:text-3xl ${
                isActive ? 'lg:text-[44px] sm:text-4xl animate-line-enter' : 'lg:text-[34px]'
              }`}
              title="Click line to jump here"
            >
              {line.words.map((w) => renderWord(w, isActive))}
            </div>
          );
        })}
      </div>

      {/* Simple, Non-Intrusive Bottom Helper Controls */}
      <div className="flex items-center justify-between pt-3 shrink-0 border-t border-white/[0.06]">
        <div className="text-[11px] text-white/30 hidden sm:flex items-center gap-3 font-medium">
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60">Tab</kbd> Replay</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60">Ctrl+H</kbd> Hint</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60">Esc</kbd> Skip</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60">Space</kbd> Play/Pause</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={requestHint}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-[0.97] transition-all"
            title="Reveal Next Letter (Ctrl+H)"
          >
            <SparklesIcon size={13} className="text-white/70" />
            <span>Hint</span>
          </button>

          <button
            onClick={onReplayLine}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-[0.97] transition-all"
            title="Replay Line (Tab)"
          >
            <RotateCcwIcon size={13} />
            <span>Replay</span>
          </button>

          <button
            onClick={() => activeBlankWord && onSkipWord(activeBlankWord.id)}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-[0.97] transition-all"
            title="Skip Word (Esc)"
          >
            <ChevronRightIcon size={13} />
            <span>Skip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
