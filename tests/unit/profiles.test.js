import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultProfiles, makeProfile, validateProfile, describeVoice,
  upsertProfile, removeProfile, PROFILE_LIMITS
} from '../../src/core/profiles.js';
import { addWord, removeWord, activeWords, isAllowed, filterIssues, SCOPE, DICTIONARY_LIMIT } from '../../src/core/dictionary.js';
import { profileLayer } from '../../src/core/prompts.js';
import { resolveProfile, applySiteRules } from '../../src/background/resolve.js';

// ---- profiles ------------------------------------------------------------

test('two profiles ship by default and both are valid', () => {
  const profiles = defaultProfiles();
  assert.deepEqual(profiles.map(p => p.id), ['personal', 'work']);
  for (const p of profiles) assert.equal(validateProfile(p).ok, true);
});

test('a profile needs a name', () => {
  const result = validateProfile({ name: '   ' });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /needs a name/);
});

test('control characters are stripped from every text field', () => {
  const { profile } = validateProfile({ name: 'Wo\u0000rk', voiceDescription: 'Bl\u001bunt' });
  assert.equal(profile.name, 'Work');
  assert.equal(profile.voiceDescription, 'Blunt');
});

test('a term cannot be both preferred and blocked', () => {
  const result = validateProfile({ name: 'X', preferredTerms: ['rollout'], blockedTerms: ['Rollout'] });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /both preferred and blocked/);
});

test('a term cannot be both protected and blocked', () => {
  const result = validateProfile({ name: 'X', protectedTerms: ['Yugi-7'], blockedTerms: ['yugi-7'] });
  assert.equal(result.ok, false);
});

test('duplicate terms are collapsed case-insensitively', () => {
  const { profile } = validateProfile({ name: 'X', protectedTerms: ['Yugi-7', 'yugi-7', 'Yugi-7 '] });
  assert.deepEqual(profile.protectedTerms, ['Yugi-7']);
});

test('voice samples are capped and short ones are dropped', () => {
  const samples = Array.from({ length: 9 }, (_, i) => `Sample number ${i} with enough characters to count.`);
  const { profile, warnings } = validateProfile({ name: 'X', samples: [...samples, 'too short'] });
  assert.equal(profile.samples.length, PROFILE_LIMITS.SAMPLES);
  assert.ok(warnings.some(w => /voice samples were kept/.test(w)));
  assert.ok(!profile.samples.includes('too short'));
});

test('formality and directness are clamped to the scale', () => {
  const { profile } = validateProfile({ name: 'X', formality: 99, directness: -4 });
  assert.equal(profile.formality, 4);
  assert.equal(profile.directness, 0);
});

test('site rules are normalised to bare hosts', () => {
  const { profile } = validateProfile({ name: 'X', siteRules: [{ host: 'https://mail.google.com/mail/u/0', modeId: 'polite' }, { host: 'not a host!' }] });
  assert.deepEqual(profile.siteRules, [{ host: 'mail.google.com', modeId: 'polite', profileId: null }]);
});

test('a profile reaches the prompt with its terminology and samples', () => {
  const { profile } = validateProfile({
    name: 'Work', protectedTerms: ['Yugi-7'], blockedTerms: ['synergy'],
    samples: ['We ship on Thursday. No extension, and no partial release.']
  });
  const layer = profileLayer(profile);
  assert.match(layer, /PROTECTED TERMS/);
  assert.match(layer, /Yugi-7/);
  assert.match(layer, /Never use these words or phrases: synergy/);
  assert.match(layer, /Sample 1:/);
});

test('upsert adds then updates, and enforces the profile cap', () => {
  let list = [];
  list = upsertProfile(list, makeProfile({ id: 'a', name: 'A' }));
  list = upsertProfile(list, makeProfile({ id: 'a', name: 'A2' }));
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'A2');
  for (let i = 0; i < 40; i++) list = upsertProfile(list, makeProfile({ id: `p${i}` }));
  assert.equal(list.length, PROFILE_LIMITS.PROFILES);
});

test('removing the last profile restores the defaults', () => {
  const list = removeProfile([makeProfile({ id: 'only' })], 'only');
  assert.deepEqual(list.map(p => p.id), ['personal', 'work']);
});

// ---- voice description ---------------------------------------------------

