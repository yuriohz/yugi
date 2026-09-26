/**
 * Technical Review support.
 *
 * Two things live here: the calibrated language contract, and the
 * post-processing that stops a review from overstating what it knows.
 *
 * The rule the whole feature turns on: a logic-only review has no evidence
 * beyond the text in front of it. It may say a claim is internally consistent.
 * It may not say the claim is true.
 */
import { VERDICTS, VERDICT_LABELS, SEVERITY, PROHIBITED_ASSURANCES } from './constants.js';

/** Phrasing that asserts correctness the review cannot establish. */
export const BANNED_CERTAINTY = Object.freeze([
  ...PROHIBITED_ASSURANCES,
  'this is correct',
  'this is definitely',
  'without a doubt',
  'there is no question',
  'proves that',
  'confirms that you',
  'you are absolutely',
  'factually correct',
  'entirely accurate'
]);

export const REVIEW_INSTRUCTION = [
  '# Mode: Technical Review (logic only)',
  'Job: review the reasoning in the text. Do not rewrite it yet.',
  '',
  'You have no web access and no sources in this task. You can only judge the text against itself and against what the writer already supplied.',
  '',
  'Work through this order:',
  '1. State what the text is trying to do and what it concludes.',
  '2. Extract each claim. Mark it factual, logical, opinion, or commitment.',
  '3. Check internal consistency: does any claim contradict another?',
  '4. Check the causal chain: does the conclusion actually follow from the claims?',
  '5. Check unstated assumptions, missing constraints, and edge cases the text ignores.',
  '6. Check terminology: is any technical term used incorrectly or inconsistently?',
  '7. Check any calculation the text supplies, using only numbers the text supplies.',
  '8. Check whether the text actually answers the question or message it is replying to.',
  '',
  'Separate your findings:',
  '- error: something is wrong, contradictory, or does not follow.',
  '- risk: something may be wrong, or will be wrong under a condition the text ignores.',
  '- improvement: optional, would make the response stronger.',
  '',
  'Claim status vocabulary. Use exactly these values and nothing else:',
  `- ${VERDICTS.SUPPORTED}: follows from what the writer supplied, in this text.`,
  `- ${VERDICTS.PARTIALLY_SUPPORTED}: partly follows; part of it does not.`,
  `- ${VERDICTS.NEEDS_VERIFICATION}: a factual claim about the outside world. You cannot check it here.`,
  `- ${VERDICTS.UNVERIFIABLE}: could not be checked even with sources, for example a prediction or an opinion.`,
  `- ${VERDICTS.CONFLICTS}: contradicts something else in the text.`,
  '',
  'Every factual claim about the outside world gets needs_verification. Not supported. You have no sources in this task.',
  '',
  'Never tell the writer they are right. Never say a claim is true, correct, proven, or certain.',
  'Say what the text supports, what it does not, and what still needs checking.',
  'If the reasoning is sound, say the reasoning is internally consistent — that is a different statement from saying it is true.',
  '',
  'Do not produce a rewrite in this task. The review comes first, and the writer decides what to do with it.'
].join('\n');

/**
 * Post-process a logic-only review.
 *
 * Three corrections are applied, each of them a downgrade, never an upgrade:
 *  1. a factual claim cannot be "supported" without evidence
 *  2. an overall verdict cannot exceed the strongest claim status
 *  3. certainty language is stripped and reported
 *
 * @returns {object} the corrected review plus the corrections that were made
 */
