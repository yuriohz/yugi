import test from 'node:test';
import assert from 'node:assert/strict';
import { detectScript, resolveLocale, localeLayerFor, looksEgyptian, localeName } from '../../src/core/locale.js';
import {
  baseDirection, resolveDirection, isolateRuns, stripIsolates,
  directionAttributes, checkTerminalPunctuation, detectLatinPunctuationInArabic, FSI, PDI
} from '../../src/core/bidi.js';
import { getBuiltInMode } from '../../src/core/modes.js';
import { LOCALES } from '../../src/core/constants.js';

const AR = 'أرجو إرسال التقرير غداً.';
const EG = 'ابعتلي التقرير بكرة لو سمحت، عايز أراجعه.';
const MIXED = 'الرجاء مراجعة التقرير على https://example.test/report قبل الاجتماع.';

// ---- script detection ----------------------------------------------------

test('script detection distinguishes Arabic, Latin and mixed', () => {
  assert.equal(detectScript(AR).script, 'arabic');
  assert.equal(detectScript('Send the report tomorrow.').script, 'latin');
  assert.equal(detectScript(MIXED).script, 'mixed');
  assert.equal(detectScript('12345 ... !').script, 'unknown');
});

test('mixed content resolves to the dominant script', () => {
  assert.equal(detectScript(MIXED).dominant, 'arabic');
  assert.equal(detectScript('Please review تقرير before Friday.').dominant, 'latin');
});

test('Egyptian markers are recognised', () => {
  assert.equal(looksEgyptian(EG), true);
  assert.equal(looksEgyptian(AR), false);
});

// ---- register selection --------------------------------------------------

test('Casual targets Egyptian Arabic and the other modes target MSA', () => {
  assert.equal(resolveLocale({ text: AR, mode: getBuiltInMode('casual') }).locale, LOCALES.AR_EG);
  for (const id of ['polish', 'polite', 'professional-firm', 'technical-review']) {
    assert.equal(resolveLocale({ text: AR, mode: getBuiltInMode(id) }).locale, LOCALES.AR, id);
  }
});

test('the script of the text overrides the configured locale', () => {
  const resolved = resolveLocale({ text: AR, settings: { locale: 'en-GB' }, mode: getBuiltInMode('polish') });
  assert.equal(resolved.locale, LOCALES.AR);
  assert.equal(resolved.direction, 'rtl');
});

test('English text stays British even when the profile is Arabic-configured', () => {
  const resolved = resolveLocale({ text: 'Send the report.', settings: { locale: 'ar' }, mode: getBuiltInMode('polish') });
  assert.equal(resolved.locale, 'en-GB');
  assert.equal(resolved.direction, 'ltr');
});

test('an empty field falls back to the configured locale', () => {
  assert.equal(resolveLocale({ text: '', settings: { locale: 'ar' }, mode: getBuiltInMode('polite') }).locale, LOCALES.AR);
  assert.equal(resolveLocale({ text: '' }).locale, 'en-GB');
});

test('an explicit per-profile dialect wins over the mode default', () => {
  const egyptian = { locale: LOCALES.AR_EG };
  const msa = { locale: LOCALES.AR };
  assert.equal(resolveLocale({ text: AR, profile: egyptian, mode: getBuiltInMode('polish') }).locale, LOCALES.AR_EG);
  assert.equal(resolveLocale({ text: AR, profile: msa, mode: getBuiltInMode('casual') }).locale, LOCALES.AR);
  assert.equal(resolveLocale({ text: AR, profile: { locale: 'en-GB' }, mode: getBuiltInMode('casual') }).locale, LOCALES.AR_EG);
  assert.equal(resolveLocale({ text: AR, profile: { locale: 'xx' }, mode: getBuiltInMode('casual') }).locale, LOCALES.AR_EG);
});

test('locale names are human readable in both scripts', () => {
  assert.match(localeName(LOCALES.AR), /Modern Standard Arabic/);
  assert.match(localeName(LOCALES.AR_EG), /Egyptian Arabic/);
});

// ---- prompt layers -------------------------------------------------------

test('the MSA layer instructs plain Arabic and protects Latin terms', () => {
  const layer = localeLayerFor({ text: AR, mode: getBuiltInMode('polite') });
  assert.match(layer, /Modern Standard Arabic/);
  assert.match(layer, /Do not translate names, product names, technical terms, code, or URLs/);
  assert.match(layer, /Do not convert between/);
});

