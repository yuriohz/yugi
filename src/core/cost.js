/**
 * Usage and cost.
 *
 * OpenRouter returns usage on most models and a `cost` field when generation
 * accounting is available. When it is not, the cost is unknown and must be
 * displayed as unknown. Never present an estimate as an actual charge.
 */

/**
 * @param {object|null} usage  raw OpenRouter usage object
 * @param {object} [pricing]   { prompt: string|number, completion: string|number } per token
 * @returns {{promptTokens: number|null, completionTokens: number|null, totalTokens: number|null,
 *            cost: number|null, costSource: 'reported'|'estimated'|'unknown', currency: 'USD'}}
 */
export function summariseUsage(usage, pricing) {
  const promptTokens = intOrNull(usage?.prompt_tokens);
  const completionTokens = intOrNull(usage?.completion_tokens);
  const totalTokens = intOrNull(usage?.total_tokens)
    ?? (promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null);

  // OpenRouter reports the real charge here when accounting is enabled.
  const reported = numberOrNull(usage?.cost);
  if (reported !== null) {
    return { promptTokens, completionTokens, totalTokens, cost: reported, costSource: 'reported', currency: 'USD' };
  }

  const promptRate = numberOrNull(pricing?.prompt);
  const completionRate = numberOrNull(pricing?.completion);
  if (promptRate !== null && completionRate !== null && promptTokens !== null && completionTokens !== null) {
    const cost = promptTokens * promptRate + completionTokens * completionRate;
    return { promptTokens, completionTokens, totalTokens, cost, costSource: 'estimated', currency: 'USD' };
  }

  return { promptTokens, completionTokens, totalTokens, cost: null, costSource: 'unknown', currency: 'USD' };
}

/** Human-readable cost with its provenance made explicit. */
export function formatCost(summary) {
  if (!summary || summary.cost === null) return 'Cost not reported';
  const value = summary.cost;
  const text = value < 0.01
    ? `$${value.toFixed(5).replace(/0+$/, '').replace(/\.$/, '.0')}`
    : `$${value.toFixed(4)}`;
  return summary.costSource === 'estimated' ? `${text} (estimated)` : text;
}

export function formatTokens(summary) {
  if (!summary || summary.totalTokens === null) return 'Tokens not reported';
  const parts = [];
  if (summary.promptTokens !== null) parts.push(`${summary.promptTokens.toLocaleString()} in`);
  if (summary.completionTokens !== null) parts.push(`${summary.completionTokens.toLocaleString()} out`);
  return parts.length ? `${parts.join(' / ')} (${summary.totalTokens.toLocaleString()} total)` : `${summary.totalTokens.toLocaleString()} tokens`;
}

/**
 * Rough pre-flight estimate so the user can see what a research run may cost
 * before they trigger it. Explicitly an estimate.
 */
export function estimateCost({ inputChars = 0, expectedOutputChars = 0, pricing, webSearchResults = 0, webSearchPricePerResult = 0.004 }) {
  const promptRate = numberOrNull(pricing?.prompt);
  const completionRate = numberOrNull(pricing?.completion);
  const search = webSearchResults * webSearchPricePerResult;
  if (promptRate === null || completionRate === null) {
    return { cost: search || null, costSource: search ? 'estimated' : 'unknown', currency: 'USD', includesSearch: search > 0 };
  }
  // ~4 characters per token is the usual working approximation for English.
  const cost = (inputChars / 4) * promptRate + (expectedOutputChars / 4) * completionRate + search;
  return { cost, costSource: 'estimated', currency: 'USD', includesSearch: search > 0 };
}

function intOrNull(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
