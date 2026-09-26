import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAmericanisms, britishise, WORD_MAP } from '../../src/core/british.js';
import { DEFAULT_LOCALE } from '../../src/core/constants.js';
import { localeLayerFor } from '../../src/core/locale.js';

const words = text => detectAmericanisms(text).map(i => `${i.original}→${i.replacement}`);

test('British English is the product default', () => {
  assert.equal(DEFAULT_LOCALE, 'en-GB');
  assert.match(localeLayerFor({ text: 'hello' }), /Write in British English/);
});

test('-our, -re and -ogue spellings are corrected', () => {
  assert.deepEqual(words('The color of the center catalog'), ['color→colour', 'center→centre', 'catalog→catalogue']);
});

test('-yse is corrected as a firm rule', () => {
  const issues = detectAmericanisms('We analyze the data and paralyzed the queue.');
  assert.deepEqual(issues.map(i => i.replacement), ['analyse', 'paralysed']);
  assert.ok(issues.every(i => i.advisory === false));
});

test('-ize is advisory because Oxford style accepts it', () => {
  const [issue] = detectAmericanisms('We should organize this.');
  assert.equal(issue.replacement, 'organise');
  assert.match(issue.message, /Oxford style also accepts -ize/);
});

test('advisory issues can be excluded', () => {
  assert.deepEqual(detectAmericanisms('We should organize this.', { includeAdvisory: false }), []);
});

test('doubled-l inflections are corrected', () => {
  assert.deepEqual(words('We traveled and canceled while modeling'), ['traveled→travelled', 'canceled→cancelled', 'modeling→modelling']);
});

test('capitalisation is preserved', () => {
  assert.deepEqual(words('Color and COLOR and Analyze'), ['Color→Colour', 'COLOR→COLOUR', 'Analyze→Analyse']);
});

test('meaning-sensitive words are advisory with an explanation', () => {
  const [issue] = detectAmericanisms('Update the program next week.');
  assert.equal(issue.original, 'program');
  assert.equal(issue.advisory, true);
  assert.match(issue.message, /can mean different things/);
});

test('URLs, inline code and quotations are never corrected', () => {
  assert.deepEqual(detectAmericanisms('See https://example.test/color-center'), []);
  assert.deepEqual(detectAmericanisms('Run `npm run analyze` now.'), []);
  assert.deepEqual(detectAmericanisms('He wrote "the color is wrong" in the ticket.'), []);
});

test('protected terms are never corrected', () => {
  assert.deepEqual(detectAmericanisms('Open the Color Center panel.', { protectedTerms: ['Color Center'] }), []);
});

test('personal dictionary words are skipped', () => {
  assert.deepEqual(detectAmericanisms('Our Analyzer service is up.', { dictionary: ['analyzer'] }), []);
});

test('honorific full stops are removed', () => {
  const [issue] = detectAmericanisms('Please ask Dr. Mariam about it.');
  assert.equal(issue.original, 'Dr.');
  assert.equal(issue.replacement, 'Dr');
  assert.equal(issue.category, 'punctuation');
});

test('American date order is corrected', () => {
  const issue = detectAmericanisms('Due March 14, 2026 at noon.').find(i => i.category === 'punctuation');
  assert.equal(issue.replacement, '14 March 2026');
});

test('offsets describe the exact slice', () => {
  const text = 'The color is wrong.';
  const [issue] = detectAmericanisms(text);
  assert.equal(text.slice(issue.start, issue.end), issue.original);
});

test('britishise applies only the firm conversions', () => {
  assert.equal(britishise('We analyze the color of the center.'), 'We analyse the colour of the centre.');
  assert.equal(britishise('We should organize this.'), 'We should organize this.', '-ize is advisory, so it is left alone');
  assert.equal(britishise('Update the program.'), 'Update the program.', 'meaning-sensitive words are left alone');
});

test('already-British text produces no issues', () => {
  assert.deepEqual(detectAmericanisms('The colour of the centre catalogue is grey.'), []);
});

test('the word map has no identity mappings', () => {
  for (const [from, to] of Object.entries(WORD_MAP)) {
    assert.notEqual(from, to, `${from} maps to itself`);
  }
});
