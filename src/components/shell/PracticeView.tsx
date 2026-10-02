'use client';

import React from 'react';
import { CinematicVideoPlayer } from '@/components/CinematicVideoPlayer';
import { MonkeyTopBar } from '@/components/MonkeyTopBar';
import { MonkeyLyricsCanvas } from '@/components/MonkeyLyricsCanvas';
import { PlayerBottomBar } from '@/components/PlayerBottomBar';
import type { PracticeEngine } from '@/hooks/usePracticeEngine';

interface PracticeViewProps {
  engine: PracticeEngine;
  /** Optional element rendered between the top bar and the content (e.g. race scoreboard). */
  topSlot?: React.ReactNode;
  /** Optional element rendered as an overlay (e.g. countdown). */
  overlay?: React.ReactNode;
}

/**
 * The core practice UI (top bar + video/lyrics split + player bar).
 * Shared verbatim by solo and multiplayer; multiplayer only injects slots.
 */
export const PracticeView: React.FC<PracticeViewProps> = ({ engine, topSlot, overlay }) => {
  const {
    currentSong,
    difficulty,
    lesson,
    palette,
    timingOffsetMs,
    stats,
    playbackRate,
    autoPause,
    soundOn,
    isPlaying,
    currentTimeMs,
    durationMs,
    activeLine,
    autoPauseLineEndMs,
    playerRef,
  } = engine;

  if (!currentSong) return null;

  return (
    <>
      <MonkeyTopBar
        difficulty={difficulty}
        onSelectDifficulty={engine.selectDifficulty}
        onSubmitUrl={engine.loadSong}
        isLoadingSong={engine.isLoadingSong}
        timingOffsetMs={timingOffsetMs}
        onAdjustOffset={engine.adjustOffset}
        onResetOffset={engine.resetOffset}
        xpEarned={stats.xpEarned}
      />

      {topSlot}

      {/* 2-Column Split Screen */}
      <div className="flex-1 min-h-0 w-full max-w-[1700px] mx-auto flex flex-col lg:flex-row items-center justify-between px-6 lg:px-12 xl:px-16 gap-8 lg:gap-12 overflow-hidden">
        <div className="w-full lg:w-[44%] xl:w-[42%] max-w-[640px] flex items-center justify-center shrink-0">
          <CinematicVideoPlayer
            ref={playerRef}
            videoId={currentSong.videoId}
            onTimeUpdate={engine.setCurrentTimeMs}
            onDurationChange={engine.setDurationMs}
            onIsPlayingChange={engine.setPlaying}
            autoPauseLineEndMs={autoPauseLineEndMs}
            currentLineStartMs={activeLine?.startTimeMs}
            ambientColor={palette.primary}
            songTitle={currentSong.title}
            artist={currentSong.artist}
          />
        </div>

        <div className="w-full lg:w-[56%] xl:w-[58%] h-full flex flex-col justify-center min-h-0 overflow-hidden">
          {lesson && (
            <MonkeyLyricsCanvas
              lines={lesson.lines}
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              onCorrectAnswer={engine.correctAnswer}
              onIncorrectAnswer={engine.incorrectAnswer}
              onReplayLine={engine.replayLine}
              onResumePlay={engine.resumePlay}
              onSkipWord={engine.skipWord}
              onUseHint={engine.useHint}
              onSeekLine={engine.seekToLine}
              onTogglePlay={engine.togglePlay}
            />
          )}
        </div>
      </div>

      <PlayerBottomBar
        metadata={currentSong}
        isPlaying={isPlaying}
        onTogglePlay={engine.togglePlay}
        onReplayLine={engine.replayLine}
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        onSeek={(seconds) => engine.seekToMs(seconds * 1000)}
        playbackRate={playbackRate}
        onCyclePlaybackRate={engine.cyclePlaybackRate}
        stats={stats}
        autoPause={autoPause}
        onToggleAutoPause={engine.toggleAutoPause}
        soundOn={soundOn}
        onToggleSound={engine.toggleSound}
      />

      {overlay}
    </>
  );
};
