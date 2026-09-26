import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, scanTree } from '../../tools/scan-secrets.js';

test('detects a synthetic OpenRouter key', () => {
  const fake = ['sk', 'or', 'v1', 'a'.repeat(32)].join('-');
  const hits = scanText(`const key = "${fake}";`);
  assert.equal(hits.length >= 1, true);
  assert.equal(hits[0].id, 'openrouter-key');
});

test('detects a synthetic private key block', () => {
  const hits = scanText('-----BEGIN RSA PRIVATE KEY-----');
  assert.equal(hits[0].id, 'private-key');
});

test('does not fire on ordinary prose', () => {
  assert.deepEqual(scanText('Paste your OpenRouter API key into the settings page.'), []);
});

test('the repository contains no secrets', async () => {
  const findings = await scanTree();
  assert.deepEqual(findings, [], JSON.stringify(findings, null, 2));
});
