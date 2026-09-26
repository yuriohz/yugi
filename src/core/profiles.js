/**
 * Writing profiles.
 *
 * A profile is the writer's context: who they are writing to, how they sound,
 * which words they insist on, and which words must never be touched.
 *
 * Everything here is validated before it is stored, because a profile feeds
 * directly into the prompt and an unvalidated field is an injection surface.
 */
import { LIMITS, DEFAULT_LOCALE } from './constants.js';

export const PROFILE_LIMITS = Object.freeze({
  NAME: 60,
  AUDIENCE: 120,
  RELATIONSHIP: 120,
  VOICE: 600,
  TERM: 80,
  TERMS: 100,
  SAMPLES: LIMITS.MAX_VOICE_SAMPLES,
  SAMPLE: LIMITS.MAX_VOICE_SAMPLE_CHARS,
  PROFILES: 20,
  SITE_RULES: 50
});

export function defaultProfiles() {
  return [
    makeProfile({ id: 'personal', name: 'Personal', audience: 'Friends and family', formality: 1, directness: 3 }),
    makeProfile({ id: 'work', name: 'Work', audience: 'Colleagues and clients', formality: 3, directness: 3, contractions: true })
  ];
}

export function makeProfile(patch = {}) {
  return {
    id: patch.id || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: patch.name || 'New profile',
    audience: patch.audience || '',
    relationship: patch.relationship || '',
    voiceDescription: patch.voiceDescription || '',
    locale: patch.locale || DEFAULT_LOCALE,
    formality: numberOr(patch.formality, 2),
    directness: numberOr(patch.directness, 2),
    contractions: patch.contractions ?? null,
    emoji: patch.emoji ?? false,
    greeting: patch.greeting || '',
    signoff: patch.signoff || '',
    preferredTerms: patch.preferredTerms || [],
    blockedTerms: patch.blockedTerms || [],
    protectedTerms: patch.protectedTerms || [],
    samples: patch.samples || [],
    siteRules: patch.siteRules || [],
    defaultModeId: patch.defaultModeId || null,
    createdAt: patch.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.round(n))) : fallback;
}

/**
 * Validate and normalise a profile.
 * @returns {{ok: boolean, profile: object|null, errors: string[], warnings: string[]}}
 */
export function validateProfile(input) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object') return { ok: false, profile: null, errors: ['A profile must be an object.'], warnings };

  const name = clean(input.name, PROFILE_LIMITS.NAME);
  if (!name) errors.push('A profile needs a name.');

  const profile = makeProfile({
    ...input,
    name,
    audience: clean(input.audience, PROFILE_LIMITS.AUDIENCE),
    relationship: clean(input.relationship, PROFILE_LIMITS.RELATIONSHIP),
    voiceDescription: clean(input.voiceDescription, PROFILE_LIMITS.VOICE),
    greeting: clean(input.greeting, PROFILE_LIMITS.TERM),
    signoff: clean(input.signoff, PROFILE_LIMITS.TERM),
    preferredTerms: cleanTerms(input.preferredTerms, warnings, 'preferred'),
    blockedTerms: cleanTerms(input.blockedTerms, warnings, 'blocked'),
    protectedTerms: cleanTerms(input.protectedTerms, warnings, 'protected'),
    samples: cleanSamples(input.samples, warnings),
    siteRules: cleanSiteRules(input.siteRules, warnings)
  });

  // A term cannot be both required and forbidden.
  const blocked = new Set(profile.blockedTerms.map(t => t.toLowerCase()));
  const clash = profile.preferredTerms.filter(t => blocked.has(t.toLowerCase()));
  if (clash.length) errors.push(`These terms are both preferred and blocked: ${clash.join(', ')}.`);

  const protectedClash = profile.protectedTerms.filter(t => blocked.has(t.toLowerCase()));
  if (protectedClash.length) errors.push(`These terms are both protected and blocked: ${protectedClash.join(', ')}.`);

  return { ok: errors.length === 0, profile: errors.length ? null : profile, errors, warnings };
}

