/**
 * The five built-in modes.
 *
 * Each mode carries its job, its explicit "must not" list, its guardrails, and
 * the controls the UI exposes. Built-ins are frozen: they can be duplicated
 * into a custom mode, never overwritten.
 */
import { LOCALES } from './constants.js';

export const OPERATION = Object.freeze({
  REWRITE: 'rewrite',
  REVIEW: 'review',
  COMPOSE: 'compose',
  SUMMARISE: 'summarise',
  REPLY: 'reply'
});

export const GUARDRAILS = Object.freeze({
  PRESERVE_FACTS: 'preserveFacts',
  PRESERVE_LENGTH: 'preserveLength',
  NO_WEB: 'noWeb',
  CITATION_REQUIRED: 'citationRequired',
  NEVER_AUTO_APPLY: 'neverAutoApply',
  PRESERVE_POSITION: 'preservePosition'
});

export const RESEARCH_POLICY = Object.freeze({
  OFF: 'off',
  ALLOWED: 'allowed',
  REQUIRED: 'required'
});

export const LENGTH = Object.freeze({ SHORTER: 'shorter', SAME: 'same', LONGER: 'longer' });

/**
 * Arabic register per mode. Casual is Egyptian; everything else is Modern
 * Standard Arabic, because MSA is what a professional or technical Arabic
 * message is expected to use.
 */
const MSA = LOCALES.AR;
const EGY = LOCALES.AR_EG;

