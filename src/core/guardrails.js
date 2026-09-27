/**
 * Guardrail enforcement.
 *
 * Guardrails are declared on a mode and enforced here, after the model
 * responds. A violation produces a warning and, for blocking guardrails,
 * removes the ability to apply the result without an explicit override.
 *
 * `neverAutoApply` is not enforceable by checking output: it is enforced by the
 * UI never applying a generative result on its own. It is listed so the
 * contract is visible, and asserted by the browser tests.
 */
import { GUARDRAILS } from './modes.js';
import { checkFidelity } from './fidelity.js';
import { evaluateRewrite } from './slop-eval.js';
import { PROHIBITED_ASSURANCES } from './constants.js';

/**
 * @typedef {object} Violation
 * @property {string} guardrail
 * @property {'error'|'risk'} severity
 * @property {string} message
 * @property {boolean} blocking  true when apply must be gated behind an override
 */

/**
 * @param {object} args
 * @param {string[]} args.guardrails
 * @param {string} args.original
 * @param {string} args.proposal
 * @param {string[]} [args.protectedTerms]
 * @param {boolean} [args.arabic]
 * @param {boolean} [args.usedWeb]
 * @param {object[]} [args.citations]
 * @param {object[]} [args.claims]
 * @returns {{ok: boolean, blocked: boolean, violations: Violation[], fidelity: object, evaluation: object}}
 */
export function enforceGuardrails({
  guardrails = [],
  original = '',
  proposal = '',
  protectedTerms = [],
  arabic = false,
  usedWeb = false,
  citations = [],
  claims = []
}) {
  const active = new Set(guardrails);
  const violations = [];

  const fidelity = checkFidelity(original, proposal, { protectedTerms, arabic });
  const evaluation = evaluateRewrite({ original, rewritten: proposal, protectedTerms, script: arabic ? 'both' : 'latin' });

  if (active.has(GUARDRAILS.PRESERVE_FACTS)) {
    for (const warning of fidelity.warnings) {
      violations.push({
        guardrail: GUARDRAILS.PRESERVE_FACTS,
        severity: warning.severity === 'error' ? 'error' : 'risk',
        message: warning.message,
        blocking: warning.severity === 'error'
      });
    }
  }

  if (active.has(GUARDRAILS.PRESERVE_LENGTH)) {
    const ratio = original.trim().length ? proposal.trim().length / original.trim().length : 1;
    if (ratio < 0.7 || ratio > 1.4) {
      violations.push({
        guardrail: GUARDRAILS.PRESERVE_LENGTH,
        severity: 'risk',
        message: `This mode keeps the length close to the original. The rewrite is ${Math.round(ratio * 100)}% of the original length.`,
        blocking: false
      });
    }
  }

  if (active.has(GUARDRAILS.PRESERVE_POSITION)) {
    const flip = detectPositionFlip(original, proposal);
    if (flip) {
      violations.push({
        guardrail: GUARDRAILS.PRESERVE_POSITION,
        severity: 'error',
        message: flip,
        blocking: true
      });
    }
  }

  if (active.has(GUARDRAILS.NO_WEB) && usedWeb) {
    violations.push({
      guardrail: GUARDRAILS.NO_WEB,
      severity: 'error',
      message: 'This mode does not use the web, but the response contains web results. The result has been withheld.',
      blocking: true
    });
  }

  if (active.has(GUARDRAILS.CITATION_REQUIRED)) {
    const cited = new Set(citations.map(c => c.id).filter(Boolean));
    const uncited = claims.filter(c => c.status === 'supported' && !(c.citationIds || []).some(id => cited.has(id)));
    for (const claim of uncited) {
      violations.push({
        guardrail: GUARDRAILS.CITATION_REQUIRED,
        severity: 'error',
        message: `“${truncate(claim.text, 80)}” is marked supported but has no citation. It has been downgraded to needs verification.`,
        blocking: false
      });
      claim.status = 'needs_verification';
    }
    if (!citations.length && claims.length) {
      violations.push({
        guardrail: GUARDRAILS.CITATION_REQUIRED,
        severity: 'error',
        message: 'This mode requires citations and the response returned none.',
        blocking: true
      });
    }
  }

  // Assurance language is prohibited regardless of which guardrails are set.
  const lowered = proposal.toLowerCase();
  const claim = PROHIBITED_ASSURANCES.find(p => lowered.includes(p));
  if (claim) {
    violations.push({
      guardrail: 'prohibitedAssurance',
      severity: 'error',
      message: `The response contains a claim WordSaffron does not make: “${claim}”.`,
      blocking: true
    });
  }

  for (const failure of evaluation.failures) {
    // Fidelity failures are already reported above; do not duplicate them.
    if (failure.id === 'protected-terms') continue;
    violations.push({
      guardrail: 'antiSlop',
      severity: 'risk',
      message: `${failure.label}: ${failure.detail || 'failed'}`,
      blocking: false
    });
  }

  return {
    ok: violations.length === 0,
    blocked: violations.some(v => v.blocking),
    violations,
    fidelity,
    evaluation
  };
}

/**
 * Catch the worst failure mode: the rewrite reverses the writer's answer.
 * Deliberately narrow — it looks for an explicit refusal or acceptance in one
 * version that is contradicted in the other.
 */
const REFUSALS = [
  /\b(?:i|we)\s+(?:can(?:'|’)?t|cannot|won(?:'|’)?t|will not|am not able to|are not able to)\b/i,
  /\bnot\s+(?:going to|able to|possible)\b/i,
  /\b(?:unfortunately|regrettably)\b[^.!?]{0,80}\b(?:no|cannot|can(?:'|’)?t|decline)\b/i,
  /\bwe\s+(?:decline|must decline|have to decline)\b/i,
  /(?:^|[\s،.؛])لا\s+(?:أستطيع|نستطيع|يمكنني|يمكننا)/,
  /(?:^|[\s،.؛])مش\s+(?:هينفع|ممكن|قادر)/
];
const ACCEPTANCES = [
  /\b(?:i|we)\s+(?:can|will|agree to|am happy to|are happy to|accept)\b/i,
  /\b(?:yes|confirmed|approved|agreed)\b/i,
  /(?:^|[\s،.؛])(?:سأقوم|سنقوم|أوافق|نوافق|موافق)/,
  /(?:^|[\s،.؛])(?:تمام|ماشي|هعمل|هنعمل)/
];

export function detectPositionFlip(original, proposal) {
  const srcRefuses = REFUSALS.some(re => re.test(original));
  const outRefuses = REFUSALS.some(re => re.test(proposal));
  const srcAccepts = ACCEPTANCES.some(re => re.test(original));
  const outAccepts = ACCEPTANCES.some(re => re.test(proposal));

  if (srcRefuses && !outRefuses && outAccepts) {
    return 'Your text declines, but the rewrite reads as agreement. Your position must not change.';
  }
  if (srcAccepts && !srcRefuses && outRefuses && !outAccepts) {
    return 'Your text agrees, but the rewrite reads as a refusal. Your position must not change.';
  }
  return null;
}

function truncate(value, n) {
  const s = String(value ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