test('voice description reports measured traits, not interpretation', () => {
  const voice = describeVoice(['Ship it. No extension. I said no.']);
  assert.ok(voice.traits.includes('short sentences'));
  assert.ok(voice.traits.includes('states things directly'));
  assert.match(voice.basis, /These are counts, not a judgement/);
});

test('voice description detects contractions, hedging and emoji', () => {
  const voice = describeVoice(["I think we're probably fine, maybe. It might work 🙂"]);
  assert.ok(voice.traits.includes('uses contractions'));
  assert.ok(voice.traits.includes('hedges often'));
  assert.ok(voice.traits.includes('uses emoji'));
});

test('voice description returns null with no samples', () => {
  assert.equal(describeVoice([]), null);
});

// ---- resolution ----------------------------------------------------------

test('the active profile is resolved from settings and falls back to the first', async () => {
  const profiles = defaultProfiles();
  assert.equal((await resolveProfile(null, { profiles, settings: { activeProfileId: 'work' } })).id, 'work');
  assert.equal((await resolveProfile('nope', { profiles, settings: {} })).id, 'personal');
  assert.equal(await resolveProfile(null, { profiles: [], settings: {} }), null);
});

test('site rules pin a mode per origin', () => {
  const profile = makeProfile({ siteRules: [{ host: 'mail.google.com', modeId: 'polite', profileId: null }] });
  assert.deepEqual(applySiteRules(profile, 'https://mail.google.com'), { modeId: 'polite', profileId: null });
  assert.deepEqual(applySiteRules(profile, 'https://web.whatsapp.com'), { modeId: null, profileId: null });
  assert.deepEqual(applySiteRules(null, 'https://mail.google.com'), { modeId: null, profileId: null });
});

// ---- dictionary ----------------------------------------------------------

test('words are added once and rejected when duplicated', () => {
  const first = addWord([], 'Yugi');
  assert.equal(first.ok, true);
  const second = addWord(first.dictionary, 'yugi');
  assert.equal(second.ok, false);
  assert.match(second.error, /already in your dictionary/);
});

test('an empty word is rejected', () => {
  assert.equal(addWord([], '   ').ok, false);
});

test('case-sensitive entries coexist with different casing', () => {
  const first = addWord([], 'Yugi', { caseSensitive: true });
  const second = addWord(first.dictionary, 'YUGI', { caseSensitive: true });
  assert.equal(second.ok, true);
  assert.equal(second.dictionary.length, 2);
});

test('the dictionary is capped', () => {
  const full = Array.from({ length: DICTIONARY_LIMIT }, (_, i) => ({ word: `w${i}`, scope: 'global', scopeId: null }));
  const result = addWord(full, 'extra');
  assert.equal(result.ok, false);
  assert.match(result.error, /dictionary is full/);
});

test('scoped entries apply only in their scope', () => {
  let dict = addWord([], 'Kanban', { scope: SCOPE.PROFILE, scopeId: 'work' }).dictionary;
  dict = addWord(dict, 'gm', { scope: SCOPE.SITE, scopeId: 'slack.com' }).dictionary;
  dict = addWord(dict, 'Yugi').dictionary;

  assert.deepEqual(activeWords(dict, { profileId: 'work' }).sort(), ['Kanban', 'Yugi']);
  assert.deepEqual(activeWords(dict, { profileId: 'personal' }), ['Yugi']);
  assert.deepEqual(activeWords(dict, { profileId: 'personal', origin: 'https://app.slack.com' }).sort(), ['Yugi', 'gm']);
});

test('dictionary words suppress matching issues', () => {
  const dict = addWord([], 'Yugi').dictionary;
  assert.equal(isAllowed('yugi', dict), true);
  assert.equal(isAllowed('yogi', dict), false);
  const issues = filterIssues([{ original: 'Yugi' }, { original: 'teh' }], dict);
  assert.deepEqual(issues.map(i => i.original), ['teh']);
});

test('removing a word removes only the matching scope', () => {
  let dict = addWord([], 'Kanban').dictionary;
  dict = addWord(dict, 'Kanban', { scope: SCOPE.PROFILE, scopeId: 'work' }).dictionary;
  dict = removeWord(dict, 'Kanban');
  assert.equal(dict.length, 1);
  assert.equal(dict[0].scope, SCOPE.PROFILE);
});
