/**
 * Model compatibility.
 *
 * OpenRouter models differ in whether they honour `response_format`, whether
 * they support tool calling (needed for web search), and how much context they
 * accept. WordSaffron degrades gracefully instead of failing: if a model cannot
 * do structured output, the prompt asks for JSON in prose and the tolerant
 * parser recovers it. If a model cannot use tools, researched review is
 * disabled with an explanation rather than silently returning uncited claims.
 */

export const CAPABILITY = Object.freeze({
  STRUCTURED_OUTPUT: 'structured_output',
  TOOLS: 'tools',
  LONG_CONTEXT: 'long_context'
});

/**
 * Derive capabilities from an OpenRouter catalogue entry.
 * @param {object} model raw entry from /api/v1/models
 */
export function capabilitiesFor(model) {
  const params = new Set(model?.supported_parameters || []);
  const contextLength = Number(model?.context_length) || 0;
  const modality = model?.architecture?.modality || '';

  return {
    id: model?.id || '',
    name: model?.name || model?.id || 'Unknown model',
    contextLength,
    structuredOutput: params.has('response_format') || params.has('structured_outputs'),
    tools: params.has('tools') || params.has('tool_choice'),
    longContext: contextLength >= 100_000,
    textOutput: !modality || modality.includes('text'),
    pricing: {
      prompt: model?.pricing?.prompt ?? null,
      completion: model?.pricing?.completion ?? null,
      webSearch: model?.pricing?.web_search ?? null
    }
  };
}

/**
 * A small offline catalogue so settings still work when the network call fails.
 * These are conservative defaults, marked as such, not a claim about live pricing.
 */
export const FALLBACK_CATALOGUE = Object.freeze([
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000, supported_parameters: ['response_format', 'tools', 'tool_choice'] },
  { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000, supported_parameters: ['response_format', 'tools', 'tool_choice'] },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000, supported_parameters: ['tools', 'tool_choice'] },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', context_length: 1000000, supported_parameters: ['response_format', 'tools', 'tool_choice'] },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', context_length: 131072, supported_parameters: ['response_format'] },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', context_length: 32768, supported_parameters: ['response_format'] },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', context_length: 128000, supported_parameters: ['response_format', 'tools'] }
]);

export const FALLBACK_NOTICE =
  'Showing a built-in list because the OpenRouter model catalogue could not be reached. Capabilities and pricing may be out of date.';

/**
 * Decide what a request may use, given the model's capabilities.
 *
 * @param {object} caps result of capabilitiesFor(), or null when unknown
 * @param {object} want { structuredOutput?: boolean, tools?: boolean }
 * @returns {{useResponseFormat: boolean, useTools: boolean, warnings: string[], blocked: string[]}}
 */
export function planRequest(caps, want = {}) {
  const warnings = [];
  const blocked = [];

  // Unknown capabilities: attempt structured output, because the tolerant parser
  // recovers if the model ignores it. Do not attempt tools, because a silent
  // failure there produces uncited claims.
  const structuredKnown = caps ? caps.structuredOutput : null;
  const toolsKnown = caps ? caps.tools : null;

  const useResponseFormat = want.structuredOutput !== false && structuredKnown !== false;
  if (want.structuredOutput && structuredKnown === false) {
    warnings.push('This model does not advertise structured output. WordSaffron will ask for JSON in the prompt and repair the response if needed.');
  }

  let useTools = false;
  if (want.tools) {
    if (toolsKnown === true) {
      useTools = true;
    } else if (toolsKnown === false) {
      blocked.push('This model does not support tool calling, so it cannot run a web search. Choose a model with tool support to use researched review.');
    } else {
      blocked.push('WordSaffron cannot confirm that this model supports tool calling. Researched review is disabled to avoid producing uncited claims.');
    }
  }

  if (caps && caps.textOutput === false) {
    blocked.push('This model does not return text output.');
  }

  return { useResponseFormat, useTools, warnings, blocked };
}

/** Will the request fit? Rough, and labelled as rough. */
export function fitsContext(caps, { inputChars = 0, reserveTokens = 1500 } = {}) {
  if (!caps?.contextLength) return { fits: true, known: false };
  const estimatedTokens = Math.ceil(inputChars / 4) + reserveTokens;
  return {
    fits: estimatedTokens <= caps.contextLength,
    known: true,
    estimatedTokens,
    contextLength: caps.contextLength
  };
}
