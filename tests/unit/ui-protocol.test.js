import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES } from '../../src/core/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the v2 message types are the ones the UI must speak', () => {
  assert.equal(MESSAGES.TEST_CONNECTION, 'WR_TEST_CONNECTION');
  assert.equal(MESSAGES.RUN_TASK, 'WR_RUN_TASK');
  assert.equal(MESSAGES.GET_STATE, 'WR_GET_STATE');
  assert.equal(MESSAGES.SET_SETTINGS, 'WR_SET_SETTINGS');
  assert.equal(MESSAGES.SET_SHUTDOWN, 'WR_SET_SHUTDOWN');
  assert.equal(MESSAGES.OPEN_OPTIONS, 'WR_OPEN_OPTIONS');
});

test('popup, options, onboarding and the content script do not speak the v1 protocol', async () => {
  const files = [
    'src/ui/popup.js',
    'src/ui/options.js',
    'src/ui/onboarding.js',
    'src/content/content.js'
  ];
  const banned = [
    "type: 'TEST_CONNECTION'",
    'type: "TEST_CONNECTION"',
    "type:'TEST_CONNECTION'",
    "type: 'CHECK_TEXT'",
    'type: "CHECK_TEXT"',
    "type:'CHECK_TEXT'",
    "type: 'OPEN_OPTIONS'",
    'chrome.storage.local.set'
  ];
  for (const rel of files) {
    const src = await readFile(path.join(ROOT, rel), 'utf8');
    for (const token of banned) {
      assert.equal(src.includes(token), false, `${rel} still contains ${token}`);
    }
    assert.match(src, /MESSAGES\.(GET_STATE|SET_SETTINGS|TEST_CONNECTION|RUN_TASK)/);
  }
});

test('onboarding tests the connection through the service worker', async () => {
  const src = await readFile(path.join(ROOT, 'src/ui/onboarding.js'), 'utf8');
  assert.match(src, /MESSAGES\.TEST_CONNECTION/);
  assert.match(src, /userInitiated:\s*true/);
  assert.match(src, /MESSAGES\.SET_SETTINGS/);
});

test('the content script can launch rewrite and review, not only proofread', async () => {
  const src = await readFile(path.join(ROOT, 'src/content/content.js'), 'utf8');
  assert.match(src, /TASKS\.REWRITE/);
  assert.match(src, /TASKS\.REVIEW/);
  assert.match(src, /TASKS\.RESEARCH_REVIEW/);
  assert.match(src, /TASKS\.PROOFREAD/);
  assert.match(src, /renderModeLauncher/);
});
