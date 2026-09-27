import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SLOP_RULES, ARABIC_SLOP_RULES, ALL_RULES, BANNED_WORDS,
  EMPTY_ADVERBS, EMPTY_PHRASES, UPSTREAM, getRule
} from '../../src/core/slop-rules.js';

const notices = readFileSync(new URL('../../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');

test('upstream attribution matches THIRD_PARTY_NOTICES.md', () => {
  assert.equal(UPSTREAM.author, 'Peter Yang');
  assert.equal(UPSTREAM.licence, 'MIT');
  assert.equal(UPSTREAM.url, 'https://github.com/petergyang/no-ai-slop');
  assert.match(UPSTREAM.commit, /^[0-9a-f]{40}$/);
  assert.ok(notices.includes(UPSTREAM.commit), 'notices must pin the exact upstream commit');
  assert.ok(notices.includes(UPSTREAM.url));
  assert.ok(notices.includes('MIT License'));
  assert.ok(notices.includes('Copyright (c) 2026 Peter Yang'));
});

test('every upstream rule family is represented', () => {
  const required = [
    'binary-contrast', 'throat-clearing', 'faux-insight', 'colon-reveal',
    'superficial-analysis', 'importance-puffery', 'interpretive-metadiscourse',
    'weasel-attribution', 'fake-strong-verb', 'negative-listing',
    'dramatic-fragmentation', 'rhetorical-setup', 'fake-profound-kicker',
    'summary-recap', 'formatting-slop', 'em-dash-crutch', 'synonym-cycling',
    'banned-word', 'empty-adverb', 'empty-phrase'
  ];
  for (const id of required) {
    assert.ok(getRule(id), `missing rule: ${id}`);
  }
});

test('rules are well formed', () => {
  for (const rule of ALL_RULES) {
    assert.ok(rule.id && typeof rule.id === 'string');
    assert.ok(rule.title, `${rule.id} needs a title`);
    assert.ok(rule.fix, `${rule.id} needs a fix`);
    assert.ok(['high', 'medium', 'low'].includes(rule.severity), `${rule.id} severity`);
    assert.ok(Array.isArray(rule.detect) && rule.detect.length, `${rule.id} needs detectors`);
    for (const re of rule.detect) {
      assert.ok(re instanceof RegExp, `${rule.id} detector must be a RegExp`);
      assert.ok(re.global, `${rule.id} detector must be global`);
    }
  }
});

test('rule ids are unique', () => {
  const ids = ALL_RULES.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('banned word list carries the upstream vocabulary', () => {
  for (const word of ['delve', 'leverage', 'robust', 'tapestry', 'paradigm shift', 'ever-evolving']) {
    assert.ok(BANNED_WORDS.includes(word), `missing banned word: ${word}`);
  }
  assert.ok(EMPTY_ADVERBS.includes('literally'));
  assert.ok(EMPTY_PHRASES.includes('at the end of the day'));
});

test('Arabic rules are separate and marked as WordSaffron originals', () => {
  assert.ok(ARABIC_SLOP_RULES.length >= 4);
  for (const rule of ARABIC_SLOP_RULES) {
    assert.ok(rule.id.startsWith('ar-'));
    assert.ok(rule.titleEn, 'Arabic rules carry an English label for the UI');
  }
  const englishIds = new Set(SLOP_RULES.map(r => r.id));
  for (const rule of ARABIC_SLOP_RULES) assert.ok(!englishIds.has(rule.id));
});
