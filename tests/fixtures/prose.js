/**
 * Fixture corpus for the anti-slop engine.
 *
 * `SLOPPY` samples each seed a specific named pattern.
 * `CLEAN` samples are ordinary human prose that must not trigger non-advisory rules.
 */

export const SLOPPY = [
  { ruleId: 'binary-contrast', text: "This isn't a tooling problem. It's a trust problem." },
  { ruleId: 'throat-clearing', text: "Here's the thing. We shipped the migration on Tuesday." },
  { ruleId: 'faux-insight', text: 'What most people get wrong is that the eval matters more than the model.' },
  { ruleId: 'colon-reveal', text: 'The best part: it learns from the corrections you accept.' },
  { ruleId: 'superficial-analysis', text: "The launch adds file search, highlighting the team's commitment to better workflows." },
  { ruleId: 'importance-puffery', text: 'The release marks a pivotal moment for the company.' },
  { ruleId: 'interpretive-metadiscourse', text: 'The key point is that the retry budget is two attempts.' },
  { ruleId: 'weasel-attribution', text: 'Experts agree that latency drives churn.' },
  { ruleId: 'fake-strong-verb', text: 'The app serves as a centralised hub for sponsor management.' },
  { ruleId: 'negative-listing', text: 'Not a database. Not a queue. A ledger.' },
  { ruleId: 'dramatic-fragmentation', text: "That's it. That's the whole thing." },
  { ruleId: 'rhetorical-setup', text: 'What if I told you the bottleneck was the review queue?' },
  { ruleId: 'summary-recap', text: 'In conclusion, the migration reduced deploy time.' },
  { ruleId: 'banned-word', text: 'We should leverage the robust new pipeline to streamline delivery.' },
  { ruleId: 'empty-phrase', text: "It's worth noting that the deadline moved to 14 March." },
  { ruleId: 'em-dash-crutch', text: 'The build failed — twice — before lunch.' }
];

export const CLEAN = [
  'The deploy failed twice before lunch. I rolled back to 4.2.1 and filed WR-318.',
  "Can you send the invoice by Friday? I need it before the quarter closes.",
  'I disagree. The 40-minute build is the problem, not the test suite.',
  'Sorry for the slow reply — I was travelling. The contract is signed and in your inbox.',
  'We cut review time from 30 minutes to 8 by batching the lint and type checks.'
];

export const ARABIC_SLOPPY = [
  { ruleId: 'ar-inflated-register', text: 'جدير بالذكر أن الفريق أنهى المراجعة يوم الثلاثاء.' },
  { ruleId: 'ar-importance-puffery', text: 'هذا الإصدار يمثل نقلة نوعية في المنتج.' },
  { ruleId: 'ar-empty-connective', text: 'وفي نهاية المطاف قررنا تأجيل الإطلاق.' },
  { ruleId: 'ar-ceremonial-padding', text: 'وتفضلوا بقبول فائق الاحترام.' }
];

export const ARABIC_CLEAN = [
  'أرسلت الفاتورة أمس. المبلغ ٤٥٠ دولاراً ويستحق يوم ١٤ مارس.',
  'لا أوافق على تأجيل الإطلاق. الفريق جاهز والاختبارات ناجحة.'
];

/** Text that must survive untouched: protected regions. */
export const PROTECTED = [
  'He wrote "this is a game changer" in the ticket, which I disagree with.',
  'Run `npm run leverage-check` before the release.',
  'See https://example.com/delve-into-the-realm for the spec.'
];
