/**
 * Output contracts for every task.
 *
 * Each entry carries the validator applied to parsed model output and the
 * human-readable schema description injected into the prompt, so the two can
 * never drift apart.
 */
import { t, validate } from './schema.js';
import { TASKS, VERDICTS, SEVERITY, LIMITS } from './constants.js';

const issue = t.object({
  start: t.integer({ min: 0 }),
  end: t.integer({ min: 0 }),
  original: t.string({ maxLength: 2000, trim: false }),
  replacement: t.string({ maxLength: 2000, trim: false }),
  message: t.string({ maxLength: 300, default: 'Suggested correction' }),
  category: t.enumOf(['spelling', 'grammar', 'punctuation', 'clarity'], { default: 'grammar' })
});

const warning = t.object({
  code: t.string({ maxLength: 60, default: 'note' }),
  message: t.string({ maxLength: 400 })
});

const claim = t.object({
  id: t.string({ maxLength: 40, default: '' }),
  text: t.string({ maxLength: 600 }),
  kind: t.enumOf(['factual', 'logical', 'opinion', 'commitment'], { default: 'factual' }),
  status: t.enumOf(Object.values(VERDICTS), { default: VERDICTS.NEEDS_VERIFICATION }),
  reasoning: t.string({ maxLength: 800, default: '' }),
  citationIds: t.array(t.string({ maxLength: 40 }), { default: [], maxItems: 10 })
});

const finding = t.object({
  severity: t.enumOf(Object.values(SEVERITY), { default: SEVERITY.IMPROVEMENT }),
  title: t.string({ maxLength: 160 }),
  detail: t.string({ maxLength: 900, default: '' }),
  quote: t.string({ maxLength: 400, default: '' })
});

const citation = t.object({
  id: t.string({ maxLength: 40, default: '' }),
  title: t.string({ maxLength: 300, default: '' }),
  url: t.string({ maxLength: 2000 }),
  publishedAt: t.string({ maxLength: 40, default: '' }),
  snippet: t.string({ maxLength: 600, default: '' }),
  relationship: t.enumOf(['supports', 'conflicts', 'adds_context', 'unverifiable'], { default: 'adds_context' })
});

const toneDimension = t.object({
  name: t.string({ maxLength: 60 }),
  strength: t.number({ min: 0, max: 1, default: 0.5 }),
  evidence: t.array(t.string({ maxLength: 300 }), { default: [], maxItems: 5 })
});

const reaction = t.object({
  audience: t.string({ maxLength: 120, default: 'the reader' }),
  // Hedged by contract. The model may not assert what a reader will feel.
  possibleInterpretation: t.string({ maxLength: 600 }),
  trigger: t.string({ maxLength: 400, default: '' }),
  likelihood: t.enumOf(['possible', 'plausible', 'likely'], { default: 'possible' })
});