test('the Egyptian layer forbids inventing colloquialism', () => {
  const layer = localeLayerFor({ text: EG, mode: getBuiltInMode('casual') });
  assert.match(layer, /natural Egyptian Arabic/);
  assert.match(layer, /Do not invent slang or force colloquialism/);
  assert.match(layer, /Not Modern Standard Arabic/);
});

test('mixed content adds explicit direction and no-transliteration instructions', () => {
  const layer = localeLayerFor({ text: MIXED, mode: getBuiltInMode('polish') });
  assert.match(layer, /mixes Arabic and Latin script/);
  assert.match(layer, /Do not transliterate them into Arabic/);
  assert.match(layer, /right-to-left/);
});

test('the British layer names the specific conventions', () => {
  const layer = localeLayerFor({ text: 'Send the report.' });
  for (const rule of ['-ise and -isation', '-our', '-re', 'doubled l', '14 March 2026']) {
    assert.ok(layer.includes(rule), `missing: ${rule}`);
  }
});

// ---- direction -----------------------------------------------------------

test('base direction uses the first strong character', () => {
  assert.equal(baseDirection(AR), 'rtl');
  assert.equal(baseDirection('Hello'), 'ltr');
  assert.equal(baseDirection('123 ' + AR), 'rtl');
  assert.equal(baseDirection('!?.'), 'ltr');
});

test('field direction follows the dominant script, not the first character', () => {
  const result = resolveDirection('OpenRouter ' + AR);
  assert.equal(result.direction, 'rtl');
  assert.equal(result.mixed, true);
});

test('predominantly English text with one Arabic word stays LTR', () => {
  assert.equal(resolveDirection('Please review the تقرير before Friday afternoon.').direction, 'ltr');
});

// ---- isolation -----------------------------------------------------------

test('Latin runs inside Arabic are isolated', () => {
  const out = isolateRuns(MIXED);
  assert.ok(out.includes(FSI + 'https://example.test/report' + PDI));
});

test('isolation covers emails, code spans, paths and handles', () => {
  const out = isolateRuns('راسل ali@example.test أو شوف `npm run build` في src/core/app.js مع @ali_h');
  assert.ok(out.includes(FSI + 'ali@example.test' + PDI));
  assert.ok(out.includes(FSI + '`npm run build`' + PDI));
  assert.ok(out.includes(FSI + '@ali_h' + PDI));
});

test('pure Latin text is never altered', () => {
  const text = 'See https://example.test/report before Friday.';
  assert.equal(isolateRuns(text), text);
});

test('isolation is presentational and fully reversible', () => {
  assert.equal(stripIsolates(isolateRuns(MIXED)), MIXED);
});

test('direction attributes isolate the container', () => {
  const attrs = directionAttributes(AR);
  assert.equal(attrs.dir, 'rtl');
  assert.equal(attrs.lang, 'ar');
  assert.match(attrs.style, /unicode-bidi:isolate/);
  assert.match(attrs.style, /text-align:right/);
  assert.equal(directionAttributes('Hello').dir, 'ltr');
});

// ---- Arabic punctuation --------------------------------------------------

test('a Latin question mark at the end of Arabic text is corrected', () => {
  const result = checkTerminalPunctuation('هل أرسلت التقرير?');
  assert.equal(result.ok, false);
  assert.ok(result.suggestion.endsWith('؟'));
});

test('correct Arabic terminal punctuation passes', () => {
  assert.equal(checkTerminalPunctuation('هل أرسلت التقرير؟').ok, true);
  assert.equal(checkTerminalPunctuation('Did you send it?').ok, true);
});

test('Latin commas inside Arabic are flagged with exact offsets', () => {
  const text = 'أرسلت التقرير, وأرفقت الفاتورة.';
  const [issue] = detectLatinPunctuationInArabic(text);
  assert.equal(issue.original, ',');
  assert.equal(issue.replacement, '،');
  assert.equal(text.slice(issue.start, issue.end), ',');
});

test('commas inside an embedded English clause are left alone', () => {
  assert.deepEqual(detectLatinPunctuationInArabic('استخدم Alpha, Beta and Gamma في التقرير.'), []);
});
