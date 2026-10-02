/**
 * Answer-matching + blank-masking helpers.
 *
 * Blanks keep their apostrophes visible (e.g. `don'_`) so the player knows one
 * is there, but matching is apostrophe-insensitive so typing `dont` or `don't`
 * both count — this avoids the classic "I typed the letters but it rejected me"
 * frustration.
 */

/** Strip everything except letters/digits — used for BOTH sides of a compare. */
export function normalizeAnswer(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Number of letters/digits the player has typed (ignores punctuation). */
export function letterCount(value: string): number {
  return normalizeAnswer(value).length;
}

/** Number of letters/digits in a word (apostrophes excluded). */
export function wordLetterCount(cleanText: string): number {
  return normalizeAnswer(cleanText).length;
}

/**
 * Placeholder for a blank: letters/digits become `_`, while non-alphanumeric
 * characters already in the word (apostrophes) stay visible.
 *   "don't" -> "___'"
 */
export function maskWord(cleanText: string): string {
  return cleanText.replace(/[a-z0-9]/gi, '_');
}

/**
 * The still-untyped tail of a blank's mask, preserving apostrophes in place.
 * `typedLetters` is how many LETTERS the player has entered so far.
 *   ("don't", 0) -> "___'_"   ("don't", 2) -> "_'_"   ("don't", 4) -> ""
 */
export function maskRemainder(cleanText: string, typedLetters: number): string {
  let seen = 0;
  let out = '';
  for (const ch of cleanText) {
    if (/[a-z0-9]/i.test(ch)) {
      if (seen >= typedLetters) out += '_';
      seen++;
    } else if (seen >= typedLetters) {
      out += ch; // apostrophe only while its position is still ahead
    }
  }
  return out;
}

/**
 * Reveal one more LETTER of a blank (Ctrl+H hint), keeping apostrophes as-is.
 *   ("don't", 0) -> "d"; ("don't", 2) -> "don"
 */
export function hintPrefix(cleanText: string, typedLetters: number): string {
  const want = typedLetters + 1;
  let seen = 0;
  let out = '';
  for (const ch of cleanText) {
    if (/[a-z0-9]/i.test(ch)) {
      if (seen >= want) break;
      seen++;
    }
    out += ch;
  }
  return out;
}
