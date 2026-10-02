// End-to-end sanity check: fetch real "33x" TTML through the local API and
// confirm the intro gap + first-line active behaviour. Run after `npm run dev`.
import assert from 'node:assert/strict';
import { parseTtml } from '../.tmp-verify/lib/ttml-parser.js';
import {
  findInstrumentalGaps,
  findActiveLineIndex,
} from '../.tmp-verify/lib/instrumental.js';

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const url = `${BASE}/api/lyrics?track=${encodeURIComponent('33x')}&artist=${encodeURIComponent('Perunggu')}`;

const res = await fetch(url);
assert.equal(res.ok, true, `API ${res.status}`);
const data = await res.json();
assert.ok(data.ttml && data.ttml.length > 0, 'no TTML returned');

const lines = parseTtml(data.ttml);
console.log(`parsed ${lines.length} lines`);
console.log(`first line starts at ${lines[0].startTimeMs}ms`);
console.log(`last line ends at ${lines[lines.length - 1].endTimeMs}ms`);

const durationMs = 240000; // arbitrary; real player supplies getDuration()
const gaps = findInstrumentalGaps(lines, durationMs);
console.log('gaps:', gaps.map((g) => `${g.id} ${g.startTimeMs}→${g.endTimeMs}`));

const intro = gaps.find((g) => g.id === 'gap-intro');
assert.ok(intro, 'expected an intro gap for 33x');
assert.equal(intro.startTimeMs, 0);

// Before the first line, no lyric line should be highlighted.
assert.equal(findActiveLineIndex(lines, 1000), -1, 'line 0 must not be active during intro');
assert.equal(findActiveLineIndex(lines, lines[0].startTimeMs + 100), 0, 'line 0 active once it starts');

// Every gap resolves to -1 (note row active).
for (const g of gaps) {
  assert.equal(findActiveLineIndex(lines, g.startTimeMs + 10), -1, `gap ${g.id} should not highlight a line`);
}

console.log('\nAll real-TTML checks passed.');
