/**
 * Extracts dominant vibrant colors from an image URL (YouTube thumbnail)
 * using an offscreen HTML Canvas so the background mesh gradient
 * dynamically matches the video screen colors.
 */

export interface VideoColorPalette {
  primary: string;   // e.g. 'rgb(180, 130, 60)'
  secondary: string; // e.g. 'rgb(60, 90, 140)'
  accent: string;    // e.g. 'rgb(220, 180, 80)'
}

export const DEFAULT_PALETTE: VideoColorPalette = {
  primary: 'rgb(147, 51, 234)',   // purple-600
  secondary: 'rgb(6, 182, 212)',  // cyan-500
  accent: 'rgb(234, 179, 8)',     // yellow-500
};

export async function extractPaletteFromImage(imageUrl: string): Promise<VideoColorPalette> {
  if (typeof window === 'undefined') return DEFAULT_PALETTE;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      resolve(DEFAULT_PALETTE);
    }, 2000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        // Downscale for speed
        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);

        const imageData = ctx.getImageData(0, 0, 64, 64).data;
        const colorBuckets: { r: number; g: number; b: number; count: number; sat: number }[] = [];

        for (let i = 0; i < imageData.length; i += 16) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];

          // Skip near black or near white
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness < 30 || brightness > 230) continue;

          // Calculate saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.15) continue;

          colorBuckets.push({ r, g, b, count: 1, sat });
        }

        if (colorBuckets.length === 0) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        // Sort by saturation and brightness
        colorBuckets.sort((a, b) => b.sat - a.sat);

        const primary = colorBuckets[0];
        const secondary = colorBuckets[Math.min(colorBuckets.length - 1, Math.floor(colorBuckets.length * 0.4))] || primary;
        const accent = colorBuckets[Math.min(colorBuckets.length - 1, Math.floor(colorBuckets.length * 0.8))] || primary;

        resolve({
          primary: `rgb(${primary.r}, ${primary.g}, ${primary.b})`,
          secondary: `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`,
          accent: `rgb(${accent.r}, ${accent.g}, ${accent.b})`,
        });
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(DEFAULT_PALETTE);
    };

    img.src = imageUrl;
  });
}