/** @type {Record<string, {schema: object, description: string}>} */
export const TASK_SCHEMAS = {
  [TASKS.PROOFREAD]: {
    schema: t.object({
      issues: t.array(issue, { default: [], maxItems: 50 })
    }),
    description: [
      'Shape:',
      '{"issues":[{"start":int,"end":int,"original":string,"replacement":string,"message":string,"category":"spelling"|"grammar"|"punctuation"|"clarity"}]}',
      'start and end are zero-based JavaScript string offsets into the exact user text.',
      '"original" must equal the user text between start and end, character for character.'
    ].join('\n')
  },

  [TASKS.REWRITE]: {
    schema: t.object({
      proposal: t.string({ maxLength: LIMITS.MAX_INPUT_CHARS, trim: false }),
      summary: t.string({ maxLength: 500, default: '' }),
      whatChanged: t.array(t.string({ maxLength: 300 }), { default: [], maxItems: 12 }),
      meaningChanged: t.boolean({ default: false }),
      warnings: t.array(warning, { default: [], maxItems: 12 }),
      ambiguities: t.array(t.string({ maxLength: 300 }), { default: [], maxItems: 8 })
    }),
    description: [
      'Shape:',
      '{"proposal":string,"summary":string,"whatChanged":[string],"meaningChanged":boolean,',
      ' "warnings":[{"code":string,"message":string}],"ambiguities":[string]}',
      '"proposal" is the rewritten text only, with no commentary and no code fence.',
      '"whatChanged" is the short What changed list: one plain sentence per edit.',
      '"meaningChanged" must be true if you could not preserve the original meaning exactly.',
      '"warnings" is where you report hollow passages, missing facts, or anything you refused to invent.',
      '"ambiguities" lists what you could not resolve from the source. Ask rather than guess.'
    ].join('\n')
  },

  [TASKS.REVIEW]: {
    schema: t.object({
      verdict: t.enumOf(Object.values(VERDICTS)),
      verdictReason: t.string({ maxLength: 600, default: '' }),
      answersTheQuestion: t.boolean({ default: true }),
      claims: t.array(claim, { default: [], maxItems: 30 }),
      findings: t.array(finding, { default: [], maxItems: 30 }),
      needsExternalVerification: t.array(t.string({ maxLength: 400 }), { default: [], maxItems: 20 }),
      recommendedDirection: t.string({ maxLength: 900, default: '' })
    }),
    description: [
      'Shape:',
      '{"verdict":"supported"|"partially_supported"|"unverifiable"|"needs_verification"|"conflicts",',
      ' "verdictReason":string,"answersTheQuestion":boolean,',
      ' "claims":[{"id":string,"text":string,"kind":"factual"|"logical"|"opinion"|"commitment",',
      '            "status":same verdict values,"reasoning":string,"citationIds":[string]}],',
      ' "findings":[{"severity":"error"|"risk"|"improvement","title":string,"detail":string,"quote":string}],',
      ' "needsExternalVerification":[string],"recommendedDirection":string}',
      'Separate errors from risks and from optional improvements.',
      'Do not propose a rewrite in this task. The review comes first.'
    ].join('\n')
  },

  [TASKS.RESEARCH_REVIEW]: {
    schema: t.object({
      verdict: t.enumOf(Object.values(VERDICTS)),
      verdictReason: t.string({ maxLength: 600, default: '' }),
      claims: t.array(claim, { default: [], maxItems: 30 }),
      findings: t.array(finding, { default: [], maxItems: 30 }),
      citations: t.array(citation, { default: [], maxItems: 20 }),
      contradictions: t.array(t.object({
        claimId: t.string({ maxLength: 40, default: '' }),
        citationId: t.string({ maxLength: 40, default: '' }),
        explanation: t.string({ maxLength: 600 })
      }), { default: [], maxItems: 10 }),
      recommendedDirection: t.string({ maxLength: 900, default: '' })
    }),
    description: [
      'Shape:',
      '{"verdict":one of the verdict values,"verdictReason":string,',
      ' "claims":[...as in review, with citationIds referencing citations],',
      ' "findings":[...as in review],',
      ' "citations":[{"id":string,"title":string,"url":string,"publishedAt":string,"snippet":string,',
      '               "relationship":"supports"|"conflicts"|"adds_context"|"unverifiable"}],',
      ' "contradictions":[{"claimId":string,"citationId":string,"explanation":string}],',
      ' "recommendedDirection":string}',
      'A claim may only have status "supported" if at least one citation id supports it.',
      'Every URL must come from the search results. Never write a URL you did not receive.'
    ].join('\n')
  },

  [TASKS.TEST_MODE]: {
    schema: t.object({
      output: t.string({ maxLength: LIMITS.MAX_INPUT_CHARS, trim: false }),
      checks: t.array(t.object({
        expectation: t.string({ maxLength: 300 }),
        met: t.boolean({ default: false }),
        evidence: t.string({ maxLength: 400, default: '' })
      }), { default: [], maxItems: 10 })
    }),
    description: [
      'Shape: {"output":string,"checks":[{"expectation":string,"met":boolean,"evidence":string}]}',
      'Run the mode on the test input, then judge your own output against each expectation honestly.',
      'Marking an unmet expectation as met makes the test worthless.'
    ].join('\n')
  },

  [TASKS.TONE]: {
    schema: t.object({
      dimensions: t.array(toneDimension, { default: [], maxItems: 8, minItems: 1 }),
      overall: t.string({ maxLength: 300, default: '' }),
      mismatch: t.string({ maxLength: 400, default: '' })
    }),
    description: [
      'Shape: {"dimensions":[{"name":string,"strength":0..1,"evidence":[string]}],"overall":string,"mismatch":string}',
      'Every dimension must quote at least one span copied verbatim from the user text as evidence.',
      '"mismatch" is empty unless the tone conflicts with the stated audience or intent.'
    ].join('\n')
  },

  [TASKS.READER_REACTION]: {
    schema: t.object({
      reactions: t.array(reaction, { default: [], maxItems: 8, minItems: 1 }),
      caveat: t.string({ maxLength: 300, default: '' })
    }),
    description: [
      'Shape: {"reactions":[{"audience":string,"possibleInterpretation":string,"trigger":string,',
      '        "likelihood":"possible"|"plausible"|"likely"}],"caveat":string}',
      'These are possible interpretations of the text, not predictions about a real person.',
      'Never state what the reader will think, feel, or do. Say what the wording could be read as.',
      '"trigger" quotes the wording that could produce that reading.'
    ].join('\n')
  }
};

/**
 * Validate parsed model output for a task.
 * @returns {{ok: boolean, value: any, errors: string[]}}
 */
export function validateTaskResult(task, value) {
  const entry = TASK_SCHEMAS[task];
  if (!entry) return { ok: false, value: undefined, errors: [`No schema registered for task "${task}"`] };
  return validate(value, entry.schema);
}

export function schemaDescriptionFor(task) {
  return TASK_SCHEMAS[task]?.description || '';
}
