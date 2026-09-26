import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, relocate, withFingerprints, revalidate, toSegments, applyReplacements } from '../../src/core/ranges.js';
import { tokenise, diffTokens, summariseDiff, makeUndoEntry, UndoStack } from '../../src/core/diff.js';

// ---- fingerprints and relocation ----------------------------------------

test('a fingerprint captures the slice and its surroundings', () => {
  const print = fingerprint('the quick brown fox', 4, 9);
  assert.equal(print.slice, 'quick');
  assert.equal(print.before, 'the ');
  assert.equal(print.after, ' brown fox');
});

test('an unedited range relocates in place', () => {
  const text = 'the quick brown fox';
  const located = relocate(text, fingerprint(text, 4, 9));
  assert.deepEqual(located, { start: 4, end: 9, moved: false });
});

test('a range shifted by an earlier edit is found again', () => {
  const before = 'the quick brown fox';
  const print = fingerprint(before, 4, 9);
  const after = 'well, the quick brown fox';
  const located = relocate(after, print);
  assert.equal(after.slice(located.start, located.end), 'quick');
  assert.equal(located.moved, true);
});

test('a range whose text was deleted is reported stale, not guessed', () => {
  assert.equal(relocate('the brown fox', fingerprint('the quick brown fox', 4, 9)), null);
});

test('a range whose surroundings changed but whose text still sits in place is kept', () => {
  const print = fingerprint('send the report', 5, 8);
  const located = relocate('send the report and the invoice', print);
  assert.deepEqual(located, { start: 5, end: 8, moved: false }, 'the original position is still exactly right');
});

test('an ambiguous range is reported stale rather than applied to the wrong words', () => {
  // The surroundings are gone and the slice now appears twice, so there is no
  // safe target. Discarding is the only correct answer.
  const print = fingerprint('x the y', 2, 5);
  assert.equal(relocate('a the b and c the d', print), null);
});

test('stale issues are separated from live ones', () => {
  const text = 'I has a apple and teh pear.';
  const issues = withFingerprints([
    { start: 2, end: 5, original: 'has', replacement: 'have' },
    { start: 18, end: 21, original: 'teh', replacement: 'the' }
  ], text);

  const edited = 'Yesterday I has a apple and the pear.';
  const { live, stale } = revalidate(issues, edited);
  assert.equal(live.length, 1);
  assert.equal(edited.slice(live[0].start, live[0].end), 'has');
  assert.equal(live[0].moved, true);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].original, 'teh');
});

test('issues without a fingerprint still fall back to an exact offset check', () => {
  const text = 'the quick fox';
  const { live, stale } = revalidate([{ start: 4, end: 9, original: 'quick', replacement: 'fast' }], text);
  assert.equal(live.length, 1);
  assert.equal(stale.length, 0);
  assert.equal(revalidate([{ start: 4, end: 9, original: 'quick', replacement: 'fast' }], 'the slow fox').stale.length, 1);
});

// ---- segments ------------------------------------------------------------

test('non-overlapping issues become one segment each', () => {
  const segments = toSegments([{ start: 0, end: 3 }, { start: 6, end: 9 }], 12);
  assert.deepEqual(segments, [
    { start: 0, end: 3, issues: [0] },
    { start: 6, end: 9, issues: [1] }
  ]);
});

test('overlapping issues are flattened into shared segments', () => {
  const segments = toSegments([{ start: 0, end: 6 }, { start: 3, end: 9 }], 12);
  assert.deepEqual(segments, [
    { start: 0, end: 3, issues: [0] },
    { start: 3, end: 6, issues: [0, 1] },
    { start: 6, end: 9, issues: [1] }
  ]);
});

test('segments are clamped to the text length', () => {
  const segments = toSegments([{ start: -5, end: 100 }], 10);
  assert.deepEqual(segments, [{ start: 0, end: 10, issues: [0] }]);
});

test('no issues means no segments, so nothing is underlined', () => {
  assert.deepEqual(toSegments([], 10), []);
});

// ---- applying ------------------------------------------------------------

test('replacements apply from the end so offsets stay valid', () => {
  const text = 'I has a apple';
  const out = applyReplacements(text, [
    { start: 2, end: 5, replacement: 'have' },
    { start: 8, end: 13, replacement: 'an apple' }
  ]);
  assert.equal(out, 'I have a an apple');
});

