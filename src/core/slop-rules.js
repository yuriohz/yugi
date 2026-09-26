/**
 * Anti-slop rule set.
 *
 * ADAPTED FROM: No AI Slop by Peter Yang — https://github.com/petergyang/no-ai-slop
 * LICENCE:      MIT (full text in THIRD_PARTY_NOTICES.md)
 * COMMIT:       000650b156983f5159695b441477f4e63b25dc85
 * SOURCE FILE:  skills/no-ai-slop/SKILL.md ("Words to cut", "Patterns to cut")
 *
 * The upstream project states these rules as editor guidance in prose. WriteRight
 * restates them as typed records so they can be detected locally without a model
 * call, explained to the user, and verified after a rewrite.
 *
 * Arabic rules in ARABIC_SLOP_RULES are WriteRight's own work and are not part of
 * the upstream project.
 */

export const UPSTREAM = Object.freeze({
  project: 'no-ai-slop',
  author: 'Peter Yang',
  url: 'https://github.com/petergyang/no-ai-slop',
  licence: 'MIT',
  commit: '000650b156983f5159695b441477f4e63b25dc85',
  retrieved: '2026-09-26'
});

/** Words banned outright upstream. Removal must still preserve meaning. */
export const BANNED_WORDS = Object.freeze([
  'delve', 'foster', 'leverage', 'utilize', 'utilise', 'facilitate', 'empower',
  'streamline', 'robust', 'cutting-edge', 'paradigm shift', 'game changer',
  'game-changer', 'this is huge', 'this changes everything', 'tapestry', 'realm',
  'beacon', 'multifaceted', 'meticulous', 'intricate', 'paramount',
  'transformative', 'elevate', 'embark', 'supercharge', 'harness', 'ever-evolving'
]);

/**
 * Adverbs that are usually empty. Upstream is explicit that these are kept when
 * they carry emphasis, uncertainty, contrast, or the writer's spoken rhythm, so
 * these are advisory, never automatic deletions.
 */
export const EMPTY_ADVERBS = Object.freeze([
  'just', 'literally', 'honestly', 'simply', 'actually', 'truly',
  'fundamentally', 'importantly', 'crucially', 'inherently', 'inevitably'
]);

/** Phrases that usually delay the point. Also advisory. */
export const EMPTY_PHRASES = Object.freeze([
  "it's worth noting", 'it is worth noting', "it's important to note",
  'it is important to note', 'at the end of the day', 'when it comes to',
  'at its core', "in today's world", 'in the age of', 'in the world of',
  'the reality is', 'the truth is', 'in terms of', 'with regard to',
  'in order to', 'going forward', 'in this article', "let's dive in"
]);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordBoundary = list => new RegExp(`\\b(?:${list.map(esc).join('|')})\\b`, 'gi');

/**
 * Named patterns from the upstream "Patterns to cut" section.
 *
 * @typedef {object} SlopRule
 * @property {string} id              stable identifier
 * @property {string} title           short user-facing name
 * @property {string} why             why it reads as slop
 * @property {string} fix             the upstream remedy, in a few words
 * @property {'high'|'medium'|'low'} severity
 * @property {RegExp[]} detect        detection expressions (global, case-insensitive)
 * @property {boolean} [advisory]     true when the pattern is often legitimate
 */

