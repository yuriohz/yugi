import test from 'node:test';
import assert from 'node:assert/strict';
import { summariseUsage, formatCost, formatTokens, estimateCost } from '../../src/core/cost.js';

test('a reported cost is used as-is and marked reported', () => {
  const s = summariseUsage({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost: 0.0021 });
  assert.equal(s.cost, 0.0021);
  assert.equal(s.costSource, 'reported');
  assert.equal(formatCost(s), '$0.0021');
});

test('cost is estimated from pricing when not reported, and labelled', () => {
  const s = summariseUsage({ prompt_tokens: 1000, completion_tokens: 1000 }, { prompt: '0.000001', completion: '0.000002' });
  assert.equal(s.costSource, 'estimated');
  assert.equal(s.cost, 0.003);
  assert.match(formatCost(s), /\(estimated\)$/);
});

test('cost is unknown when neither usage nor pricing is available', () => {
  const s = summariseUsage(null);
  assert.equal(s.cost, null);
  assert.equal(s.costSource, 'unknown');
  assert.equal(formatCost(s), 'Cost not reported');
});

test('total tokens are derived when the provider omits them', () => {
  const s = summariseUsage({ prompt_tokens: 10, completion_tokens: 5 });
  assert.equal(s.totalTokens, 15);
});

test('missing token counts are reported as missing, not zero', () => {
  const s = summariseUsage({});
  assert.equal(s.promptTokens, null);
  assert.equal(s.totalTokens, null);
  assert.equal(formatTokens(s), 'Tokens not reported');
});

test('token formatting is readable', () => {
  const s = summariseUsage({ prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 });
  assert.equal(formatTokens(s), '1,200 in / 300 out (1,500 total)');
});

test('pre-flight estimates include web-search charges and stay labelled as estimates', () => {
  const e = estimateCost({
    inputChars: 4000, expectedOutputChars: 2000,
    pricing: { prompt: '0.000001', completion: '0.000002' },
    webSearchResults: 5
  });
  assert.equal(e.costSource, 'estimated');
  assert.equal(e.includesSearch, true);
  assert.ok(e.cost > 0.02);
});

test('an estimate with no pricing still surfaces the search charge', () => {
  const e = estimateCost({ inputChars: 100, pricing: null, webSearchResults: 5 });
  assert.equal(e.costSource, 'estimated');
  assert.ok(e.cost > 0);
});

test('an estimate with no pricing and no search is unknown', () => {
  const e = estimateCost({ inputChars: 100 });
  assert.equal(e.costSource, 'unknown');
  assert.equal(e.cost, null);
});
