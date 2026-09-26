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
import { detectLocalIssues, mergeIssues } from '../core/local-issues.js';
import { resolveLocale } from '../core/locale.js';
import { OPERATION, GUARDRAILS, LENGTH, lengthInstruction } from '../core/modes.js';
import { enforceGuardrails } from '../core/guardrails.js';
import { REVIEW_INSTRUCTION, calibrateReview } from '../core/review.js';
import { RESEARCH_INSTRUCTION, webSearchTool, normaliseAnnotations, reconcileResearch } from '../core/research.js';
import { renderModeInstruction } from '../core/custom-modes.js';
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

registerTask(TASKS.PROOFREAD, ({ text, settings, model, plan, profile, localeLayer, platform, options = {} }) => {
  const protectedTerms = profile?.protectedTerms || [];
  const { locale } = resolveLocale({ text, settings, profile });
  const dictionary = options.dictionary || [];
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
    context: { text, protectedTerms, locale, dictionary },
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
      // Model issues and deterministic local issues are merged; the model wins
      // wherever the two overlap.
      issues: mergeIssues(
        validateIssues(value.issues, context.text, context.protectedTerms),
        detectLocalIssues(context.text, {
          locale: context.locale,
          protectedTerms: context.protectedTerms,
          dictionary: context.dictionary
        })
      )
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

// ------------------------------------------------------------------ rewrite

registerTask(TASKS.REWRITE, ({ text, model, plan, profile, localeLayer, platform, mode, options = {} }) => {
  if (!mode) throw new ApiError('No mode was selected for this rewrite.', { code: 'no_mode' });
  if (mode.operation && mode.operation !== OPERATION.REWRITE) {
    throw new ApiError(`“${mode.name}” is a ${mode.operation} mode and cannot be used for a rewrite.`, { code: 'wrong_operation' });
  }

  const protectedTerms = [...(profile?.protectedTerms || []), ...(options.protectedTerms || [])];
  const script = options.script || 'auto';
  const findings = preflightFindings(text, { protectedTerms, script });
  const length = options.length || mode.controls?.defaultLength || LENGTH.SAME;

  const modeLayer = [renderModeInstruction(mode), '', lengthInstruction(length), '', guardrailLayer(mode.guardrails)]
    .filter(Boolean).join('\n');

  const system = composeSystemPrompt({
    mode: modeLayer,
    profile,
    locale: localeLayer,
    platform,
    findings,
    hasUntrustedData: Boolean(options.untrustedBlocks?.length),
    output: {
      schemaDescription: schemaDescriptionFor(TASKS.REWRITE),
      notes: [
        'Return the rewritten text in "proposal". Nothing else goes in that field.',
        'If you cannot preserve the meaning, set "meaningChanged" to true and explain why in "warnings".',
        'If a passage is hollow because it lacks facts, say so in "warnings". Never fill the gap yourself.'
      ]
    }
  });

  return {
    timeoutMs: LIMITS.REQUEST_TIMEOUT_MS,
    context: { text, protectedTerms, mode, arabic: script === 'arabic' || script === 'both' },
    body: baseBody({
      model,
      plan,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: composeUserMessage({
            text,
            instruction: `Apply the ${mode.name} mode to the text below.`,
            untrustedBlocks: options.untrustedBlocks || []
          })
        }
      ]
    }),
    postProcess: (value, context) => {
      const guard = enforceGuardrails({
        guardrails: context.mode.guardrails,
        original: context.text,
        proposal: value.proposal,
        protectedTerms: context.protectedTerms,
        arabic: context.arabic
      });
      return {
        ...value,
        modeId: context.mode.id,
        length,
        guardrails: {
          ok: guard.ok,
          blocked: guard.blocked,
          violations: guard.violations
        },
        fidelity: {
          ok: guard.fidelity.ok,
          missing: guard.fidelity.missing.map(f => ({ kind: f.kind, label: f.label, raw: f.raw })),
          added: guard.fidelity.added.map(f => ({ kind: f.kind, label: f.label, raw: f.raw })),
          namesLost: guard.fidelity.namesLost
        },
        checks: guard.evaluation.checks,
        // The user must always confirm. Never auto-applied, by contract.
        autoApply: false
      };
    }
  };
});

/** Render the mode's declared guardrails into the prompt so the model sees them too. */
export function guardrailLayer(guardrails = []) {
  if (!guardrails.length) return '';
  const lines = ['## Guardrails for this mode'];
  const text = {
    [GUARDRAILS.PRESERVE_FACTS]: 'Every number, name, date, URL and commitment in the source must appear unchanged in the proposal.',
    [GUARDRAILS.PRESERVE_LENGTH]: 'Stay close to the original length.',
    [GUARDRAILS.PRESERVE_POSITION]: 'Never reverse the writer’s answer. A refusal stays a refusal; agreement stays agreement.',
    [GUARDRAILS.NO_WEB]: 'Do not use or refer to web results. You have none.',
    [GUARDRAILS.CITATION_REQUIRED]: 'Every claim marked supported must cite a source you were given.',
    [GUARDRAILS.NEVER_AUTO_APPLY]: 'The user reviews this before anything is applied. Present a proposal, not a finished act.'
  };
  for (const g of guardrails) if (text[g]) lines.push(`- ${text[g]}`);
  return lines.length > 1 ? lines.join('\n') : '';
}

// ------------------------------------------------------- review (logic only)