/** @type {readonly SlopRule[]} */
export const SLOP_RULES = Object.freeze([
  {
    id: 'binary-contrast',
    title: 'Binary contrast',
    why: 'Sets up a fake opposition instead of stating the point.',
    fix: 'State the second half directly.',
    severity: 'high',
    detect: [
      /\b(?:it'?s|this is|that'?s)\s+not\s+(?:just\s+)?[^.!?;]{1,60}?[,.]?\s+it'?s\s+/gi,
      /\bthe\s+question\s+is\s?n'?o?t\s+[^.!?;]{1,60}?,\s*it'?s\s+/gi,
      /\bnot\s+(?:about|because of)\s+[^.!?;]{1,60}?[,.]\s*(?:it'?s|but)\s+/gi
    ]
  },
  {
    id: 'throat-clearing',
    title: 'Throat-clearing opener',
    why: 'Delays the point with a stock preamble.',
    fix: 'Delete it and state the point.',
    severity: 'high',
    detect: [
      /(?:^|[.!?]\s+|\n)\s*(?:here'?s the thing|here'?s what i mean|let me be clear|i'?ll be honest|the uncomfortable truth is|let'?s be honest)\b/gi
    ]
  },
  {
    id: 'faux-insight',
    title: 'Faux-insight setup',
    why: 'Flatters the writer as the lone expert before the claim arrives.',
    fix: 'Cut the setup; let the claim stand alone.',
    severity: 'high',
    detect: [
      /\b(?:this is the part most people skip|what most people get wrong|here'?s what nobody tells you|the part (?:everyone|most people) miss(?:es)?|nobody talks about)\b/gi
    ]
  },
  {
    id: 'colon-reveal',
    title: 'Colon reveal',
    why: 'Uses a colon for manufactured drama.',
    fix: 'Rewrite as a plain sentence.',
    severity: 'medium',
    detect: [
      /(?:^|[.!?]\s+|\n)\s*(?:the (?:best|worst|real|hard|key|whole|only|weird|funny|interesting) (?:part|thing|bit|truth|question|detail|catch|problem|reason)|the detail that [a-z ]{3,40}|the result)\s*:\s+[a-z]/g
    ]
  },
  {
    id: 'superficial-analysis',
    title: 'Superficial analysis',
    why: 'Trailing participle clauses pretend to explain significance.',
    fix: 'Replace with the concrete consequence.',
    severity: 'high',
    detect: [
      /,\s+(?:highlighting|underscoring|reflecting|showcasing|demonstrating|signalling|signaling|emphasizing|emphasising|illustrating)\b/gi
    ]
  },
  {
    id: 'importance-puffery',
    title: 'Importance puffery',
    why: 'Announces significance instead of showing it.',
    fix: 'State the fact and let the reader judge.',
    severity: 'high',
    detect: [
      /\b(?:stands as a testament|marks a (?:pivotal|defining|watershed) moment|plays a (?:vital|crucial|pivotal|key) role|solidif(?:ies|ying) its position|underscores its significance|is a testament to|represents a significant (?:step|milestone|leap))\b/gi
    ]
  },
  {
    id: 'interpretive-metadiscourse',
    title: 'Interpretive metadiscourse',
    why: 'Steps outside the subject to tell the reader what to notice.',
    fix: 'Delete it, or replace it with supporting fact.',
    severity: 'medium',
    detect: [
      /\b(?:that last (?:part|point) matters more than it sounds|the key (?:point|takeaway) (?:here )?is|as you can see|this distinction matters|which is to say|in other words,\s+(?=[^.!?]{0,80}$))/gi
    ]
  },
  {
    id: 'weasel-attribution',
    title: 'Weasel attribution',
    why: 'Cites authority without naming a source.',
    fix: 'Name the source or cut the claim. Never invent one.',
    severity: 'high',
    detect: [
      /\b(?:experts (?:agree|say)|industry reports suggest|many (?:argue|believe|say)|widely (?:regarded|considered|seen) as|studies show|research (?:shows|suggests)|it is (?:widely )?believed)\b/gi
    ]
  },
  {
    id: 'fake-strong-verb',
    title: 'Fake-strong verb',
    why: 'Inflated verb phrase where "is" or "has" is clearer.',
    fix: 'Use the plain verb.',
    severity: 'medium',
    detect: [
      /\b(?:serves as|acts as|functions as|stands as)\s+(?:a|an|the)\b/gi,
      /\b(?:made? a decision|has the ability to|have the ability to|provides? assistance|conduct(?:s|ed)? an? (?:analysis|review)|give consideration to)\b/gi
    ]
  },
  {
    id: 'negative-listing',
    title: 'Negative listing',
    why: 'Defines by what something is not.',
    fix: 'Just say what it is.',
    severity: 'medium',
    detect: [
      /\bnot\s+an?\s+[a-z-]+\.\s+not\s+an?\s+[a-z-]+\./gi
    ]
  },
  {
    id: 'dramatic-fragmentation',
    title: 'Dramatic fragmentation',
    why: 'Stacked fragments used for rhythm rather than meaning.',
    fix: 'Use complete sentences.',
    severity: 'medium',
    detect: [
      /\bthat'?s it\.\s+that'?s (?:the whole thing|it)\b/gi,
      /(?:^|\n)\s*and\s+[a-z][^.!?\n]{0,40}\.\s+and\s+[a-z][^.!?\n]{0,40}\./gi
    ]
  },
  {
    id: 'rhetorical-setup',
    title: 'Rhetorical setup',
    why: 'Stage-manages the reader instead of making the point.',
    fix: 'Drop the setup.',
    severity: 'high',
    detect: [
      /\b(?:what if i told you|think about it\s*:|plot twist\s*:|let that sink in|sound familiar\s*\?)/gi
    ]
  },
  {
    id: 'fake-profound-kicker',
    title: 'Fake-profound kicker',
    why: 'Ends on an aphorism instead of a concrete point.',
    fix: 'Delete it; end on the clearest concrete sentence.',
    severity: 'medium',
    advisory: true,
    detect: [
      /(?:^|\n)\s*(?:and that,?\s+(?:my friends|really|ultimately),?|and that'?s (?:the|what) (?:real |whole |entire )?(?:point|magic|beauty|power))\b/gi,
      /\bthe (?:future|answer|rest) is (?:already )?(?:here|now|written|up to (?:you|us))\.\s*$/gi
    ]
  },
  {
    id: 'summary-recap',
    title: 'Summary-recap ending',
    why: 'Restates a piece the reader has just read.',
    fix: 'End on the last concrete point or next action.',
    severity: 'medium',
    detect: [
      /(?:^|\n)\s*(?:in conclusion|to sum up|to summarise|to summarize|overall,|ultimately,|in summary)\b/gi
    ]
  },
  {
    id: 'formatting-slop',
    title: 'Formatting slop',
    why: 'Decoration instead of structure.',
    fix: 'Let format follow content.',
    severity: 'low',
    advisory: true,
    detect: [
      /^#{1,6}\s+[^\n]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gmu,
      /[^\n*]\*\*[^*\n]{1,40}\*\*[^\n*]/g
    ]
  },
  {
    id: 'em-dash-crutch',
    title: 'Em-dash crutch',
    why: 'Em dashes used as default rhythm rather than for clarity.',
    fix: 'Prefer commas, full stops, or brackets.',
    severity: 'low',
    advisory: true,
    detect: [/—/g]
  },
  {
    id: 'synonym-cycling',
    title: 'Synonym cycling',
    why: 'Rotates terms for style and loses the clear word.',
    fix: 'Repeat the correct word.',
    severity: 'low',
    advisory: true,
    detect: [
      /\b(?:the (?:agent|assistant|tool|system|platform|solution))\b[^.!?]*\.\s*[^.!?]*\b(?:the (?:agent|assistant|tool|system|platform|solution))\b/gi
    ]
  },
  {
    id: 'banned-word',
    title: 'Banned word',
    why: 'Upstream bans these outright as AI vocabulary.',
    fix: 'Use a plain, specific word — unless removing it changes the meaning.',
    severity: 'high',
    detect: [wordBoundary(BANNED_WORDS)]
  },
  {
    id: 'empty-adverb',
    title: 'Often-empty adverb',
    why: 'Usually adds nothing.',
    fix: 'Cut unless it carries emphasis, uncertainty, or spoken rhythm.',
    severity: 'low',
    advisory: true,
    detect: [wordBoundary(EMPTY_ADVERBS)]
  },
  {
    id: 'empty-phrase',
    title: 'Often-empty phrase',
    why: 'Delays the point.',
    fix: 'Cut unless it is part of the writer’s recognisable voice.',
    severity: 'medium',
    advisory: true,
    detect: [wordBoundary(EMPTY_PHRASES)]
  }
]);

/**
 * Arabic-specific slop patterns. WriteRight original work, built on the same
 * taxonomy: inflated register, empty connectives, and ceremonial padding that
 * machine translation and LLMs add to Arabic prose.
 */
export const ARABIC_SLOP_RULES = Object.freeze([
  {
    id: 'ar-inflated-register',
    title: 'تضخيم لغوي',
    titleEn: 'Inflated Arabic register',
    why: 'Formal padding that adds no information.',
    fix: 'Use the plain Arabic verb or noun.',
    severity: 'high',
    detect: [/\b(?:يُعَدُّ|تُعَدُّ|يعد بمثابة|في هذا الصدد|جدير بالذكر|تجدر الإشارة إلى)\b/g]
  },
  {
    id: 'ar-empty-connective',
    title: 'روابط فارغة',
    titleEn: 'Empty Arabic connective',
    why: 'Stock connectives used as rhythm.',
    fix: 'Join the clauses directly.',
    severity: 'medium',
    advisory: true,
    detect: [/\b(?:ومن ناحية أخرى|وفي نهاية المطاف|وفي الختام|بشكل عام|في واقع الأمر|لا شك أن)\b/g]
  },
  {
    id: 'ar-ceremonial-padding',
    title: 'حشو مجاملات',
    titleEn: 'Ceremonial padding',
    why: 'Courtesy formulas stacked beyond what the message needs.',
    fix: 'Keep one greeting; delete the rest.',
    severity: 'medium',
    advisory: true,
    detect: [/(?:تحياتي الحارة|مع خالص التقدير والاحترام|وتفضلوا بقبول فائق الاحترام)/g]
  },
  {
    id: 'ar-importance-puffery',
    title: 'تفخيم الأهمية',
    titleEn: 'Arabic importance puffery',
    why: 'Announces significance instead of showing it.',
    fix: 'State the fact plainly.',
    severity: 'high',
    detect: [/\b(?:يمثل نقلة نوعية|يشكل علامة فارقة|يلعب دوراً محورياً|يلعب دورا محوريا|ذو أهمية قصوى)\b/g]
  }
]);

/** Lookup by id across both rule sets. */
export const ALL_RULES = Object.freeze([...SLOP_RULES, ...ARABIC_SLOP_RULES]);

export function getRule(id) {
  return ALL_RULES.find(r => r.id === id) || null;
}
