import { SongMetadata } from '@/types/lyrics';

/**
 * Extracts a YouTube Video ID from various URL formats:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://music.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - or raw video ID
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex for YouTube URLs
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

/**
 * Clean common YouTube music video clutter from titles like:
 * "Coldplay - Paradise (Official Video)" -> Artist: "Coldplay", Title: "Paradise"
 */
export function cleanSongTitleAndArtist(rawTitle: string, channelName: string): { title: string; artist: string } {
  // Remove brackets / annotations
  let cleaned = rawTitle
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\((?:official|music|video|audio|lyrics|hd|4k|visualizer|feat\.|ft\.)[^)]*\)/gi, '')
    .replace(/official\s+(?:music\s+)?video/gi, '')
    .replace(/lyrics\s+video/gi, '')
    .trim();

  // Common delimiter: Artist - Title
  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    const artist = parts[0].trim();
    const title = parts.slice(1).join(' - ').trim();
    return { title, artist };
  }

  // If no hyphen, use channel as artist
  let artist = channelName.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();
  return { title: cleaned, artist };
}

/**
 * Fetch video metadata using YouTube's public oEmbed service (no API key required)
 */
export async function fetchYouTubeMetadata(videoId: string): Promise<SongMetadata> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`;

  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error('Failed to fetch oEmbed metadata');
    const data = await res.json();

    if (data.error || !data.title) {
      throw new Error(data.error || 'Video not found');
    }

    const { title, artist } = cleanSongTitleAndArtist(data.title, data.author_name || 'Unknown');

    return {
      videoId,
      title: title || data.title,
      artist: artist || data.author_name || 'Unknown Artist',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch (err) {
    // Fallback if oEmbed fails
    return {
      videoId,
      title: 'YouTube Track',
      artist: 'Artist',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
}
