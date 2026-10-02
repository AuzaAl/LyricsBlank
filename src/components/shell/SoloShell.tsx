'use client';

import React, { useState } from 'react';
import { LandingCard } from '@/components/LandingCard';
import { LessonCompleteModal } from '@/components/LessonCompleteModal';
import { AppChrome } from '@/components/shell/AppChrome';
import { PracticeView } from '@/components/shell/PracticeView';
import { usePracticeEngine } from '@/hooks/usePracticeEngine';
import type { GameMode } from '@/lib/scoring';
import type { Difficulty } from '@/types/lyrics';

interface SoloShellProps {
  mode?: GameMode;
  onExitToLanding?: () => void;
  onOpenMultiplayer?: () => void;
}

/**
 * Solo practice experience. Behaviour is identical to the pre-refactor page.tsx;
 * the only change is that game state now lives in usePracticeEngine.
 */
export const SoloShell: React.FC<SoloShellProps> = ({
  mode = 'classic',
  onExitToLanding,
  onOpenMultiplayer,
}) => {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const engine = usePracticeEngine({ mode });

  const {
    currentSong,
    difficulty,
    lesson,
    stats,
    isLoadingSong,
    isCompleteModalOpen,
    palette,
  } = engine;

  return (
    <AppChrome
      artUrl={
        currentSong ? `https://i.ytimg.com/vi/${currentSong.videoId}/maxresdefault.jpg` : ''
      }
      fallbackUrl={currentSong?.thumbnailUrl}
      onOpenShortcuts={() => setIsShortcutsOpen(true)}
      isShortcutsOpen={isShortcutsOpen}
      onCloseShortcuts={() => setIsShortcutsOpen(false)}
      overlay={
        <LessonCompleteModal
          isOpen={isCompleteModalOpen}
          onClose={engine.closeCompleteModal}
          stats={stats}
          onPlayAgain={engine.reload}
          onChangeSong={() => {
            engine.resetSession();
            onExitToLanding?.();
          }}
          songTitle={currentSong?.title ?? ''}
          artist={currentSong?.artist ?? ''}
        />
      }
    >
      {!currentSong ? (
        <LandingCard
          onSubmitUrl={engine.loadSong}
          isLoadingSong={isLoadingSong}
          difficulty={difficulty}
          onSelectDifficulty={engine.selectDifficulty}
          onOpenMultiplayer={onOpenMultiplayer}
        />
      ) : (
        <PracticeView engine={engine} />
      )}
    </AppChrome>
  );
};

export type { Difficulty };
