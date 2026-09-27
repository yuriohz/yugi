import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { APP_NAME, OPENROUTER_HEADERS, PUBLIC_NAME_STATUS, MESSAGES, STORAGE_KEYS } from '../../src/core/constants.js';
import { EXPORT_FORMAT } from '../../src/core/transfer.js';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('approved public brand is used by shared app metadata', () => {
  assert.equal(APP_NAME, 'WordSaffron');
  assert.equal(PUBLIC_NAME_STATUS, 'approved');
  assert.equal(OPENROUTER_HEADERS['X-Title'], 'WordSaffron Chrome Extension');
});

test('manifest and extension surfaces use the approved name and mark', () => {
  const manifest = JSON.parse(read('src/manifest.json'));
  assert.equal(manifest.name, 'WordSaffron — AI Writing Assistant');
  assert.equal(manifest.action.default_title, 'WordSaffron');
  for (const file of ['src/ui/popup.html', 'src/ui/options.html', 'src/ui/onboarding.html']) {
    const html = read(file);
    assert.match(html, /WordSaffron/);
    assert.match(html, /src="icons\/icon(?:48|128)\.png"/);
    assert.doesNotMatch(html, /WriteRight/);
  }
  for (const size of [16, 32, 48, 128]) {
    const path = `icons/icon${size}.png`;
    assert.ok(existsSync(new URL(`../../${path}`, import.meta.url)), `${path} exists`);
    const icon = readFileSync(new URL(`../../${path}`, import.meta.url));
    assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.deepEqual(icon, readFileSync(new URL(`../../brand-assets/word-saffron-mark-${size}.png`, import.meta.url)));
  }
});

test('the rollout keeps historical runtime and settings identifiers intact', () => {
  assert.equal(MESSAGES.RUN_TASK, 'WR_RUN_TASK');
  assert.equal(STORAGE_KEYS.SETTINGS, 'settings');
  assert.equal(EXPORT_FORMAT, 'writeright.settings');
  assert.match(read('src/content/content.js'), /window\.__writeRightLoaded/);
  assert.match(read('src/content/content.css'), /\.wr-/);
  assert.match(read('src/ui/options.js'), /writeright-settings\.json/);
});

test('store and release documents use the approved brand with no working-name leakage', () => {
  for (const file of [
    'STORE_LISTING.md',
    'PRIVACY_POLICY.md',
    'docs/PERMISSIONS.md',
    'docs/SUBMISSION_CHECKLIST.md',
    'docs/RELEASE_NOTES.md',
    'README.md',
    'WORDSAFFRON_MARKETING_COPY.md',
    'THIRD_PARTY_NOTICES.md',
    'tests/browser/README.md',
    'design-v2/README.md',
    'store-assets/README.md'
  ]) {
    const text = read(file);
    assert.match(text, /WordSaffron/, `${file} names WordSaffron`);
    assert.doesNotMatch(text, /WriteRight/, `${file} has no working-name leakage`);
    assert.doesNotMatch(text, /writeright/, `${file} has no lowercase working-name leakage`);
  }
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'wordsaffron-extension');
  assert.match(pkg.description, /WordSaffron/);
  assert.doesNotMatch(read('build.js'), /WriteRight/);
});

test('store mockup SVG/PNG pairs are rebranded, labelled, and correctly sized', () => {
  const pairs = [
    ['store-assets/promo-small', 440, 280],
    ['store-assets/promo-marquee', 1400, 560],
    ['store-assets/screenshot-1-whatsapp', 1280, 800],
    ['store-assets/screenshot-2-setup', 1280, 800],
    ['store-assets/screenshot-3-privacy', 1280, 800]
  ];
  for (const [base, width, height] of pairs) {
    const svg = read(`${base}.svg`);
    assert.ok(svg.startsWith('<svg'), `${base}.svg is an SVG document`);
    assert.ok(svg.trimEnd().endsWith('</svg>'), `${base}.svg is complete`);
    assert.match(svg, /WordSaffron/, `${base}.svg names WordSaffron`);
    assert.doesNotMatch(svg, /WriteRight/, `${base}.svg has no working-name leakage`);
    assert.match(svg, /NOT A RUNTIME SCREENSHOT/, `${base}.svg keeps its mockup disclaimer`);
    const png = readFileSync(new URL(`../../${base}.png`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), width, `${base}.png width`);
    assert.equal(png.readUInt32BE(20), height, `${base}.png height`);
  }
});

test('design-v2 mockup SVG/PNG pairs are rebranded and correctly sized', () => {
  const files = [
    '01-rewrite-modes', '02-rewrite-compare', '03-technical-review',
    '04-prompt-library', '05-custom-mode', '06-onboarding'
  ];
  for (const name of files) {
    const svg = read(`design-v2/${name}.svg`);
    assert.ok(svg.startsWith('<svg'), `${name}.svg is an SVG document`);
    assert.ok(svg.trimEnd().endsWith('</svg>'), `${name}.svg is complete`);
    assert.doesNotMatch(svg, /WriteRight/, `${name}.svg has no working-name leakage`);
    assert.doesNotMatch(svg, /WRITERIGHT/, `${name}.svg has no uppercase working-name leakage`);
    assert.match(svg, /NOT A RUNTIME SCREENSHOT/, `${name}.svg keeps its mockup disclaimer`);
    const png = readFileSync(new URL(`../../design-v2/${name}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 1440, `${name}.png width`);
    assert.equal(png.readUInt32BE(20), 900, `${name}.png height`);
  }
});

test('historical planning documents keep rename notes and the debrief records the rollout', () => {
  for (const file of ['EXECUTION_PLAN.md', 'IMPLEMENTATION_STATUS.md', 'PRODUCT_PLAN_V2.md']) {
    const text = read(file);
    assert.match(text, /Rename note/, `${file} explains the working-name history`);
    assert.match(text, /WordSaffron/, `${file} names the approved brand`);
  }
  const debrief = read('DEBRIEF_FOR_OPUS.md');
  assert.match(debrief, /# WordSaffron — Engineering and Product Debrief/);
  assert.match(debrief, /arena\/01a0deeb-yugi/);
  assert.match(debrief, /WordSaffron brand rollout addendum/);
});
