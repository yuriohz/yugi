import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson, extractBalanced, stripFences, stripDangerousKeys } from '../../src/core/json.js';

test('parses plain JSON', () => {
  assert.deepEqual(parseModelJson('{"a":1}'), { ok: true, value: { a: 1 } });
});

test('strips markdown fences', () => {
  assert.equal(stripFences('```json\n{"a":1}\n```'), '{"a":1}');
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```').value, { a: 1 });
});

test('recovers JSON embedded in prose', () => {
  const raw = 'Here is the result:\n{"issues":[{"start":0}]}\nHope that helps.';
  assert.deepEqual(parseModelJson(raw).value, { issues: [{ start: 0 }] });
});

test('ignores braces inside strings when balancing', () => {
  assert.equal(extractBalanced('{"a":"}{"}'), '{"a":"}{"}');
});

test('tolerates trailing commas', () => {
  assert.deepEqual(parseModelJson('{"a":1,}').value, { a: 1 });
});

test('rejects empty and non-JSON output', () => {
  assert.equal(parseModelJson('').ok, false);
  assert.equal(parseModelJson('no json here at all').ok, false);
});

test('accepts an already-parsed object', () => {
  const obj = { a: 1 };
  assert.equal(parseModelJson(obj).value, obj);
});

test('strips prototype pollution vectors from model output', () => {
  const parsed = parseModelJson('{"__proto__":{"x":1},"ok":true}');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.ok, true);
  assert.equal({}.x, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.value, '__proto__'), false);
});

test('stripDangerousKeys recurses through arrays', () => {
  const out = stripDangerousKeys([JSON.parse('{"constructor":1,"keep":2}')]);
  assert.deepEqual(out, [{ keep: 2 }]);
});
