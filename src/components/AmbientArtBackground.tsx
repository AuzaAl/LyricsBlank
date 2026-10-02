'use client';

import React, { useEffect, useState } from 'react';

interface AmbientArtBackgroundProps {
  /** Full-resolution art URL (maxresdefault for YouTube videos) */
  artUrl: string;
  /** Low-res fallback used if the hi-res art 404s */
  fallbackUrl?: string;
}

/**
 * YouTube Music ambient background (design.md §2).
 *
 * The video thumbnail is blown up fullscreen and re-rendered as ambience:
 *   blur(100px) saturate(2) at 50% opacity over the #030303 base,
 * then a vignette scrim dissolves the edges to black.
 *
 * The "theme" is therefore always art-driven — zero per-track design effort.
 */
export const AmbientArtBackground: React.FC<AmbientArtBackgroundProps> = ({
  artUrl,
  fallbackUrl,
}) => {
  // Resolved URL after preload (falls back when maxres doesn't exist)
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  useEffect(() => {
    if (!artUrl) return;
    let cancelled = false;

    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setResolvedUrl(artUrl);
    };
    probe.onerror = () => {
      if (!cancelled && fallbackUrl) setResolvedUrl(fallbackUrl);
    };
    probe.src = artUrl;

    return () => {
      cancelled = true;
    };
  }, [artUrl, fallbackUrl]);

  // Two stacked layers so the wash crossfades when the song changes
  const [layers, setLayers] = useState<{ url: string; key: number }[]>([]);

  useEffect(() => {
    if (!resolvedUrl) return;
    setLayers((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].url === resolvedUrl) return prev;
      // Keep the outgoing layer only while the new one fades in
      return [...prev, { url: resolvedUrl, key: Date.now() }].slice(-2);
    });
  }, [resolvedUrl]);

  // Drop the outgoing layer once the crossfade has finished
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), 1300);
    return () => clearTimeout(t);
  }, [layers]);

  return (
    <div className="ambient-stage" aria-hidden="true">
      {layers.map((layer, i) => (
        <div
          key={layer.key}
          className="ambient-stage__art"
          style={{
            backgroundImage: `url("${layer.url}")`,
            zIndex: i,
          }}
        />
      ))}

      {/* Edge-darkening vignette — the "stage light" falloff */}
      <div className="ambient-stage__vignette" />
    </div>
  );
};