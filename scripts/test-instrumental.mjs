// Unit test for src/lib/instrumental.ts — run via `npm run test:instrumental`.
import assert from 'node:assert/strict';
import {
  INSTRUMENTAL_THRESHOLD_MS,
  findInstrumentalGaps,
  findGapAt,
  findActiveLineIndex,
} from '../.tmp-instrumental/lib/instrumental.js';

const line = (id, start, end) => ({
  id: `line-${id}`,
  lineNumber: id,
  startTimeMs: start,
  endTimeMs: end,
  rawText: 'x',
  words: [],
  hasBlank: false,
});

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

console.log('instrumental gaps');

// Intro (20s), interlude (10s), short gap (3s, ignored), outro (9s)
const lines = [
  line(1, 20000, 25000),
  line(2, 35000, 40000), // 10s gap after line 1 -> interlude
  line(3, 43000, 48000), // 3s gap -> ignored
  line(4, 50000, 55000),
];
const durationMs = 64000; // 9s outro after line 4

test('detects intro, interlude and outro; ignores short gaps', () => {
  const gaps = findInstrumentalGaps(lines, durationMs);
  assert.deepEqual(
    gaps.map((g) => [g.id, g.startTimeMs, g.endTimeMs]),
    [
      ['gap-intro', 0, 20000],
      ['gap-after-0', 25000, 35000],
      ['gap-outro', 55000, 64000],
    ]
  );
});

test('omits the outro when the duration is unknown', () => {
  const gaps = findInstrumentalGaps(lines);
  assert.equal(gaps.some((g) => g.id === 'gap-outro'), false);
  assert.equal(gaps.length, 2);
});

test('threshold is 7s (matches BiniLyrics / Better Lyrics)', () => {
  assert.equal(INSTRUMENTAL_THRESHOLD_MS, 7000);
  const exactly = [line(1, 0, 1000), line(2, 8000, 9000)]; // 7000ms gap
  assert.equal(findInstrumentalGaps(exactly).length, 1);
  const just = [line(1, 0, 1000), line(2, 7999, 9000)]; // 6999ms gap
  assert.equal(findInstrumentalGaps(just).length, 0);
});

test('findGapAt is half-open [start, end)', () => {
  const gaps = findInstrumentalGaps(lines, durationMs);
  assert.equal(findGapAt(gaps, 0)?.id, 'gap-intro');
  assert.equal(findGapAt(gaps, 19999)?.id, 'gap-intro');
  assert.equal(findGapAt(gaps, 20000), undefined); // line 1 begins
  assert.equal(findGapAt(gaps, 63999)?.id, 'gap-outro');
  assert.equal(findGapAt(gaps, 64000), undefined);
});

test('active line is -1 inside a long gap, the line index inside a line', () => {
  assert.equal(findActiveLineIndex(lines, 10000), -1); // intro
  assert.equal(findActiveLineIndex(lines, 22000), 0); // inside line 1
  assert.equal(findActiveLineIndex(lines, 30000), -1); // 10s interlude
  assert.equal(findActiveLineIndex(lines, 41000), 1); // short 3s gap -> stays on line 2
  assert.equal(findActiveLineIndex(lines, 45000), 2);
  assert.equal(findActiveLineIndex(lines, 60000), 3); // outro keeps last line
});

test('first line is not active before a long intro', () => {
  const gapped = [line(1, 20000, 25000)];
  assert.equal(findActiveLineIndex(gapped, 5000), -1);
  const immediate = [line(1, 2000, 6000)];
  assert.equal(findActiveLineIndex(immediate, 500), 0); // imminent -> active
});

test('empty input is safe', () => {
  assert.deepEqual(findInstrumentalGaps([]), []);
  assert.equal(findActiveLineIndex([], 1234), -1);
});

console.log(`\n${passed} checks passed.`);