export function calibrateReview(review, { hasEvidence = false } = {}) {
  const corrections = [];
  const claims = (review.claims || []).map(claim => ({ ...claim }));

  for (const claim of claims) {
    if (!hasEvidence && claim.kind === 'factual' && claim.status === VERDICTS.SUPPORTED) {
      claim.status = VERDICTS.NEEDS_VERIFICATION;
      corrections.push({
        code: 'unsupported_factual_claim',
        message: `“${truncate(claim.text, 70)}” was marked supported, but this review has no sources. It has been changed to needs verification.`
      });
    }
    if (!hasEvidence && (claim.citationIds || []).length) {
      claim.citationIds = [];
      corrections.push({
        code: 'citation_without_source',
        message: `“${truncate(claim.text, 70)}” referenced a source, but no search was run. The reference has been removed.`
      });
    }
  }

  let verdict = review.verdict;
  if (!hasEvidence && verdict === VERDICTS.SUPPORTED && claims.some(c => c.kind === 'factual')) {
    verdict = VERDICTS.PARTIALLY_SUPPORTED;
    corrections.push({
      code: 'verdict_downgraded',
      message: 'The overall verdict was downgraded because this review contains factual claims that were not checked against any source.'
    });
  }

  const { text: verdictReason, stripped } = stripCertainty(review.verdictReason || '');
  const { text: recommendedDirection, stripped: strippedDirection } = stripCertainty(review.recommendedDirection || '');
  for (const phrase of [...stripped, ...strippedDirection]) {
    corrections.push({ code: 'certainty_removed', message: `The phrase “${phrase}” was removed. This review cannot establish certainty.` });
  }

  const findings = (review.findings || []).map(f => ({
    ...f,
    severity: Object.values(SEVERITY).includes(f.severity) ? f.severity : SEVERITY.IMPROVEMENT
  }));

  return {
    ...review,
    verdict,
    verdictLabel: VERDICT_LABELS[verdict] || verdict,
    verdictReason,
    recommendedDirection,
    claims,
    findings,
    counts: {
      errors: findings.filter(f => f.severity === SEVERITY.ERROR).length,
      risks: findings.filter(f => f.severity === SEVERITY.RISK).length,
      improvements: findings.filter(f => f.severity === SEVERITY.IMPROVEMENT).length,
      needsVerification: claims.filter(c => c.status === VERDICTS.NEEDS_VERIFICATION).length
    },
    evidenceUsed: hasEvidence,
    corrections,
    // The review is an analysis. It produces no replacement text on its own.
    producesRewrite: false
  };
}

/**
 * Remove certainty this product does not claim, at clause granularity.
 *
 * Review decision Q2: sentence granularity deleted useful observations that
 * happened to share a sentence with a banned phrase. A sentence that contains
 * a banned phrase now loses only the offending clause, provided what remains
 * is substantial (at least MIN_KEEP_CHARS of non-punctuation). Otherwise the
 * whole sentence is dropped, as before. Either way the removal is reported.
 */
export const MIN_KEEP_CHARS = 24;

// A bare hyphen only splits a clause when spaced, so compound words survive.
const CLAUSE_SPLIT = /\s*[,;:،؛—–]\s*|\s+-\s+/;

export function stripCertainty(text) {
  const source = String(text ?? '');
  if (!source) return { text: '', stripped: [] };

  const stripped = [];
  const sentences = source.split(/(?<=[.!?؟])\s+/);
  const kept = [];

  for (const sentence of sentences) {
    const lowered = sentence.toLowerCase();
    const hits = BANNED_CERTAINTY.filter(phrase => lowered.includes(phrase));
    if (!hits.length) { kept.push(sentence); continue; }

    stripped.push(...hits);
    const ending = sentence.match(/[.!?؟]+\s*$/)?.[0] || '';
    const body = sentence.slice(0, sentence.length - ending.length);
    // A surviving clause must be free of every banned phrase, not just the
    // first one found: a sentence can offend twice.
    const survivors = body
      .split(CLAUSE_SPLIT)
      .map(clause => clause.trim())
      .filter(clause => clause && !BANNED_CERTAINTY.some(phrase => clause.toLowerCase().includes(phrase)));
    const remainder = survivors.join(', ').trim();

    // Keep the surviving clauses only when they still say something on their
    // own. A stub such as "and" is worse than nothing.
    if (remainder.replace(/[\s,;:،؛—–-]/g, '').length >= MIN_KEEP_CHARS) {
      kept.push(remainder + (ending.trim() || '.'));
    }
  }

  return { text: kept.join(' ').trim(), stripped };
}

/** Does any part of the review assert certainty? Used by validation and tests. */
export function findCertaintyClaims(review) {
  const haystack = [
    review.verdictReason,
    review.recommendedDirection,
    ...(review.claims || []).map(c => c.reasoning),
    ...(review.findings || []).map(f => `${f.title} ${f.detail}`)
  ].join(' ').toLowerCase();
  return BANNED_CERTAINTY.filter(phrase => haystack.includes(phrase));
}

function truncate(value, n) {
  const s = String(value ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
