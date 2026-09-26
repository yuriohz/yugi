/**
 * Custom modes and saved prompts.
 *
 * A custom mode is user-authored text that becomes part of a system prompt.
 * That makes it the single most dangerous input in the product, so it is
 * validated hard: it can shape style, it cannot relax safety.
 *
 * The prompt composer already places mode text *after* the safety, fidelity
 * and anti-slop layers, so a later instruction cannot override an earlier one.
 * This module is the second line of defence: instructions that try to escape
 * are rejected before they are ever stored.
 */
import { OPERATION, GUARDRAILS, RESEARCH_POLICY, BUILT_IN_MODES, isBuiltIn } from './modes.js';
import { LOCALES } from './constants.js';

export const LIMITS_MODE = Object.freeze({
  NAME: 40,
  SUMMARY: 80,
  DESCRIPTION: 240,
  INSTRUCTION: 4000,
  MODES: 50,
  PROMPTS: 100,
  PROMPT_BODY: 2000,
  TEST_CASES: 3,
  TEST_INPUT: 2000
});

/**
 * Instructions that attempt to unset the product's guarantees. Refused, with
 * the reason shown, rather than silently ignored — a user who wrote this needs
 * to know it will not work.
 */
const FORBIDDEN_INSTRUCTIONS = [
  { re: /ignore (?:all |any )?(?:previous|prior|above|earlier|the) (?:instructions?|rules?|guardrails?|constraints?)/i, why: 'A mode cannot override WriteRight’s safety rules.' },
  { re: /disregard (?:all |any )?(?:previous|prior|above|safety|the) /i, why: 'A mode cannot override WriteRight’s safety rules.' },
  { re: /\byou are (?:now )?(?:no longer|not) an? editor\b/i, why: 'A mode cannot change what WriteRight is.' },
  { re: /\b(?:invent|make up|fabricate|imagine)\b[^.\n]{0,40}\b(?:facts?|sources?|citations?|quotes?|statistics?|evidence|data)\b/i, why: 'A mode cannot ask WriteRight to invent facts, sources or evidence.' },
  { re: /\badd\b[^.\n]{0,30}\b(?:fake|fictional|invented|made-up)\b/i, why: 'A mode cannot ask WriteRight to add invented material.' },
  { re: /\b(?:undetectable|bypass(?:es)? ai detection|pass(?:es)? (?:as )?human|evade detection|avoid ai detect)/i, why: 'WriteRight does not claim to make writing undetectable, and a mode cannot ask it to try.' },
  { re: /\b(?:reveal|print|output|show|repeat)\b[^.\n]{0,30}\b(?:system prompt|your instructions|api key)\b/i, why: 'A mode cannot ask WriteRight to reveal its instructions or credentials.' },
  { re: /\bpretend (?:to be|you are)\b[^.\n]{0,40}\b(?:person|human|lawyer|doctor|accountant)\b/i, why: 'A mode cannot ask WriteRight to impersonate a real profession or person.' },
  { re: /\bimpersonate\b/i, why: 'A mode cannot ask WriteRight to impersonate anyone.' },
  { re: /\balways (?:say|tell)\b[^.\n]{0,30}\b(?:the user is right|they are right|yes)\b/i, why: 'WriteRight never tells the writer they are right on request.' }
];

