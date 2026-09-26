/**
 * Task definitions: prompt composition plus output validation, per task.
 *
 * Run 1 ships `proofread` at v1 parity so no existing behaviour regresses.
 * Later runs add rewrite, review, research_review, test_mode, tone and
 * reader_reaction. Unimplemented tasks fail loudly rather than silently
 * returning something plausible.
 */
import { TASKS, LIMITS } from '../core/constants.js';
import { ApiError } from './openrouter.js';

const builders = Object.create(null);

export function registerTask(task, builder) { builders[task] = builder; }

export async function buildRequest(payload) {
  const builder = builders[payload.task];
  if (!builder) {
    throw new ApiError(`Task "${payload.task}" is not implemented in this build.`, { code: 'not_implemented' });
  }
  return builder(payload);
}

// ---------------------------------------------------------------- proofread

registerTask(TASKS.PROOFREAD, ({ text, settings }) => ({
  timeoutMs: LIMITS.REQUEST_TIMEOUT_MS,
  context: { text },
  body: {
    model: settings.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: proofreadSystem(settings) },
      { role: 'user', content: text }
    ]
  },
  validate: (value, context) => ({ issues: validateIssues(value?.issues, context.text) })
}));

function proofreadSystem(settings) {
  const locale = settings.locale || 'en-GB';
  return [
    'You are a precise proofreader.',
    `Target locale: ${locale}. Use that locale's spelling and punctuation conventions.`,
    'Report only clear errors in spelling, grammar, punctuation, and outright clarity faults.',
    'Never rewrite for preference, tone, or style.',
    'Never change names, numbers, URLs, quoted text, or technical terms.',
    'Return JSON only, with this shape:',
    '{"issues":[{"start":number,"end":number,"original":string,"replacement":string,"message":string,"category":"spelling|grammar|punctuation|clarity"}]}',
    'start and end are zero-based JavaScript string offsets into the exact user text.',
    'original must equal the user text between start and end.'
  ].join(' ');
}

/** Drop anything whose offsets do not describe a real slice of the submitted text. */
export function validateIssues(issues, text) {
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
    const key = `${start}:${end}:${issue.replacement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      start,
      end,
      original: actual,
      replacement: issue.replacement,
      message: typeof issue.message === 'string' ? issue.message : 'Suggested correction',
      category: ['spelling', 'grammar', 'punctuation', 'clarity'].includes(issue.category)
        ? issue.category
        : 'grammar'
    });
    if (out.length >= 50) break;
  }
  return out.sort((a, b) => a.start - b.start);
}