/** @type {readonly object[]} */
export const BUILT_IN_MODES = Object.freeze([
  {
    id: 'polish',
    builtIn: true,
    name: 'Polish',
    summary: 'Same voice, cleaner writing.',
    description: 'Fixes grammar, structure, clarity and flow while keeping your voice, meaning, directness and approximate length.',
    icon: 'sparkle',
    colour: '#2F6F4E',
    operation: OPERATION.REWRITE,
    arabicRegister: MSA,
    researchPolicy: RESEARCH_POLICY.OFF,
    guardrails: [GUARDRAILS.PRESERVE_FACTS, GUARDRAILS.PRESERVE_LENGTH, GUARDRAILS.PRESERVE_POSITION, GUARDRAILS.NO_WEB, GUARDRAILS.NEVER_AUTO_APPLY],
    controls: { length: true, defaultLength: LENGTH.SAME },
    instruction: [
      '# Mode: Polish',
      'Job: fix grammar, punctuation, structure, clarity and flow. Keep everything else.',
      '',
      'Keep: the writer’s voice, their vocabulary where it is correct, their directness, their level of formality, and roughly their length.',
      '',
      'Must not:',
      '- must not add arguments, reasons, examples, or evidence the writer did not give',
      '- must not make the writer sound more formal or more corporate than they wrote',
      '- must not remove intentional personality, humour, bluntness, or hedging that is theirs',
      '- must not turn simple language into business language',
      '- must not reorder the writer’s points unless the current order makes a sentence unreadable',
      '',
      'If a sentence is already good, leave it exactly as it is.'
    ].join('\n')
  },

  {
    id: 'casual',
    builtIn: true,
    name: 'Casual',
    summary: 'Natural and easygoing.',
    description: 'Makes the writing sound like a person talking, without fake informality.',
    icon: 'chat',
    colour: '#3D6FB4',
    operation: OPERATION.REWRITE,
    // Casual Arabic is Egyptian Arabic, not MSA: MSA reads stiff in a chat.
    arabicRegister: EGY,
    researchPolicy: RESEARCH_POLICY.OFF,
    guardrails: [GUARDRAILS.PRESERVE_FACTS, GUARDRAILS.PRESERVE_POSITION, GUARDRAILS.NO_WEB, GUARDRAILS.NEVER_AUTO_APPLY],
    controls: { length: true, defaultLength: LENGTH.SAME },
    instruction: [
      '# Mode: Casual',
      'Job: make the writing sound natural, conversational, and personally written.',
      '',
      'Do: use contractions where they are natural, prefer concrete everyday words, vary sentence length, and let the rhythm move the way speech moves.',
      '',
      'Must not:',
      '- must not invent slang, deliberate typos, filler sounds, or quirks to seem human',
      '- must not add emoji unless the writer’s profile permits it and the source already uses them',
      '- must not lower the writer’s competence or make them sound careless or juvenile',
      '- must not introduce errors in order to seem informal',
      '- must not add forced enthusiasm, exclamation marks, or canned transitions',
      '',
      'Casual means relaxed, not sloppy. The facts, the request, and the commitment stay exactly as written.'
    ].join('\n')
  },

  {
    id: 'polite',
    builtIn: true,
    name: 'Polite',
    summary: 'Respectful without weakening the message.',
    description: 'Reduces friction and defensiveness while keeping the request or boundary completely clear.',
    icon: 'handshake',
    colour: '#7A5AA8',
    operation: OPERATION.REWRITE,
    arabicRegister: MSA,
    researchPolicy: RESEARCH_POLICY.OFF,
    guardrails: [GUARDRAILS.PRESERVE_FACTS, GUARDRAILS.PRESERVE_POSITION, GUARDRAILS.NO_WEB, GUARDRAILS.NEVER_AUTO_APPLY],
    controls: { length: true, defaultLength: LENGTH.SAME },
    instruction: [
      '# Mode: Polite',
      'Job: lower the temperature without losing the point.',
      '',
      'Structure: acknowledge the context in one short clause if there is context to acknowledge, state the request or the boundary plainly, and close respectfully only where a close belongs.',
      '',
      'Must not:',
      '- must not become submissive, deferential, or self-deprecating',
      '- must not over-apologise, or apologise at all when the writer did nothing wrong',
      '- must not bury the request under softeners so the reader can miss it',
      '- must not add insincere gratitude, flattery, or warmth the writer did not express',
      '- must not turn a refusal into a maybe, or a boundary into a negotiation',
      '',
      'If the writer said no, the rewrite still says no. It just says it courteously.'
    ].join('\n')
  },

  {
    id: 'professional-firm',
    builtIn: true,
    name: 'Professional & Firm',
    summary: 'Direct, confident, and business-ready.',
    description: 'Produces a clear business response with an explicit position and next step, drawn only from what you wrote.',
    icon: 'briefcase',
    colour: '#B05E28',
    operation: OPERATION.REWRITE,
    arabicRegister: MSA,
    researchPolicy: RESEARCH_POLICY.OFF,
    guardrails: [GUARDRAILS.PRESERVE_FACTS, GUARDRAILS.PRESERVE_POSITION, GUARDRAILS.NO_WEB, GUARDRAILS.NEVER_AUTO_APPLY],
    controls: { length: true, defaultLength: LENGTH.SAME },
    instruction: [
      '# Mode: Professional & Firm',
      'Job: a clear, confident business response that states the position and the next step.',
      '',
      'Structure: concise opening, the relevant facts before the conclusion, direct action language, and calibrated certainty.',
      'Name the owner, the action, and the date ONLY where the writer already supplied them.',
      '',
      'Must not:',
      '- must not invent a deadline, a date, an owner, a price, a penalty, or a consequence',
      '- must not threaten, escalate, or imply legal action the writer did not raise',
      '- must not become hostile, sarcastic, passive-aggressive, or contemptuous',
      '- must not adopt legal or contractual phrasing the writer did not use',
      '- must not overstate certainty: if the writer was unsure, the rewrite is unsure',
      '',
      'Firm means unambiguous, not aggressive. If the source has no deadline, the rewrite has no deadline — say so in warnings instead.'
    ].join('\n')
  },

  {
    id: 'technical-review',
    builtIn: true,
    name: 'Technical Review',
    summary: 'Check the reasoning, then improve the response.',
    description: 'Reviews the logic and the claims first. Web research is a separate, explicit step.',
    icon: 'magnifier',
    colour: '#2C6E8F',
    operation: OPERATION.REVIEW,
    arabicRegister: MSA,
    researchPolicy: RESEARCH_POLICY.ALLOWED,
    guardrails: [GUARDRAILS.PRESERVE_FACTS, GUARDRAILS.NEVER_AUTO_APPLY],
    controls: { research: true, defaultResearch: false },
    instruction: [
      '# Mode: Technical Review',
      'Job: review the reasoning before anything is rewritten.',
      'Full instructions are supplied by the review task.'
    ].join('\n')
  }
]);

const BY_ID = new Map(BUILT_IN_MODES.map(m => [m.id, m]));

export function getBuiltInMode(id) { return BY_ID.get(id) || null; }

export function isBuiltIn(id) { return BY_ID.has(id); }

/** Duplicate a built-in into an editable custom mode. */
export function duplicateMode(id, { newId, name } = {}) {
  const source = BY_ID.get(id);
  if (!source) throw new Error(`Unknown mode: ${id}`);
  return {
    ...structuredClone(source),
    id: newId || `${id}-copy-${Date.now().toString(36)}`,
    builtIn: false,
    name: name || `${source.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/** Length control appended to the mode instruction. */
export function lengthInstruction(length) {
  switch (length) {
    case LENGTH.SHORTER:
      return 'Length: make it noticeably shorter by cutting filler. Do not cut facts, conditions, or commitments to achieve this.';
    case LENGTH.LONGER:
      return 'Length: the writer has asked for more room. Expand only by making existing points clearer and more specific. Do not add new claims, examples, or reasons.';
    case LENGTH.SAME:
    default:
      return 'Length: stay close to the original length. A change of more than about a quarter either way usually means something was added or lost.';
  }
}