export function makeCustomMode(patch = {}) {
  return {
    id: patch.id || `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    builtIn: false,
    name: patch.name || 'New mode',
    summary: patch.summary || '',
    description: patch.description || '',
    icon: patch.icon || 'sparkle',
    colour: /^#[0-9a-f]{6}$/i.test(patch.colour || '') ? patch.colour : '#4B5563',
    operation: Object.values(OPERATION).includes(patch.operation) ? patch.operation : OPERATION.REWRITE,
    arabicRegister: patch.arabicRegister === LOCALES.AR_EG ? LOCALES.AR_EG : LOCALES.AR,
    researchPolicy: Object.values(RESEARCH_POLICY).includes(patch.researchPolicy) ? patch.researchPolicy : RESEARCH_POLICY.OFF,
    guardrails: normaliseGuardrails(patch.guardrails),
    controls: patch.controls || { length: true, defaultLength: 'same' },
    instruction: patch.instruction || '',
    mustNot: Array.isArray(patch.mustNot) ? patch.mustNot.slice(0, 20) : [],
    testCases: Array.isArray(patch.testCases) ? patch.testCases.slice(0, LIMITS_MODE.TEST_CASES) : [],
    createdAt: patch.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

/** Guardrails a user may not switch off. */
const MANDATORY_GUARDRAILS = [GUARDRAILS.PRESERVE_FACTS, GUARDRAILS.NEVER_AUTO_APPLY];

function normaliseGuardrails(list) {
  const valid = new Set(Object.values(GUARDRAILS));
  const chosen = new Set((Array.isArray(list) ? list : []).filter(g => valid.has(g)));
  for (const g of MANDATORY_GUARDRAILS) chosen.add(g);
  return [...chosen];
}

/**
 * @returns {{ok: boolean, mode: object|null, errors: string[], warnings: string[]}}
 */
export function validateCustomMode(input, { existing = [] } = {}) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object') return { ok: false, mode: null, errors: ['A mode must be an object.'], warnings };

  const name = text(input.name, LIMITS_MODE.NAME);
  if (!name) errors.push('Give the mode a name.');
  if (isBuiltIn(input.id)) errors.push(`“${input.id}” is a built-in mode. Duplicate it instead of overwriting it.`);
  if (BUILT_IN_MODES.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    errors.push(`“${name}” is the name of a built-in mode. Choose another name.`);
  }
  if (existing.some(m => m.id !== input.id && m.name.toLowerCase() === name.toLowerCase())) {
    errors.push(`You already have a mode called “${name}”.`);
  }

  const instruction = text(input.instruction, LIMITS_MODE.INSTRUCTION);
  if (instruction.length < 20) errors.push('Describe what the mode should do, in at least a sentence.');

  for (const rule of FORBIDDEN_INSTRUCTIONS) {
    if (rule.re.test(instruction)) errors.push(rule.why);
  }

  if (String(input.instruction || '').length > LIMITS_MODE.INSTRUCTION) {
    warnings.push(`The instruction was shortened to ${LIMITS_MODE.INSTRUCTION} characters.`);
  }

  const requested = new Set(Array.isArray(input.guardrails) ? input.guardrails : []);
  for (const g of MANDATORY_GUARDRAILS) {
    if (!requested.has(g) && requested.size) {
      warnings.push(`The “${g}” guardrail is always on and was added back.`);
    }
  }

  if (input.researchPolicy === RESEARCH_POLICY.REQUIRED && input.operation === OPERATION.REWRITE) {
    warnings.push('A rewrite mode cannot require research. Research runs in review, and its findings feed a separate rewrite.');
  }

  const mode = makeCustomMode({
    ...input,
    name,
    summary: text(input.summary, LIMITS_MODE.SUMMARY),
    description: text(input.description, LIMITS_MODE.DESCRIPTION),
    instruction: instruction.startsWith('# Mode:') ? instruction : `# Mode: ${name}\n${instruction}`,
    mustNot: (Array.isArray(input.mustNot) ? input.mustNot : []).map(m => text(m, 200)).filter(Boolean),
    testCases: normaliseTestCases(input.testCases, warnings)
  });

  return { ok: errors.length === 0, mode: errors.length ? null : mode, errors, warnings };
}

function normaliseTestCases(list, warnings) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const input = text(raw?.input, LIMITS_MODE.TEST_INPUT);
    if (!input) continue;
    out.push({
      id: raw?.id || `t-${out.length + 1}`,
      label: text(raw?.label, 60) || `Case ${out.length + 1}`,
      input,
      expectations: (Array.isArray(raw?.expectations) ? raw.expectations : []).map(e => text(e, 200)).filter(Boolean).slice(0, 6)
    });
    if (out.length >= LIMITS_MODE.TEST_CASES) {
      warnings.push(`Only the first ${LIMITS_MODE.TEST_CASES} test cases were kept.`);
      break;
    }
  }
  return out;
}

function text(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

/** Render the mode's must-not list into the instruction the model sees. */
export function renderModeInstruction(mode) {
  const lines = [mode.instruction];
  if (mode.mustNot?.length) {
    lines.push('', 'Must not:');
    for (const item of mode.mustNot) lines.push(`- must not ${item.replace(/^must not\s*/i, '')}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------- saved prompts

export function makePrompt(patch = {}) {
  return {
    id: patch.id || `pr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: patch.name || 'Saved prompt',
    body: patch.body || '',
    modeId: patch.modeId || null,
    tags: Array.isArray(patch.tags) ? patch.tags.slice(0, 8).map(t => text(t, 30)) : [],
    createdAt: patch.createdAt || Date.now(),
    updatedAt: Date.now(),
    useCount: Number(patch.useCount) || 0
  };
}

export function validatePrompt(input, { existing = [] } = {}) {
  const errors = [];
  const name = text(input?.name, 60);
  const body = text(input?.body, LIMITS_MODE.PROMPT_BODY);
  if (!name) errors.push('Give the prompt a name.');
  if (body.length < 5) errors.push('The prompt is empty.');
  if (existing.some(p => p.id !== input?.id && p.name.toLowerCase() === name.toLowerCase())) {
    errors.push(`You already have a prompt called “${name}”.`);
  }
  for (const rule of FORBIDDEN_INSTRUCTIONS) {
    if (rule.re.test(body)) errors.push(rule.why);
  }
  return { ok: errors.length === 0, prompt: errors.length ? null : makePrompt({ ...input, name, body }), errors };
}

/** Substitute {{selection}} and {{clipboard}}-style placeholders. */
export function expandPrompt(body, values = {}) {
  return String(body ?? '').replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function promptPlaceholders(body) {
  return [...new Set([...String(body ?? '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
}