function clean(value, max) {
  return String(value ?? '')
    // Control characters have no place in a prompt.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function cleanTerms(list, warnings, label) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const term = clean(raw, PROFILE_LIMITS.TERM);
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= PROFILE_LIMITS.TERMS) {
      warnings.push(`Only the first ${PROFILE_LIMITS.TERMS} ${label} terms were kept.`);
      break;
    }
  }
  return out;
}

function cleanSamples(list, warnings) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const sample = clean(raw, PROFILE_LIMITS.SAMPLE);
    if (sample.length < 20) continue;
    out.push(sample);
    if (out.length >= PROFILE_LIMITS.SAMPLES) {
      warnings.push(`Only the first ${PROFILE_LIMITS.SAMPLES} voice samples were kept.`);
      break;
    }
  }
  return out;
}

function cleanSiteRules(list, warnings) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const rule of list) {
    const host = clean(rule?.host, 120).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!host || !/^[a-z0-9.-]+$/.test(host)) continue;
    out.push({
      host,
      modeId: clean(rule?.modeId, 60) || null,
      profileId: clean(rule?.profileId, 60) || null
    });
    if (out.length >= PROFILE_LIMITS.SITE_RULES) {
      warnings.push('Some site rules were dropped: the limit is 50.');
      break;
    }
  }
  return out;
}

/**
 * Derive a short, human-readable voice description from samples, so the user
 * can see what the extension believes their voice is. Deterministic and local:
 * this is a description of measurable features, not an interpretation.
 */
export function describeVoice(samples = []) {
  const text = samples.join('\n');
  if (!text.trim()) return null;

  const sentences = text.split(/(?<=[.!?؟])\s+/).filter(s => s.trim());
  const words = text.match(/\S+/g) || [];
  const avgSentence = sentences.length ? Math.round(words.length / sentences.length) : 0;
  const contractions = (text.match(/\b\w+['’](?:s|t|re|ve|ll|d|m)\b/gi) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/[?؟]/g) || []).length;
  const emoji = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  const hedges = (text.match(/\b(?:maybe|perhaps|might|possibly|i think|probably|sort of|kind of)\b/gi) || []).length;

  const traits = [];
  if (avgSentence <= 12) traits.push('short sentences');
  else if (avgSentence >= 24) traits.push('long sentences');
  else traits.push('medium-length sentences');

  if (contractions / Math.max(1, sentences.length) > 0.4) traits.push('uses contractions');
  else if (contractions === 0) traits.push('avoids contractions');

  if (hedges / Math.max(1, sentences.length) > 0.3) traits.push('hedges often');
  else if (hedges === 0) traits.push('states things directly');

  if (exclamations) traits.push('uses exclamation marks');
  if (questions > sentences.length * 0.3) traits.push('asks questions');
  if (emoji) traits.push('uses emoji');

  return {
    traits,
    metrics: { samples: samples.length, words: words.length, sentences: sentences.length, avgSentence, contractions, exclamations, questions, emoji, hedges },
    summary: traits.join(', '),
    // Made explicit so the UI never presents this as an interpretation.
    basis: 'Measured from your samples. These are counts, not a judgement about how you write.'
  };
}

export function upsertProfile(profiles, profile) {
  const list = Array.isArray(profiles) ? [...profiles] : [];
  const index = list.findIndex(p => p.id === profile.id);
  if (index >= 0) list[index] = { ...list[index], ...profile, updatedAt: Date.now() };
  else list.push(profile);
  return list.slice(0, PROFILE_LIMITS.PROFILES);
}

export function removeProfile(profiles, id) {
  const list = (Array.isArray(profiles) ? profiles : []).filter(p => p.id !== id);
  // There must always be somewhere to write from.
  return list.length ? list : defaultProfiles();
}
