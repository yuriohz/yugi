import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts, extractNames, checkFidelity, normaliseDigits, normaliseArabic } from '../../src/core/fidelity.js';

const kinds = text => extractFacts(text).map(f => `${f.kind}:${f.value}`);

test('extracts numbers, money, percentages, dates, times and identifiers', () => {
  const found = kinds('Invoice 4821 for $1,250.00 is 15% down, due 14 March 2026 at 09:30. See WR-318.');
  assert.ok(found.includes('number:4821'));
  assert.ok(found.some(f => f.startsWith('currency:$1250.00')));
  assert.ok(found.includes('percent:15%'));
  assert.ok(found.some(f => f.startsWith('date:14 march')));
  assert.ok(found.includes('time:09:30'));
  assert.ok(found.includes('identifier:WR-318'));
});

test('extracts URLs, emails and handles without double-counting their digits', () => {
  const found = kinds('Ping @ali_h or ali@example.test, spec at https://example.test/v2/spec?id=7');
  assert.ok(found.includes('handle:@ali_h'));
  assert.ok(found.includes('email:ali@example.test'));
  assert.ok(found.some(f => f.startsWith('url:https://example.test/v2/spec?id=7')));
  assert.equal(found.filter(f => f === 'number:7').length, 0, 'the id inside the URL must not be counted separately');
});

test('a dropped number is reported as an error', () => {
  const r = checkFidelity('We need 12 licences by Friday.', 'We need licences by Friday.');
  assert.equal(r.ok, false);
  assert.equal(r.missing[0].value, '12');
  assert.match(r.warnings[0].message, /is missing from the rewrite/);
});

test('a changed number is reported as both dropped and invented', () => {
  const r = checkFidelity('The fee is $450.', 'The fee is $540.');
  assert.equal(r.ok, false);
  assert.ok(r.missing.some(f => f.value === '$450'));
  assert.ok(r.added.some(f => f.value === '$540'));
});

test('a dropped URL is reported', () => {
  const r = checkFidelity('Spec: https://example.test/a', 'The spec is attached.');
  assert.equal(r.missing[0].kind, 'url');
});

test('an invented deadline is caught', () => {
  const r = checkFidelity('I will send the report.', 'I will send the report by 14 March 2026.');
  assert.equal(r.ok, false);
  assert.ok(r.added.some(f => f.kind === 'date'));
  assert.match(r.warnings.find(w => w.code === 'fact_added').message, /introduces a date that was not in your text/);
});

test('a clean rewrite passes', () => {
  const r = checkFidelity(
    'We must leverage the robust pipeline to ship 12 features by 14 March 2026.',
    'We must use the new pipeline to ship 12 features by 14 March 2026.'
  );
  assert.equal(r.ok, true, JSON.stringify(r.warnings));
});

test('a number spelled out in the source is not treated as invented', () => {
  const r = checkFidelity('We need three licences.', 'We need 3 licences.');
  assert.equal(r.added.length, 0);
});

test('protected terms are checked separately and reported clearly', () => {
  const r = checkFidelity('Deploy Yugi-7 tonight.', 'Deploy the controller tonight.', { protectedTerms: ['Yugi-7'] });
  assert.deepEqual(r.protectedLost, ['Yugi-7']);
  assert.equal(r.ok, false);
});

test('a dropped proper noun is a risk, not a hard error', () => {
  const r = checkFidelity('Ask Mariam about the audit.', 'Ask the team about the audit.');
  assert.deepEqual(r.namesLost, ['Mariam']);
  assert.equal(r.warnings.find(w => w.code === 'name_dropped').severity, 'risk');
  assert.equal(r.ok, true, 'names are advisory because the extractor is approximate');
});

test('extractNames finds product names with internal capitals or digits', () => {
  const names = extractNames('We upgraded to PostgreSQL and the Yugi7 board.');
  assert.ok(names.includes('PostgreSQL'));
  assert.ok(names.includes('Yugi7'));
});

// ---- Arabic --------------------------------------------------------------

test('Arabic-Indic digits normalise to Western digits', () => {
  assert.equal(normaliseDigits('٤٥٠'), '450');
  assert.equal(normaliseDigits('۱۲۳'), '123');
});

test('an amount written in Arabic-Indic digits matches the same amount in Western digits', () => {
  const r = checkFidelity('المبلغ ٤٥٠ دولاراً.', 'المبلغ 450 دولاراً.', { arabic: true });
  assert.equal(r.ok, true, JSON.stringify(r.warnings));
});

test('a dropped Arabic-Indic number is still caught', () => {
  const r = checkFidelity('المبلغ ٤٥٠ دولاراً.', 'المبلغ مستحق.', { arabic: true });
  assert.equal(r.ok, false);
  assert.equal(r.missing[0].value, '450');
});

test('Arabic orthographic variants are not treated as meaning changes', () => {
  assert.equal(normaliseArabic('إلى'), normaliseArabic('الي'));
  const r = checkFidelity('أرسلت التقرير إلى أحمد.', 'ارسلت التقرير الي احمد.', { arabic: true });
  assert.equal(r.ok, true);
});

test('a Latin term inside Arabic must survive', () => {
  const r = checkFidelity('استخدم OpenRouter مع المفتاح.', 'استخدم الخدمة مع المفتاح.', { protectedTerms: ['OpenRouter'], arabic: true });
  assert.deepEqual(r.protectedLost, ['OpenRouter']);
});
