import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSettings, migrateSettings, safeMerge, MemoryStorageArea,
  getSettings, setSettings, getCollection, setCollection
} from '../../src/core/storage.js';
import { SCHEMA_VERSION, DEFAULT_LOCALE } from '../../src/core/constants.js';

test('defaults are British English and privacy-conservative', () => {
  const s = defaultSettings();
  assert.equal(s.locale, 'en-GB');
  assert.equal(DEFAULT_LOCALE, 'en-GB');
  assert.equal(s.research.enabled, false, 'research must be opt-in');
  assert.equal(s.context.nearbyEnabled, false, 'nearby context must be opt-in');
  assert.equal(s.history.enabled, false, 'history must be opt-in');
  assert.equal(s.apiKey, '');
});

test('safeMerge ignores prototype-pollution keys', () => {
  const merged = safeMerge({ a: 1 }, JSON.parse('{"__proto__":{"polluted":true},"a":2}'));
  assert.equal(merged.a, 2);
  assert.equal({}.polluted, undefined);
});

test('safeMerge deep-merges nested objects without losing siblings', () => {
  const merged = safeMerge(defaultSettings(), { research: { enabled: true } });
  assert.equal(merged.research.enabled, true);
  assert.equal(merged.research.maxResults, 5);
});

test('migrateSettings upgrades a v1 blob and maps language to locale', () => {
  const v1 = { provider: 'openrouter', apiKey: 'redacted', model: 'x/y', language: 'English', enabled: true };
  const v2 = migrateSettings(v1);
  assert.equal(v2.schemaVersion, SCHEMA_VERSION);
  assert.equal(v2.locale, 'en-GB');
  assert.equal(v2.model, 'x/y');
  assert.equal(v2.enabled, true);
});

test('migrateSettings maps Arabic and American English', () => {
  assert.equal(migrateSettings({ language: 'Arabic' }).locale, 'ar');
  assert.equal(migrateSettings({ language: 'English (US)' }).locale, 'en-US');
});

test('migrateSettings is idempotent', () => {
  const once = migrateSettings({ language: 'Arabic' });
  const twice = migrateSettings(once);
  assert.deepEqual(twice, once);
});

test('getSettings reads a stored v2 blob', async () => {
  const area = new MemoryStorageArea({ settings: { schemaVersion: SCHEMA_VERSION, model: 'a/b' } });
  const s = await getSettings(area);
  assert.equal(s.model, 'a/b');
  assert.equal(s.locale, 'en-GB');
});

test('getSettings migrates loose v1 keys when no v2 blob exists', async () => {
  const area = new MemoryStorageArea({ model: 'legacy/model', language: 'Arabic', enabled: false });
  const s = await getSettings(area);
  assert.equal(s.model, 'legacy/model');
  assert.equal(s.locale, 'ar');
  assert.equal(s.enabled, false);
});

test('setSettings merges and persists', async () => {
  const area = new MemoryStorageArea();
  await setSettings({ model: 'one/two' }, area);
  const after = await setSettings({ research: { enabled: true } }, area);
  assert.equal(after.model, 'one/two');
  assert.equal(after.research.enabled, true);
  assert.equal((await getSettings(area)).model, 'one/two');
});

test('collections round-trip', async () => {
  const area = new MemoryStorageArea();
  assert.deepEqual(await getCollection('profiles', [], area), []);
  await setCollection('profiles', [{ id: 'work' }], area);
  assert.deepEqual(await getCollection('profiles', [], area), [{ id: 'work' }]);
});
