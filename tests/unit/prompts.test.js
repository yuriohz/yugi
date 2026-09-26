import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeSystemPrompt, composeUserMessage, profileLayer, platformLayer, outputLayer,
  SAFETY_LAYER, FIDELITY_LAYER, ANTI_SLOP_LAYER, LAYER_ORDER
} from '../../src/core/prompts.js';
import { detectSlop } from '../../src/core/slop-detector.js';
import { wrapUntrusted } from '../../src/core/untrusted.js';

const OUTPUT = { schemaDescription: 'Shape: {"proposal":string}', notes: ['One note.'] };

test('layer order is fixed and safety comes first', () => {
  assert.deepEqual(LAYER_ORDER, ['safety', 'fidelity', 'antiSlop', 'mode', 'profile', 'locale', 'platform', 'output']);
  const prompt = composeSystemPrompt({ mode: '# Mode\nBe brief.', output: OUTPUT });
  assert.ok(prompt.startsWith(SAFETY_LAYER));
  assert.ok(prompt.indexOf(FIDELITY_LAYER) < prompt.indexOf(ANTI_SLOP_LAYER));
  assert.ok(prompt.indexOf(ANTI_SLOP_LAYER) < prompt.indexOf('# Mode'));
  assert.ok(prompt.indexOf('# Mode') < prompt.indexOf('# Response contract'));
});

test('composition is pure and deterministic', () => {
  const args = { mode: '# Mode\nx', profile: { name: 'Work' }, locale: '# Locale\ny', output: OUTPUT };
  assert.equal(composeSystemPrompt(args), composeSystemPrompt(args));
});

test('safety layer forbids invention and false assurance', () => {
  for (const phrase of [
    'Never invent facts', 'deadlines', 'undetectable', 'guaranteed human',
    'guaranteed correct', 'Never tell the user they are right'
  ]) {
    assert.ok(SAFETY_LAYER.includes(phrase), `safety layer missing: ${phrase}`);
  }
});

test('fidelity layer names everything that must survive', () => {
  for (const phrase of ['number', 'URL', 'email address', '@handle', 'technical term', 'commitment', 'position']) {
    assert.ok(FIDELITY_LAYER.includes(phrase), `fidelity layer missing: ${phrase}`);
  }
});

test('anti-slop layer is attributed and covers the upstream families', () => {
  assert.match(ANTI_SLOP_LAYER, /No AI Slop editing skill by Peter Yang \(MIT licence\)/);
  for (const phrase of [
    'Binary contrast', 'Throat-clearing', 'Faux-insight', 'Colon reveals',
    'Superficial analysis', 'Importance puffery', 'Interpretive metadiscourse',
    'Weasel attribution', 'Fake-strong verbs', 'Synonym cycling', 'Negative listing',
    'Fake-profound kickers', 'Summary-recap', 'Formatting slop', 'Em dashes',
    'delve', 'portability test', 'Over-correction is a failure'
  ]) {
    assert.ok(ANTI_SLOP_LAYER.includes(phrase), `anti-slop layer missing: ${phrase}`);
  }
});

test('anti-slop layer forbids inventing substance for hollow passages', () => {
  assert.match(ANTI_SLOP_LAYER, /flag it in warnings rather than inventing substance/);
});

test('empty layers are omitted rather than leaving blank sections', () => {
  const prompt = composeSystemPrompt({ output: OUTPUT });
  assert.ok(!prompt.includes('\n\n\n'));
  assert.ok(!prompt.includes('# Writer profile'));
  assert.ok(!prompt.includes('# Platform constraints'));
});

test('profile layer renders voice, terminology and protected terms', () => {
  const layer = profileLayer({
    name: 'Work',
    audience: 'Enterprise clients',
    voiceDescription: 'Blunt, short sentences',
    formality: 3,
    directness: 4,
    contractions: false,
    emoji: false,
    preferredTerms: ['rollout'],
    blockedTerms: ['synergy'],
    protectedTerms: ['Yugi-7', 'ISO 27001'],
    samples: ['We ship on Thursday. No extension.']
  });
  assert.match(layer, /Profile: Work/);
  assert.match(layer, /Formality: formal/);
  assert.match(layer, /Directness: very direct/);
  assert.match(layer, /Do not use contractions/);
  assert.match(layer, /Never add emoji/);
  assert.match(layer, /PROTECTED TERMS/);
  assert.match(layer, /Yugi-7, ISO 27001/);
  assert.match(layer, /Do not copy their content, topics, or facts/);
});

test('profile layer caps voice samples at five', () => {
  const layer = profileLayer({ samples: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.equal((layer.match(/^Sample \d+:/gm) || []).length, 5);
});

test('platform layer bans Markdown for plain-text destinations', () => {
  const layer = platformLayer({ name: 'WhatsApp Web', plainText: true, singleParagraph: true });
  assert.match(layer, /Do not return Markdown/);
  assert.match(layer, /single paragraph/);
});

test('output layer forbids the prohibited assurance vocabulary', () => {
  const layer = outputLayer(OUTPUT);
  assert.match(layer, /Return one JSON object and nothing else/);
  assert.match(layer, /"undetectable"/);
  assert.match(layer, /"you are right"/);
});

test('the untrusted contract appears only when untrusted data is present', () => {
  assert.ok(!composeSystemPrompt({ output: OUTPUT }).includes('# Untrusted data'));
  assert.ok(composeSystemPrompt({ output: OUTPUT, hasUntrustedData: true }).includes('# Untrusted data'));
});

test('locally detected patterns are passed as candidates, not orders', () => {
  const findings = detectSlop('We must leverage the robust platform.');
  const prompt = composeSystemPrompt({ output: OUTPUT, findings });
  assert.match(prompt, /# Patterns detected locally in this text/);
  assert.match(prompt, /candidates, not orders/);
  assert.match(prompt, /banned-word/);
});

test('user message places untrusted blocks before the user text', () => {
  const { block } = wrapUntrusted('prior message', { label: 'nearby conversation', source: 'slack.com' });
  const message = composeUserMessage({ text: 'my draft', instruction: 'Rewrite it.', untrustedBlocks: [block] });
  assert.ok(message.indexOf('Rewrite it.') < message.indexOf(block));
  assert.ok(message.indexOf(block) < message.indexOf('# The user’s own text to work on'));
  assert.ok(message.trim().endsWith('my draft'));
});
