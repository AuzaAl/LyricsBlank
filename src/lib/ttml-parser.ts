import { LyricLine, LyricWord } from '@/types/lyrics';

/**
 * Converts TTML timestamp string to milliseconds:
 * Examples:
 * - "54.836" -> 54836 ms
 * - "1:01.483" -> 61483 ms
 * - "00:01:24.500" -> 84500 ms
 * - "12.34s" -> 12340 ms
 * - "84500ms" -> 84500 ms
 */
export function parseTtmlTimestamp(timeStr: string): number {
  if (!timeStr) return 0;
  timeStr = timeStr.trim();

  // "12.34s"
  if (timeStr.endsWith('s') && !timeStr.endsWith('ms')) {
    return Math.round(parseFloat(timeStr.slice(0, -1)) * 1000);
  }

  // "1234ms"
  if (timeStr.endsWith('ms')) {
    return parseInt(timeStr.slice(0, -2), 10);
  }

  // "hh:mm:ss.mmm" or "mm:ss.mmm"
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  const rawNum = parseFloat(timeStr);
  return isNaN(rawNum) ? 0 : Math.round(rawNum * 1000);
}

/**
 * Cleans a word for matching: removes punctuation, trims, toLowerCase
 */
export function cleanWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '').trim();
}

interface SyllableToken {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

/**
 * Parses TTML XML content into structured LyricLine[]
 * Automatically merges adjacent syllable spans without spaces or with hyphens
 * (e.g. "la" + "byrinth" -> "labyrinth", "re" + "ar" + "ranged" -> "rearranged")
 * so that blanks are ALWAYS full whole words!
 */
export function parseTtml(ttmlContent: string): LyricLine[] {
  const lines: LyricLine[] = [];
  if (!ttmlContent) return lines;

  // Regex to match <p begin="..." end="...">...</p>
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  let lineNumber = 1;

  while ((pMatch = pRegex.exec(ttmlContent)) !== null) {
    const pAttributes = pMatch[1];
    const pBody = pMatch[2];

    const beginMatch = pAttributes.match(/\bbegin=["']([^"']+)["']/i);
    const endMatch = pAttributes.match(/\bend=["']([^"']+)["']/i);

    const lineStartTime = beginMatch ? parseTtmlTimestamp(beginMatch[1]) : 0;
    const lineEndTime = endMatch ? parseTtmlTimestamp(endMatch[1]) : lineStartTime + 4000;

    // Tokenize spans along with trailing whitespace to accurately group syllables into full words
    const spanWithTrailingRegex = /(<span\b([^>]*)>([\s\S]*?)<\/span>)(\s*)/gi;
    let tokenMatch: RegExpExecArray | null;

    const rawWords: SyllableToken[][] = [];
    let currentWordSyllables: SyllableToken[] = [];

    while ((tokenMatch = spanWithTrailingRegex.exec(pBody)) !== null) {
      const spanAttr = tokenMatch[2];
      const spanText = tokenMatch[3].replace(/<[^>]+>/g, '').trim();
      const trailingWhitespace = tokenMatch[4];

      if (!spanText) continue;

      const sBeginMatch = spanAttr.match(/\bbegin=["']([^"']+)["']/i);
      const sEndMatch = spanAttr.match(/\bend=["']([^"']+)["']/i);

      const wordStart = sBeginMatch ? parseTtmlTimestamp(sBeginMatch[1]) : lineStartTime;
      const wordEnd = sEndMatch ? parseTtmlTimestamp(sEndMatch[1]) : lineEndTime;

      currentWordSyllables.push({
        text: spanText,
        startTimeMs: wordStart,
        endTimeMs: wordEnd,
      });

      // A word boundary occurs if:
      // 1. There is trailing whitespace after </span (e.g. </span> )
      // 2. AND the spanText does not end with a hyphen (e.g. "Para-")
      const endsWithHyphen = spanText.endsWith('-');
      const hasSpace = trailingWhitespace.length > 0;

      if ((hasSpace && !endsWithHyphen) || (!endsWithHyphen && hasSpace)) {
        rawWords.push([...currentWordSyllables]);
        currentWordSyllables = [];
      }
    }

    if (currentWordSyllables.length > 0) {
      rawWords.push([...currentWordSyllables]);
    }

    const words: LyricWord[] = rawWords.map((syllableGroup, wordIdx) => {
      const combinedText = syllableGroup.map((s) => s.text).join('');
      const wordStart = syllableGroup[0].startTimeMs;
      const wordEnd = syllableGroup[syllableGroup.length - 1].endTimeMs;

      return {
        id: `line-${lineNumber}-word-${wordIdx}`,
        text: combinedText,
        cleanText: cleanWord(combinedText),
        startTimeMs: wordStart,
        endTimeMs: wordEnd,
        isBlank: false,
      };
    });

    // If no word-level spans were present, split text by whitespace
    if (words.length === 0) {
      const rawTextClean = pBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!rawTextClean) continue;

      const rawWordsSplit = rawTextClean.split(' ');
      const totalWords = rawWordsSplit.length;
      const totalDuration = Math.max(1000, lineEndTime - lineStartTime);
      const wordDuration = totalDuration / totalWords;

      rawWordsSplit.forEach((w, idx) => {
        if (!w.trim()) return;
        const wStart = Math.round(lineStartTime + idx * wordDuration);
        const wEnd = Math.round(Math.min(lineEndTime, wStart + wordDuration));

        words.push({
          id: `line-${lineNumber}-word-${idx}`,
          text: w,
          cleanText: cleanWord(w),
          startTimeMs: wStart,
          endTimeMs: wEnd,
          isBlank: false,
        });
      });
    }

    if (words.length > 0) {
      const rawText = words.map((w) => w.text).join(' ');
      lines.push({
        id: `line-${lineNumber}`,
        lineNumber,
        startTimeMs: lineStartTime,
        endTimeMs: lineEndTime,
        rawText,
        words,
        hasBlank: false,
      });
      lineNumber++;
    }
  }

  return lines;
}

/**
 * Shifts all timestamps in the lyric lines by offsetMs (+ or -)
 * to achieve 100% frame-perfect sync with any YouTube video pace.
 */
export function applyTimingOffset(lines: LyricLine[], offsetMs: number): LyricLine[] {
  if (offsetMs === 0) return lines;

  return lines.map((line) => ({
    ...line,
    startTimeMs: Math.max(0, line.startTimeMs + offsetMs),
    endTimeMs: Math.max(0, line.endTimeMs + offsetMs),
    words: line.words.map((w) => ({
      ...w,
      startTimeMs: Math.max(0, w.startTimeMs + offsetMs),
      endTimeMs: Math.max(0, w.endTimeMs + offsetMs),
    })),
  }));
}