registerTask(TASKS.REVIEW, ({ text, model, plan, profile, localeLayer, platform, options = {} }) => {
  const protectedTerms = profile?.protectedTerms || [];

  const system = composeSystemPrompt({
    mode: REVIEW_INSTRUCTION,
    profile,
    locale: localeLayer,
    platform,
    hasUntrustedData: Boolean(options.untrustedBlocks?.length),
    output: {
      schemaDescription: schemaDescriptionFor(TASKS.REVIEW),
      notes: [
        'You have no sources in this task. Every factual claim about the outside world is needs_verification.',
        'Do not include a rewrite. Do not include a "proposal" field.'
      ]
    }
  });

  return {
    timeoutMs: LIMITS.REQUEST_TIMEOUT_MS,
    context: { text, protectedTerms },
    // A logic-only review must not be given tools, whatever the model supports.
    body: baseBody({
      model,
      plan: { ...plan, useTools: false },
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: composeUserMessage({
            text,
            instruction: options.question
              ? `Review the text below. It is a reply to: ${String(options.question).slice(0, 600)}`
              : 'Review the reasoning in the text below.',
            untrustedBlocks: options.untrustedBlocks || []
          })
        }
      ]
    }),
    postProcess: value => calibrateReview(value, { hasEvidence: false })
  };
});

// ------------------------------------------------- research review (web)

registerTask(TASKS.RESEARCH_REVIEW, ({ text, model, plan, settings, profile, localeLayer, platform, options = {} }) => {
  if (!plan?.useTools) {
    throw new ApiError(
      'Researched review needs a model that supports tool calling. Choose one in settings.',
      { code: 'model_incompatible' }
    );
  }
  // Research is explicit, per request. It never runs because a setting is on.
  if (options.research !== true) {
    throw new ApiError(
      'Researched review was not requested for this run. Switch research on for this review to use the web.',
      { code: 'research_not_requested' }
    );
  }

  const research = { ...(settings?.research || {}), ...(options.researchOptions || {}) };

  const system = composeSystemPrompt({
    mode: RESEARCH_INSTRUCTION,
    profile,
    locale: localeLayer,
    platform,
    hasUntrustedData: true,
    output: {
      schemaDescription: schemaDescriptionFor(TASKS.RESEARCH_REVIEW),
      notes: [
        'Only cite sources the search actually returned. Use their ids.',
        'A claim without a citation is never supported.',
        'Do not include a rewrite or a "proposal" field.'
      ]
    }
  });

  return {
    timeoutMs: LIMITS.RESEARCH_TIMEOUT_MS,
    context: { text },
    body: baseBody({
      model,
      plan,
      temperature: 0.1,
      tools: [webSearchTool(research)],
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: composeUserMessage({
            text,
            instruction: options.question
              ? `Review the text below and check its factual claims. It is a reply to: ${String(options.question).slice(0, 600)}`
              : 'Review the text below and check its factual claims against the web.',
            untrustedBlocks: options.untrustedBlocks || []
          })
        }
      ]
    }),
    // Annotations are attached by the router, then reconciled here.
    postProcess: (value, context, meta) => reconcileResearch(value, normaliseAnnotations(meta?.annotations || []))
  };
});

// ---------------------------------------------------------- mode testing

registerTask(TASKS.TEST_MODE, ({ model, plan, profile, localeLayer, mode, options = {} }) => {
  if (!mode) throw new ApiError('Select a mode to test.', { code: 'no_mode' });
  const testCase = options.testCase;
  if (!testCase?.input) throw new ApiError('Add a test input first.', { code: 'no_test_input' });

  const expectations = (testCase.expectations || []).slice(0, 6);

  const system = composeSystemPrompt({
    mode: renderModeInstruction(mode),
    profile,
    locale: localeLayer,
    output: {
      schemaDescription: schemaDescriptionFor(TASKS.TEST_MODE),
      notes: [
        'Run the mode on the test input, then judge your own output against each expectation.',
        'Be honest. Marking an unmet expectation as met makes the test worthless.'
      ]
    }
  });

  const instruction = expectations.length
    ? `Apply the ${mode.name} mode to the test input, then check your output against these expectations:\n${expectations.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
    : `Apply the ${mode.name} mode to the test input.`;

  return {
    timeoutMs: LIMITS.REQUEST_TIMEOUT_MS,
    context: { text: testCase.input, mode, expectations, protectedTerms: profile?.protectedTerms || [] },
    body: baseBody({
      model,
      plan,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: composeUserMessage({ text: testCase.input, instruction }) }
      ]
    }),
    postProcess: (value, context) => {
      // The model's self-assessment is advisory. The deterministic guardrail
      // check is what actually decides whether the mode behaved.
      const guard = enforceGuardrails({
        guardrails: context.mode.guardrails,
        original: context.text,
        proposal: value.output,
        protectedTerms: context.protectedTerms
      });
      const declared = context.expectations.map((expectation, i) => ({
        expectation,
        modelSaysMet: Boolean(value.checks?.[i]?.met),
        evidence: value.checks?.[i]?.evidence || ''
      }));
      return {
        modeId: context.mode.id,
        input: context.text,
        output: value.output,
        expectations: declared,
        guardrails: { ok: guard.ok, blocked: guard.blocked, violations: guard.violations },
        fidelity: { ok: guard.fidelity.ok, warnings: guard.fidelity.warnings },
        checks: guard.evaluation.checks,
        // Stated plainly so the UI cannot present a self-assessment as a result.
        note: 'Expectation results are the model judging its own output. The guardrail and fidelity results are checked by WriteRight.',
        passed: guard.ok && !guard.blocked
      };
    }
  };
});
