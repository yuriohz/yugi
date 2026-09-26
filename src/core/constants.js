/**
 * Shared constants. Pure data only — this module is imported by the service
 * worker, the content script, every UI surface, and the unit tests.
 */

export const APP_NAME = 'WriteRight';

/**
 * Working code name. The public name is unresolved pending the naming research
 * in Run 15 of EXECUTION_PLAN.md. Do not publish under this name until the
 * documented naming conflicts are addressed.
 */
export const PUBLIC_NAME_STATUS = 'provisional';

export const SCHEMA_VERSION = 2;

export const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

/** Attribution headers OpenRouter asks integrators to send. */
export const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://github.com/yuriohz/yugi',
  'X-Title': 'WriteRight Chrome Extension'
};

/** OpenRouter's current server-side web search tool identifier. */
export const WEB_SEARCH_TOOL = 'openrouter:web_search';

export const TASKS = Object.freeze({
  PROOFREAD: 'proofread',
  REWRITE: 'rewrite',
  REVIEW: 'review',
  RESEARCH_REVIEW: 'research_review',
  TEST_MODE: 'test_mode',
  TONE: 'tone',
  READER_REACTION: 'reader_reaction'
});

export const MESSAGES = Object.freeze({
  RUN_TASK: 'WR_RUN_TASK',
  CANCEL_TASK: 'WR_CANCEL_TASK',
  TEST_CONNECTION: 'WR_TEST_CONNECTION',
  OPEN_OPTIONS: 'WR_OPEN_OPTIONS',
  GET_STATE: 'WR_GET_STATE',
  SET_SHUTDOWN: 'WR_SET_SHUTDOWN',
  LIST_MODELS: 'WR_LIST_MODELS',
  HISTORY_ADD: 'WR_HISTORY_ADD',
  HISTORY_LIST: 'WR_HISTORY_LIST',
  HISTORY_CLEAR: 'WR_HISTORY_CLEAR',
  SET_SETTINGS: 'WR_SET_SETTINGS',
  SAVE_PROFILE: 'WR_SAVE_PROFILE',
  DELETE_PROFILE: 'WR_DELETE_PROFILE',
  SAVE_MODE: 'WR_SAVE_MODE',
  DELETE_MODE: 'WR_DELETE_MODE',
  SAVE_PROMPT: 'WR_SAVE_PROMPT',
  DELETE_PROMPT: 'WR_DELETE_PROMPT',
  SET_FAVOURITES: 'WR_SET_FAVOURITES',
  ADD_DICTIONARY: 'WR_ADD_DICTIONARY',
  REMOVE_DICTIONARY: 'WR_REMOVE_DICTIONARY',
  EXPORT_SETTINGS: 'WR_EXPORT_SETTINGS',
  IMPORT_SETTINGS: 'WR_IMPORT_SETTINGS',
  SET_CONSENT: 'WR_SET_CONSENT'
});

export const STORAGE_KEYS = Object.freeze({
  SETTINGS: 'settings',
  PROFILES: 'profiles',
  MODES: 'customModes',
  PROMPTS: 'promptTemplates',
  DICTIONARY: 'dictionary',
  HISTORY: 'history',
  FAVOURITE_MODELS: 'favouriteModels',
  SITE_SHUTDOWN: 'siteShutdown',
  MODEL_CACHE: 'modelCache'
});

/** Locale identifiers used across prompts, fidelity checks and direction logic. */
export const LOCALES = Object.freeze({
  EN_GB: 'en-GB',
  EN_US: 'en-US',
  AR: 'ar',           // Modern Standard Arabic
  AR_EG: 'ar-EG'      // Egyptian Arabic
});

export const DEFAULT_LOCALE = LOCALES.EN_GB;

/** Request lifecycle limits. */
export const LIMITS = Object.freeze({
  REQUEST_TIMEOUT_MS: 45_000,
  RESEARCH_TIMEOUT_MS: 90_000,
  MAX_RETRIES: 2,
  RETRY_BASE_MS: 600,
  RETRY_MAX_MS: 6_000,
  MAX_INPUT_CHARS: 20_000,
  MAX_CONTEXT_MESSAGES: 12,
  MAX_CONTEXT_CHARS: 4_000,
  MAX_VOICE_SAMPLES: 5,
  MAX_VOICE_SAMPLE_CHARS: 1_200,
  MAX_MODE_TEST_CASES: 3,
  MAX_IMPORT_BYTES: 1_000_000,
  HISTORY_MAX_ENTRIES: 50,
  HISTORY_TTL_MS: 7 * 24 * 60 * 60 * 1000
});

/** Calibrated verdict vocabulary. Never assert that the user is right. */
export const VERDICTS = Object.freeze({
  SUPPORTED: 'supported',
  PARTIALLY_SUPPORTED: 'partially_supported',
  UNVERIFIABLE: 'unverifiable',
  NEEDS_VERIFICATION: 'needs_verification',
  CONFLICTS: 'conflicts'
});

export const VERDICT_LABELS = Object.freeze({
  [VERDICTS.SUPPORTED]: 'Supported by the provided context',
  [VERDICTS.PARTIALLY_SUPPORTED]: 'Partially supported',
  [VERDICTS.UNVERIFIABLE]: 'Cannot be verified from available evidence',
  [VERDICTS.NEEDS_VERIFICATION]: 'Needs verification',
  [VERDICTS.CONFLICTS]: 'Conflicts with the source'
});

/**
 * One plain-language line per verdict, shown under the verdict in the review
 * panel. Review decision Q7: the calibrated labels stay exact, and the
 * explainer makes them legible to a non-technical reader.
 */
export const VERDICT_EXPLAINERS = Object.freeze({
  [VERDICTS.SUPPORTED]: 'Follows from evidence given in this review.',
  [VERDICTS.PARTIALLY_SUPPORTED]: 'Partly follows; part of it still needs checking.',
  [VERDICTS.UNVERIFIABLE]: 'Could not be checked even with sources — for example a prediction or an opinion.',
  [VERDICTS.NEEDS_VERIFICATION]: 'A factual claim about the outside world that has not been checked against a source.',
  [VERDICTS.CONFLICTS]: 'Contradicts another claim in the text, or a source returned for this review.'
});

/** Phrasing the product must never emit. Enforced by validation and lint. */
export const PROHIBITED_ASSURANCES = Object.freeze([
  'undetectable',
  'guaranteed human',
  'guaranteed correct',
  'passes ai detection',
  'bypasses ai detection',
  '100% accurate',
  'you are right',
  "you're right",
  'you are correct'
]);

export const SEVERITY = Object.freeze({
  ERROR: 'error',
  RISK: 'risk',
  IMPROVEMENT: 'improvement'
});