test('overlapping replacements are skipped rather than corrupting the text', () => {
  const out = applyReplacements('the quick brown fox', [
    { start: 4, end: 15, replacement: 'speedy' },
    { start: 4, end: 9, replacement: 'fast' }
  ]);
  assert.equal(out, 'the speedy fox');
});

// ---- diff ----------------------------------------------------------------

test('tokenising preserves whitespace exactly', () => {
  assert.equal(tokenise('a  b\nc').join(''), 'a  b\nc');
});

test('identical text produces a single equal run', () => {
  const ops = diffTokens('same text here', 'same text here');
  assert.equal(ops.length, 1);
  assert.equal(ops[0].type, 'equal');
  assert.equal(summariseDiff(ops).identical, true);
});

test('a word substitution is reported as a replacement, not a rewrite', () => {
  const ops = diffTokens('We must leverage the pipeline.', 'We must use the pipeline.');
  const replaced = ops.filter(o => o.type === 'replace');
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].before.trim(), 'leverage');
  assert.equal(replaced[0].after.trim(), 'use');
  assert.equal(summariseDiff(ops).changed, 1);
});

test('an insertion and a deletion are distinguished', () => {
  const inserted = diffTokens('send it', 'send it today');
  assert.ok(inserted.some(o => o.type === 'insert' && o.after.includes('today')));
  const deleted = diffTokens('send it today', 'send it');
  assert.ok(deleted.some(o => o.type === 'delete' && o.before.includes('today')));
});

test('a changed number is never hidden inside an equal run', () => {
  const ops = diffTokens('The fee is $450 due Friday.', 'The fee is $540 due Friday.');
  const equalText = ops.filter(o => o.type === 'equal').map(o => o.before).join('');
  assert.ok(!equalText.includes('$450'));
  assert.ok(!equalText.includes('$540'));
  assert.ok(ops.some(o => o.type === 'replace' && o.before.includes('$450') && o.after.includes('$540')));
});

test('the diff reconstructs both sides exactly', () => {
  const before = 'We must leverage the robust pipeline to ship 12 features.';
  const after = 'We must use the new pipeline to ship 12 features by Friday.';
  const ops = diffTokens(before, after);
  assert.equal(ops.map(o => o.before).join(''), before);
  assert.equal(ops.map(o => o.after).join(''), after);
});

test('the diff reconstructs both sides exactly for Arabic text', () => {
  const before = 'أرجو إرسال التقرير غداً قبل الاجتماع.';
  const after = 'ابعتلي التقرير بكرة قبل الاجتماع.';
  const ops = diffTokens(before, after);
  assert.equal(ops.map(o => o.before).join(''), before);
  assert.equal(ops.map(o => o.after).join(''), after);
});

test('a very long document degrades to a coarse diff rather than hanging', () => {
  const before = 'word '.repeat(20000);
  const after = `${before}extra`;
  const ops = diffTokens(before, after, { maxTokens: 100 });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].type, 'replace');
});

test('the summary lists what was added and removed', () => {
  const summary = summariseDiff(diffTokens('We must leverage this.', 'We must use this today.'));
  assert.ok(summary.added.some(a => a.includes('use')));
  assert.ok(summary.removed.some(r => r.includes('leverage')));
});

// ---- undo ----------------------------------------------------------------

test('undo restores the exact previous text and caret', () => {
  const stack = new UndoStack();
  stack.push(makeUndoEntry({ text: 'I has a apple', selectionStart: 5, selectionEnd: 5, label: 'accept grammar fix' }));
  const entry = stack.pop();
  assert.equal(entry.text, 'I has a apple');
  assert.equal(entry.selectionStart, 5);
  assert.equal(entry.label, 'accept grammar fix');
  assert.equal(stack.size, 0);
  assert.equal(stack.pop(), null);
});

test('the undo stack is bounded and keeps the newest entries', () => {
  const stack = new UndoStack(3);
  for (let i = 0; i < 6; i++) stack.push(makeUndoEntry({ text: `v${i}` }));
  assert.equal(stack.size, 3);
  assert.equal(stack.peek().text, 'v5');
  assert.equal(stack.entries[0].text, 'v3');
});

test('an undo round trip after applying replacements restores the original exactly', () => {
  const original = 'I has a apple';
  const stack = new UndoStack();
  stack.push(makeUndoEntry({ text: original, selectionStart: 13, selectionEnd: 13 }));
  const edited = applyReplacements(original, [{ start: 2, end: 5, replacement: 'have' }]);
  assert.equal(edited, 'I have a apple');
  assert.equal(stack.pop().text, original);
});
