'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CinematicVideoPlayerProps {
  videoId: string;
  onTimeUpdate: (currentMs: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onIsPlayingChange?: (isPlaying: boolean) => void;
  onPlayerReady?: () => void;
  autoPauseLineEndMs?: number | null;
  onAutoPaused?: () => void;
  currentLineStartMs?: number;
  ambientColor?: string;
  songTitle?: string;
  artist?: string;
}

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  replayCurrentLine: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTimeMs: () => number;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setPlaybackRate: (rate: number) => void;
  destroy: () => void;
}

export const CinematicVideoPlayer = React.forwardRef<VideoPlayerRef, CinematicVideoPlayerProps>(
  (
    {
      videoId,
      onTimeUpdate,
      onDurationChange,
      onIsPlayingChange,
      onPlayerReady,
      autoPauseLineEndMs,
      onAutoPaused,
      currentLineStartMs,
      ambientColor = 'rgba(226, 183, 20, 0.3)',
      songTitle,
      artist,
    },
    ref
  ) => {
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
    const isReadyRef = useRef<boolean>(false);
    const pendingSeekRef = useRef<number | null>(null);
    const pendingPlayRef = useRef<boolean>(false);
    const hasAutoPausedForLineRef = useRef<number | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTimeMs, setCurrentTimeMs] = useState(0);
    const [isApiReady, setIsApiReady] = useState(false);

    // Keep ref values up-to-date for stable callbacks inside intervals and events
    const onTimeUpdateRef = useRef(onTimeUpdate);
    onTimeUpdateRef.current = onTimeUpdate;

    const onDurationChangeRef = useRef(onDurationChange);
    onDurationChangeRef.current = onDurationChange;

    const onIsPlayingChangeRef = useRef(onIsPlayingChange);
    onIsPlayingChangeRef.current = onIsPlayingChange;

    const onPlayerReadyRef = useRef(onPlayerReady);
    onPlayerReadyRef.current = onPlayerReady;

    const onAutoPausedRef = useRef(onAutoPaused);
    onAutoPausedRef.current = onAutoPaused;

    const autoPauseLineEndMsRef = useRef(autoPauseLineEndMs);
    autoPauseLineEndMsRef.current = autoPauseLineEndMs;

    // Reset auto-pause latch whenever the target line changes
    useEffect(() => {
      if (autoPauseLineEndMs !== hasAutoPausedForLineRef.current) {
        hasAutoPausedForLineRef.current = null;
      }
    }, [autoPauseLineEndMs]);

    // 1. Load YouTube IFrame API Script with dual polling check
    useEffect(() => {
      if (typeof window === 'undefined') return;

      if (window.YT && window.YT.Player) {
        setIsApiReady(true);
        return;
      }

      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevReady?.();
        setIsApiReady(true);
      };

      const pollTimer = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setIsApiReady(true);
          clearInterval(pollTimer);
        }
      }, 100);

      return () => {
        clearInterval(pollTimer);
      };
    }, []);

    // 2. Initialize YouTube Player instance when API & videoId are available
    useEffect(() => {
      if (!isApiReady || !videoId || !playerContainerRef.current) return;

      isReadyRef.current = false;

      // Safely cleanup previous player instance
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }

      // Create a fresh DOM container element so YouTube replacement never orphans DOM
      const mountEl = document.createElement('div');
      mountEl.className = 'w-full h-full pointer-events-none';
      playerContainerRef.current.replaceChildren(mountEl);

      try {
        ytPlayerRef.current = new window.YT.Player(mountEl, {
          videoId,
          playerVars: {
            enablejsapi: 1,
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            playsinline: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: (event) => {
              isReadyRef.current = true;
              onPlayerReadyRef.current?.();

              try {
                const dur = event.target.getDuration();
                if (dur && !isNaN(dur)) {
                  onDurationChangeRef.current?.(dur * 1000);
                }
              } catch {}

              // Execute any queued seek
              if (pendingSeekRef.current !== null) {
                try {
                  event.target.seekTo(pendingSeekRef.current, true);
                  setCurrentTimeMs(pendingSeekRef.current * 1000);
                } catch {}
                pendingSeekRef.current = null;
              }

              // Execute any queued play
              if (pendingPlayRef.current) {
                try {
                  event.target.playVideo();
                } catch {}
                pendingPlayRef.current = false;
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                onIsPlayingChangeRef.current?.(true);
              } else if (
                event.data === window.YT.PlayerState.PAUSED ||
                event.data === window.YT.PlayerState.ENDED
              ) {
                setIsPlaying(false);
                onIsPlayingChangeRef.current?.(false);
              }
            },
            onError: (err) => {
              console.warn('YouTube Player error code:', err.data);
            },
          },
        });
      } catch (err) {
        console.error('Failed to instantiate YouTube Player:', err);
      }

      return () => {
        isReadyRef.current = false;
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.destroy();
          } catch {}
          ytPlayerRef.current = null;
        }
      };
    }, [isApiReady, videoId]);

    // 3. Continuous 50ms playback sync loop
    useEffect(() => {
      const intervalId = setInterval(() => {
        if (!isReadyRef.current || !ytPlayerRef.current) return;

        try {
          if (typeof ytPlayerRef.current.getPlayerState !== 'function') return;
          const state = ytPlayerRef.current.getPlayerState();
          const isCurrentlyPlaying = state === 1; // 1 = PLAYING

          if (typeof ytPlayerRef.current.getCurrentTime !== 'function') return;
          const currentSec = ytPlayerRef.current.getCurrentTime();

          if (typeof currentSec === 'number' && !isNaN(currentSec)) {
            const curMs = Math.round(currentSec * 1000);
            setCurrentTimeMs(curMs);

            if (isCurrentlyPlaying) {
              onTimeUpdateRef.current?.(curMs);

              // Auto-pause check: trigger only once per target threshold
              const autoPauseThreshold = autoPauseLineEndMsRef.current;
              if (
                autoPauseThreshold &&
                curMs >= autoPauseThreshold &&
                hasAutoPausedForLineRef.current !== autoPauseThreshold
              ) {
                hasAutoPausedForLineRef.current = autoPauseThreshold;
                ytPlayerRef.current.pauseVideo();
                setIsPlaying(false);
                onIsPlayingChangeRef.current?.(false);
                onAutoPausedRef.current?.();
              }
            }
          }
        } catch {}
      }, 50);

      return () => {
        clearInterval(intervalId);
      };
    }, []);

    // 4. Stable Control Methods (Defensive & Queued)
    const seekTo = useCallback((seconds: number) => {
      setCurrentTimeMs(seconds * 1000);
      if (isReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          ytPlayerRef.current.seekTo(seconds, true);
        } catch (e) {
          console.warn('seekTo error:', e);
        }
      } else {
        pendingSeekRef.current = seconds;
      }
    }, []);

    const play = useCallback(() => {
      if (isReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
        try {
          ytPlayerRef.current.playVideo();
        } catch (e) {
          console.warn('playVideo error:', e);
        }
      } else {
        pendingPlayRef.current = true;
      }
    }, []);

    const pause = useCallback(() => {
      pendingPlayRef.current = false;
      if (isReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {
          console.warn('pauseVideo error:', e);
        }
      }
    }, []);

    const togglePlay = useCallback(() => {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    }, [isPlaying, pause, play]);

    const replayCurrentLine = useCallback(() => {
      if (currentLineStartMs !== undefined) {
        seekTo(Math.max(0, currentLineStartMs / 1000 - 0.2));
        play();
      }
    }, [currentLineStartMs, seekTo, play]);

    const setPlaybackRate = useCallback((rate: number) => {
      if (isReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.setPlaybackRate === 'function') {
        try {
          ytPlayerRef.current.setPlaybackRate(rate);
        } catch {}
      }
    }, []);

    const getCurrentTimeMs = useCallback(() => {
      return currentTimeMs;
    }, [currentTimeMs]);

    React.useImperativeHandle(ref, () => ({
      seekTo,
      play,
      pause,
      togglePlay,
      replayCurrentLine,
      setPlaybackRate,
      getCurrentTimeMs,
    }));

    return (
      <div className="relative w-full flex flex-col items-center justify-center">
        {/* Soft Ambient Backlight Glow matching video palette */}
        <div
          className="absolute inset-6 -z-10 rounded-[28px] blur-3xl opacity-50 transition-all duration-1000 ease-out"
          style={{
            background: ambientColor,
          }}
        />

        {/* Cinematic Video Artwork Frame — 20px radius per design.md §6 */}
        <div
          ref={playerContainerRef}
          className="relative w-full aspect-video overflow-hidden rounded-[20px] border border-white/10 bg-black/95 shadow-2xl flex items-center justify-center cursor-pointer group"
          onClick={togglePlay}
        >
          {/* Fallback placeholder while iframe mounts */}
          <div className="w-full h-full pointer-events-none" />

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="px-4 py-2 rounded-full bg-black/70 text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg">
              {isPlaying ? 'Click to Pause' : 'Click to Play'}
            </span>
          </div>
        </div>

        {/* Under-Video Track Details ala Image 2 */}
        {songTitle && (
          <div className="w-full mt-4 flex items-center justify-between px-2">
            <div className="min-w-0 pr-2">
              <h3 className="text-lg font-medium text-white tracking-tight leading-tight truncate">
                {songTitle}
              </h3>
              <p className="text-xs text-white/50 font-medium mt-0.5 truncate">
                {artist}
              </p>
            </div>
            <div className="flex items-center gap-2 text-white/40 shrink-0">
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/80 font-medium">
                Listening Mode
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

CinematicVideoPlayer.displayName = 'CinematicVideoPlayer';
