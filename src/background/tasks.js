/**
 * Task builders: prompt composition plus task-specific post-processing.
 *
 * A builder returns:
 *   { body, timeoutMs, context, postProcess?, warnings? }
 *
 * Schema validation happens in the router, against `src/core/task-schemas.js`,
 * so the prompt description and the validator can never drift apart.
 */
import { TASKS, LIMITS } from '../core/constants.js';
import { composeSystemPrompt, composeUserMessage } from '../core/prompts.js';
import { schemaDescriptionFor } from '../core/task-schemas.js';
import { detectSlop } from '../core/slop-detector.js';
import { ApiError } from './openrouter.js';

const builders = Object.create(null);

export function registerTask(task, builder) { builders[task] = builder; }
export function registeredTasks() { return Object.keys(builders); }

export async function buildRequest(payload) {
  const builder = builders[payload.task];
  if (!builder) {
    throw new ApiError(
      `Task "${payload.task}" is not available in this build.`,
      { code: 'not_implemented' }
    );
  }
  return builder(payload);
}

/**
 * Shared request-body assembly. Honours the capability plan: `response_format`
 * is only sent when the model advertises support, because some providers reject
 * the field outright.
 */
export function baseBody({ model, plan, messages, temperature = 0.2, maxTokens, tools }) {
  const body = { model, temperature, messages };
  if (plan?.useResponseFormat !== false) body.response_format = { type: 'json_object' };
  if (maxTokens) body.max_tokens = maxTokens;
  if (tools?.length) body.tools = tools;
  // Ask OpenRouter to include accounting so cost can be reported rather than guessed.
  body.usage = { include: true };
  return body;
}

// ---------------------------------------------------------------- proofread

registerTask(TASKS.PROOFREAD, ({ text, settings, model, plan, profile, localeLayer, platform }) => {
  const protectedTerms = profile?.protectedTerms || [];
  const system = composeSystemPrompt({
    mode: PROOFREAD_MODE,
    profile,
    locale: localeLayer,
    platform,
    output: {
      schemaDescription: schemaDescriptionFor(TASKS.PROOFREAD),
      notes: ['Report only clear errors. Never rewrite for preference, tone, or style.']
    }
  });

  return {
    timeoutMs: LIMITS.REQUEST_TIMEOUT_MS,
    context: { text, protectedTerms },
    body: baseBody({
      model,
      plan,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: composeUserMessage({ text }) }
      ]
    }),
    postProcess: (value, context) => ({
      issues: validateIssues(value.issues, context.text, context.protectedTerms)
    })
  };
});

const PROOFREAD_MODE = [
  '# Task: proofread',
  'Find clear errors only: spelling, grammar, punctuation, and outright clarity faults such as a broken sentence.',
  'Do not restyle, retone, shorten, lengthen, or improve anything that is already correct.',
  'Do not touch names, numbers, URLs, quoted text, code, or technical terms.',
  'If a passage is correct but you would have written it differently, leave it alone.'
].join('\n');

/**
 * Offsets from a model are untrusted. Anything that does not describe a real
 * slice of the submitted text is dropped, not repaired, because a repaired
 * offset silently edits the wrong words.
 */
export function validateIssues(issues, text, protectedTerms = []) {
  if (!Array.isArray(issues)) return [];
  const seen = new Set();
  const out = [];

  for (const issue of issues) {
    const { start, end } = issue || {};
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (start < 0 || end > text.length || end <= start) continue;

    const actual = text.slice(start, end);
    if (typeof issue.original === 'string' && issue.original !== actual) continue;
    if (typeof issue.replacement !== 'string') continue;
    if (issue.replacement === actual) continue;

    // A correction may not alter a protected term.
    if (protectedTerms.some(term => term && actual.includes(term) && !issue.replacement.includes(term))) continue;

    const key = `${start}:${end}:${issue.replacement}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      start,
      end,
      original: actual,
      replacement: issue.replacement,
      message: issue.message || 'Suggested correction',
      category: issue.category || 'grammar'
    });
    if (out.length >= 50) break;
  }

  // Drop overlaps: the later issue in document order loses, because applying
  // both would corrupt the text.
  const sorted = out.sort((a, b) => a.start - b.start);
  const result = [];
  let lastEnd = -1;
  for (const issue of sorted) {
    if (issue.start < lastEnd) continue;
    result.push(issue);
    lastEnd = issue.end;
  }
  return result;
}

/** Local pre-flight hints shared by the generative tasks. */
export function preflightFindings(text, { protectedTerms = [], script = 'auto' } = {}) {
  return detectSlop(text, { protectedTerms, script, includeAdvisory: false, maxFindings: 40 });
}
