/**
 * Personal dictionary.
 *
 * Words the user has told WriteRight to stop correcting. Entries are scoped so
 * a name that is fine at work is not silently accepted everywhere.
 */

export const DICTIONARY_LIMIT = 2000;

export const SCOPE = Object.freeze({ GLOBAL: 'global', PROFILE: 'profile', SITE: 'site' });

export function makeEntry(word, { scope = SCOPE.GLOBAL, scopeId = null, caseSensitive = false, note = '' } = {}) {
  return {
    word: String(word ?? '').trim().slice(0, 80),
    scope,
    scopeId: scopeId ? String(scopeId).slice(0, 80) : null,
    caseSensitive: Boolean(caseSensitive),
    note: String(note ?? '').trim().slice(0, 200),
    addedAt: Date.now()
  };
}

export function addWord(dictionary, word, options = {}) {
  const entry = makeEntry(word, options);
  if (!entry.word) return { ok: false, dictionary, error: 'Enter a word first.' };
  if (entry.word.length > 80) return { ok: false, dictionary, error: 'That entry is too long.' };

  const list = Array.isArray(dictionary) ? dictionary : [];
  if (list.some(e => sameEntry(e, entry))) {
    return { ok: false, dictionary: list, error: `“${entry.word}” is already in your dictionary.` };
  }
  if (list.length >= DICTIONARY_LIMIT) {
    return { ok: false, dictionary: list, error: `Your dictionary is full (${DICTIONARY_LIMIT} entries).` };
  }
  return { ok: true, dictionary: [...list, entry], error: '' };
}

export function removeWord(dictionary, word, { scope = SCOPE.GLOBAL, scopeId = null } = {}) {
  const list = Array.isArray(dictionary) ? dictionary : [];
  return list.filter(e => !(e.word.toLowerCase() === String(word).toLowerCase() && e.scope === scope && e.scopeId === scopeId));
}

function sameEntry(a, b) {
  return a.scope === b.scope
    && a.scopeId === b.scopeId
    && (a.caseSensitive || b.caseSensitive ? a.word === b.word : a.word.toLowerCase() === b.word.toLowerCase());
}

/**
 * The words that apply right now.
 * @returns {string[]}
 */
export function activeWords(dictionary, { profileId = null, origin = null } = {}) {
  const host = hostOf(origin);
  return (Array.isArray(dictionary) ? dictionary : [])
    .filter(entry => {
      if (entry.scope === SCOPE.GLOBAL) return true;
      if (entry.scope === SCOPE.PROFILE) return entry.scopeId === profileId;
      if (entry.scope === SCOPE.SITE) return Boolean(host) && host.endsWith(entry.scopeId || '\u0000');
      return false;
    })
    .map(entry => entry.word);
}

/** Should this issue be suppressed by the dictionary? */
export function isAllowed(word, dictionary, context = {}) {
  const host = hostOf(context.origin);
  return (Array.isArray(dictionary) ? dictionary : []).some(entry => {
    if (entry.scope === SCOPE.PROFILE && entry.scopeId !== context.profileId) return false;
    if (entry.scope === SCOPE.SITE && !(host && host.endsWith(entry.scopeId || '\u0000'))) return false;
    return entry.caseSensitive ? entry.word === word : entry.word.toLowerCase() === String(word).toLowerCase();
  });
}

/** Drop issues whose original text is a dictionary word. */
export function filterIssues(issues, dictionary, context = {}) {
  return (issues || []).filter(issue => !isAllowed(issue.original, dictionary, context));
}

function hostOf(origin) {
  if (!origin) return null;
  try { return new URL(origin).host; } catch { return String(origin); }
}
