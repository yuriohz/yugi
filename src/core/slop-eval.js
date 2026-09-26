/**
 * Post-flight evaluation.
 *
 * ADAPTED FROM: skills/no-ai-slop/eval.md in No AI Slop by Peter Yang (MIT).
 * See THIRD_PARTY_NOTICES.md. The upstream checklist is answered by the editing
 * agent in prose. Here it is answered programmatically, so a rewrite can be
 * blocked or flagged without a second model call.
 *
 * Every check returns pass/fail plus the evidence. Checks that cannot be decided
 * mechanically return `undecidable` and are surfaced to the user rather than
 * silently passing.
 */
import { compareSlop, emDashBudget } from './slop-detector.js';
import { PROHIBITED_ASSURANCES } from './constants.js';

/**
 * @typedef {object} Check
 * @property {string} id
 * @property {string} label
 * @property {'pass'|'fail'|'undecidable'} status
 * @property {string} [detail]
 */

/**
 * @param {object} args
 * @param {string} args.original
 * @param {string} args.rewritten
 * @param {string[]} [args.protectedTerms]
 * @param {'auto'|'latin'|'arabic'|'both'} [args.script]
 * @returns {{passed: boolean, checks: Check[], failures: Check[]}}
 */
export function evaluateRewrite({ original, rewritten, protectedTerms = [], script = 'auto' }) {
  const checks = [];
  const src = String(original ?? '');
  const out = String(rewritten ?? '');

  // 1. Something was actually returned.
  checks.push(out.trim()
    ? pass('non-empty', 'The rewrite is not empty')
    : fail('non-empty', 'The rewrite is not empty', 'The model returned nothing usable.'));

  // 2. No prohibited assurance language.
  const lowered = out.toLowerCase();
  const claim = PROHIBITED_ASSURANCES.find(p => lowered.includes(p));
  checks.push(claim
    ? fail('no-assurances', 'No prohibited assurance language', `Found “${claim}”.`)
    : pass('no-assurances', 'No prohibited assurance language'));

  // 3. Protected terms survived character for character.
  const lostTerms = protectedTerms.filter(term => term && src.includes(term) && !out.includes(term));
  checks.push(lostTerms.length
    ? fail('protected-terms', 'Protected terms preserved', `Missing: ${lostTerms.join(', ')}`)
    : pass('protected-terms', 'Protected terms preserved'));

  // 4. Slop went down, and nothing new was introduced.
  const comparison = compareSlop(src, out, { protectedTerms, script, includeAdvisory: false });
  checks.push(comparison.introduced.length
    ? fail('no-new-slop', 'No new slop introduced',
        comparison.introduced.slice(0, 5).map(f => `${f.title}: “${f.match}”`).join('; '))
    : pass('no-new-slop', 'No new slop introduced'));

  checks.push(comparison.after <= comparison.before
    ? pass('slop-reduced', 'Slop count did not increase', `${comparison.before} → ${comparison.after}`)
    : fail('slop-reduced', 'Slop count did not increase', `${comparison.before} → ${comparison.after}`));

  // 5. Em-dash budget.
  const dashes = emDashBudget(out);
  checks.push(dashes.overBudget
    ? fail('em-dash-budget', 'Em dashes within budget', `${dashes.count} used, ${dashes.allowed} allowed for ${dashes.words} words`)
    : pass('em-dash-budget', 'Em dashes within budget'));

  // 6. Proportional editing. Upstream: cutting must be proportional to the slop.
  const ratio = src.trim().length ? out.trim().length / src.trim().length : 1;
  if (ratio < 0.45) {
    checks.push(fail('proportional-edit', 'Editing is proportional',
      `The rewrite is ${Math.round(ratio * 100)}% of the original length, which usually means character was stripped.`));
  } else if (ratio > 2.2) {
    checks.push(fail('proportional-edit', 'Editing is proportional',
      `The rewrite is ${Math.round(ratio * 100)}% of the original length, which usually means material was added.`));
  } else {
    checks.push(pass('proportional-edit', 'Editing is proportional', `${Math.round(ratio * 100)}% of original length`));
  }

  // 7. No fenced code or Markdown scaffolding leaked into a plain rewrite.
  checks.push(/^\s*```/.test(out)
    ? fail('no-fence-leak', 'No code fence in the output', 'The rewrite begins with a code fence.')
    : pass('no-fence-leak', 'No code fence in the output'));

  // 8. Checks that need a human. Surfaced, never auto-passed.
  checks.push(undecidable('voice-recognisable', 'The writer would recognise this as their own voice',
    'Only the writer can confirm this. Compare the two versions before replacing.'));

  const failures = checks.filter(c => c.status === 'fail');
  return { passed: failures.length === 0, checks, failures, comparison };
}

function pass(id, label, detail) { return { id, label, status: 'pass', detail }; }
function fail(id, label, detail) { return { id, label, status: 'fail', detail }; }
function undecidable(id, label, detail) { return { id, label, status: 'undecidable', detail }; }
