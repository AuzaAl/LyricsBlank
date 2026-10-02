// Runs the REAL compiled scoring engine (scripts compiles src/lib/scoring.ts to .tmp-scoring).
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { blankQuality, computeScore, makeScoreConfig } = require('../.tmp-scoring/lib/scoring.js');

const word = (over = {}) => ({
  id: 'w',
  text: 'x',
  cleanText: 'x',
  startTimeMs: 0,
  endTimeMs: 0,
  isBlank: true,
  isCorrect: true,
  wrongAttempts: 0,
  hintsUsed: 0,
  ...over,
});

const lesson = (blanks) => ({
  id: 'l',
  metadata: { videoId: 'v', title: 't', artist: 'a', thumbnailUrl: '' },
  difficulty: 'medium',
  totalBlanks: blanks.length,
  lines: [
    {
      id: 'line-1',
      lineNumber: 1,
      startTimeMs: 0,
      endTimeMs: 0,
      rawText: '',
      hasBlank: true,
      words: blanks,
    },
  ],
});

// --- blankQuality ---
assert.equal(blankQuality(word()), 1, 'clean = 1.0');
assert.equal(blankQuality(word({ wrongAttempts: 1 })), 0.75, '1 wrong = 0.75');
assert.equal(blankQuality(word({ hintsUsed: 2 })), 0.7, '2 hints = 0.70');
assert.equal(blankQuality(word({ skipped: true })), 0, 'skip = 0');
assert.equal(blankQuality(word({ isCorrect: undefined })), 0, 'unanswered = 0');
assert.equal(blankQuality(word({ wrongAttempts: 4 })), 0, 'clamped at 0');
console.log('✓ blankQuality rules');

// --- computeScore: classic base only (no elapsed → no speed bonus) ---
const cfg = makeScoreConfig('classic', 'medium');
let r = computeScore(lesson([word(), word()]), cfg, 0);
assert.equal(r.basePoints, 200, 'two clean blanks = 200 base');
assert.equal(r.correct, 2, 'counts correct');
assert.equal(r.accuracy, 1, 'accuracy 1');
assert.ok(r.passedGate, 'passes 80% gate');
console.log('✓ classic base scoring');

// --- accuracy gate fails ---
r = computeScore(
  lesson([word(), word(), word(), word({ skipped: true }), word({ skipped: true })]),
  cfg,
  0
);
assert.equal(r.correct, 3, 'three correct');
assert.equal(r.skips, 2, 'two skips');
assert.ok(r.accuracy < 0.8, `accuracy ${r.accuracy} below gate`);
assert.equal(r.passedGate, false, 'fails gate');
console.log('✓ accuracy gate');

// --- combo: real-time mode enables combo ---
const flowCfg = makeScoreConfig('flow', 'medium');
r = computeScore(lesson(Array.from({ length: 10 }, () => word())), flowCfg, 0);
assert.equal(r.maxCombo, 10, 'max combo 10');
assert.ok(r.comboMultiplier > 1, `combo multiplier ${r.comboMultiplier} > 1`);
assert.ok(r.comboMultiplier <= 1.2, 'combo capped at +20%');
console.log('✓ combo multiplier');

// --- classic speed bonus ---
const fast = computeScore(lesson(Array.from({ length: 10 }, () => word())), cfg, 30_000);
const slow = computeScore(lesson(Array.from({ length: 10 }, () => word())), cfg, 120_000);
assert.ok(fast.speedBonus > slow.speedBonus, 'faster finish → bigger bonus');
assert.equal(slow.speedBonus, 0, 'at/over par → no bonus');
console.log('✓ classic speed term');

console.log('All scoring assertions passed.');
