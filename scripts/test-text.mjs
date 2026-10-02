// Unit test for src/lib/text.ts — apostrophe-preserving masks + matching.
import assert from 'node:assert/strict';
import {
  normalizeAnswer,
  letterCount,
  maskWord,
  maskRemainder,
  hintPrefix,
} from '../.tmp-text/text.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

console.log('text helpers');

test('matching is apostrophe-insensitive', () => {
  assert.equal(normalizeAnswer("don't"), 'dont');
  assert.equal(normalizeAnswer('dont'), 'dont');
  assert.equal(normalizeAnswer("DON'T!"), 'dont');
  assert.equal(normalizeAnswer("don't") === normalizeAnswer('dont'), true);
});

test('letterCount ignores apostrophes/punctuation', () => {
  assert.equal(letterCount("don't"), 4);
  assert.equal(letterCount("d'o'n't"), 4);
  assert.equal(letterCount(''), 0);
});

test('maskWord keeps apostrophes visible', () => {
  assert.equal(maskWord("don't"), "___'_");
  assert.equal(maskWord('rock'), '____');
  assert.equal(maskWord("o'clock"), "_'_____");
});

test('maskRemainder keeps apostrophes only while still ahead', () => {
  assert.equal(maskRemainder("don't", 0), "___'_");
  assert.equal(maskRemainder("don't", 2), "_'_");
  assert.equal(maskRemainder("don't", 3), "'_");
  assert.equal(maskRemainder("don't", 4), '');
  assert.equal(maskRemainder('rock', 4), '');
});

test('hintPrefix reveals letters one at a time, keeping apostrophes', () => {
  assert.equal(hintPrefix("don't", 0), 'd');
  assert.equal(hintPrefix("don't", 2), "don'");
  assert.equal(hintPrefix("don't", 3), "don't");
  assert.equal(hintPrefix("don't", 4), "don't");
});

console.log(`\n${passed} checks passed.`);
