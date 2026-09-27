/**
 * Language, register and direction.
 *
 * WordSaffron defaults to British English. Arabic is first-class: Modern
 * Standard Arabic for Polish, Polite, Professional & Firm and Technical Review,
 * and natural Egyptian Arabic for Casual, because MSA reads stiff in a chat.
 */
import { LOCALES, DEFAULT_LOCALE } from './constants.js';

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_RANGE = /[A-Za-z]/;

/**
 * Detect the script mix of a text.
 * @returns {{script: 'arabic'|'latin'|'mixed'|'unknown', arabicChars: number, latinChars: number, dominant: 'arabic'|'latin'|null}}
 */
export function detectScript(text) {
  const source = String(text ?? '');
  const arabicChars = (source.match(new RegExp(ARABIC_RANGE, 'g')) || []).length;
  const latinChars = (source.match(/[A-Za-z]/g) || []).length;

  if (!arabicChars && !latinChars) return { script: 'unknown', arabicChars, latinChars, dominant: null };
  if (arabicChars && !latinChars) return { script: 'arabic', arabicChars, latinChars, dominant: 'arabic' };
  if (latinChars && !arabicChars) return { script: 'latin', arabicChars, latinChars, dominant: 'latin' };

  const dominant = arabicChars >= latinChars ? 'arabic' : 'latin';
  return { script: 'mixed', arabicChars, latinChars, dominant };
}

/**
 * Egyptian Arabic markers. Presence of these means the writer is already
 * writing Egyptian, so Casual should stay there and MSA modes should not
 * flatten a quoted colloquial phrase.
 */
const EGYPTIAN_MARKERS = [
  'مش', 'كده', 'دلوقتي', 'عايز', 'عاوز', 'إزيك', 'ازيك', 'ايه', 'إيه',
  'ماشي', 'خلاص', 'بقى', 'علشان', 'عشان', 'حاجة', 'شوية', 'كمان', 'أوي', 'اوي'
];

export function looksEgyptian(text) {
  const source = String(text ?? '');
  return EGYPTIAN_MARKERS.some(marker => source.includes(marker));
}

/**
 * Resolve the locale actually used for a request.
 *
 * Precedence: the script of the text the user is editing wins over the stored
 * preference, because a user writing Arabic in an English-configured browser
 * expects Arabic back. Within Arabic, an explicit per-profile dialect choice
 * wins over the mode default (review decision Q5), so a Gulf or Maghreb user
 * is not forced into Egyptian Casual, and an Egyptian user can hold Egyptian
 * across every mode.
 */
export function resolveLocale({ text = '', settings = {}, profile = null, mode = null } = {}) {
  const configured = profile?.locale || settings.locale || DEFAULT_LOCALE;
  const { script, dominant } = detectScript(text);

  if (dominant === 'arabic' || (script === 'unknown' && String(configured).startsWith('ar'))) {
    const profileArabic = normaliseArabicLocale(profile?.locale);
    // Explicit profile dialect first, then the mode default (Casual is
    // Egyptian, everything else MSA), then the writer's own markers.
    const register = profileArabic || mode?.arabicRegister
      || (looksEgyptian(text) ? LOCALES.AR_EG : LOCALES.AR);
    return { locale: register, script: script === 'unknown' ? 'arabic' : script, direction: 'rtl', mixed: script === 'mixed' };
  }

  const english = String(configured).startsWith('en') ? configured : DEFAULT_LOCALE;
  return { locale: english, script: script === 'unknown' ? 'latin' : script, direction: 'ltr', mixed: script === 'mixed' };
}

/** Accept only the Arabic locales WordSaffron can actually write. */
export function normaliseArabicLocale(locale) {
  return locale === LOCALES.AR_EG || locale === LOCALES.AR ? locale : null;
}

const LOCALE_NAMES = {
  [LOCALES.EN_GB]: 'British English',
  [LOCALES.EN_US]: 'American English',
  [LOCALES.AR]: 'Modern Standard Arabic (العربية الفصحى)',
  [LOCALES.AR_EG]: 'Egyptian Arabic (العامية المصرية)'
};

export function localeName(locale) { return LOCALE_NAMES[locale] || locale; }

/** Build the locale layer of the system prompt. */
export function localeLayerFor({ text = '', settings = {}, profile = null, mode = null } = {}) {
  const resolved = resolveLocale({ text, settings, profile, mode });
  const lines = ['# Language and register', `Write in ${localeName(resolved.locale)}.`];

  switch (resolved.locale) {
    case LOCALES.EN_GB:
      lines.push(
        'Use British spelling: -ise and -isation rather than -ize and -ization, -our (colour, behaviour, favour), -re (centre, metre), -ogue (catalogue, dialogue), and doubled l (travelled, cancelled, modelling).',
        'Use British punctuation: single quotation marks for speech with double marks inside them, full stops outside a closing quotation mark unless the quoted material is a complete sentence, and no full stops in contractions such as Mr, Mrs, Dr.',
        'Use day-month-year dates (14 March 2026), and British vocabulary where it differs (autumn, mobile, flat, holiday, post, lift).'
      );
      break;
    case LOCALES.EN_US:
      lines.push('Use American spelling, punctuation and date order (March 14, 2026).');
      break;
    case LOCALES.AR:
      lines.push(
        'اكتب بالعربية الفصحى الحديثة. استخدم تركيباً واضحاً ومباشراً، وتجنّب الحشو والتفخيم.',
        'Write in Modern Standard Arabic. Keep the register professional and plain: correct case endings where they matter, no ceremonial padding, no stacked courtesy formulas.',
        'Do not translate names, product names, technical terms, code, or URLs. Leave them in their original script.',
        'Keep numbers in the same digit form the writer used. Do not convert between ٠١٢٣ and 0123.'
      );
      break;
    case LOCALES.AR_EG:
      lines.push(
        'اكتب بالعامية المصرية الطبيعية، زي ما حد بيكتب لصاحبه أو لزميله في الشغل.',
        'Write in natural Egyptian Arabic, the way a person actually types to a friend or a colleague. Not Modern Standard Arabic, and not a translation of English.',
        'Do not invent slang or force colloquialism. If the writer used a Standard Arabic phrase deliberately, keep it.',
        'Do not translate names, product names, technical terms, code, or URLs.',
        'Keep numbers in the same digit form the writer used.'
      );
      break;
    default:
      break;
  }

  if (resolved.mixed) {
    lines.push(
      '',
      'This text mixes Arabic and Latin script. Keep every Latin-script term, brand, code identifier and URL exactly as written, in Latin script.',
      'Do not transliterate them into Arabic, and do not translate them.',
      `Keep the base direction ${resolved.direction === 'rtl' ? 'right-to-left' : 'left-to-right'}, matching the dominant script.`
    );
  }

  return lines.join('\n');
}
