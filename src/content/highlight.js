/**
 * Exact-range underlining.
 *
 * Chrome's CSS Custom Highlight API draws over precise ranges without touching
 * the page's DOM, which is the only safe option inside someone else's editor.
 * Where it is unavailable, WriteRight falls back to an overlay for textareas
 * and inputs, and to no underline at all for contenteditable — because a wrong
 * underline is worse than none.
 */
import { locateInNode, toSegments } from '../core/ranges.js';

const HIGHLIGHT_NAMES = { error: 'wr-error', risk: 'wr-risk', improvement: 'wr-improvement' };

export function highlightSupported() {
  return typeof CSS !== 'undefined'
    && typeof CSS.highlights !== 'undefined'
    && typeof Highlight === 'function';
}

/** Severity of the strongest issue covering a segment. */
function severityFor(issues, indexes) {
  const order = ['error', 'risk', 'improvement'];
  const found = indexes.map(i => mapCategory(issues[i])).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return found[0] || 'improvement';
}

function mapCategory(issue) {
  if (!issue) return 'improvement';
  if (issue.severity && HIGHLIGHT_NAMES[issue.severity]) return issue.severity;
  return issue.category === 'clarity' ? 'improvement' : 'error';
}

/**
 * Draw underlines for `issues` over the text of `element`.
 * @returns {{drawn: number, method: 'highlight-api'|'none'}}
 */
export function drawHighlights(element, issues, text) {
  clearHighlights();
  if (!element || !issues?.length || !highlightSupported()) {
    return { drawn: 0, method: 'none' };
  }

  const root = element.matches?.('input, textarea') ? null : element;
  if (!root) {
    // Inputs and textareas contain no text nodes to highlight. The panel still
    // lists every issue, and the field keeps its field-level marker.
    return { drawn: 0, method: 'none' };
  }

  const buckets = { error: [], risk: [], improvement: [] };
  for (const segment of toSegments(issues, text.length)) {
    const from = locateInNode(root, segment.start);
    const to = locateInNode(root, segment.end);
    if (!from || !to) continue;
    try {
      const range = new Range();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      buckets[severityFor(issues, segment.issues)].push(range);
    } catch {
      // A range that cannot be constructed is skipped, never approximated.
    }
  }

  let drawn = 0;
  for (const [severity, ranges] of Object.entries(buckets)) {
    if (!ranges.length) continue;
    CSS.highlights.set(HIGHLIGHT_NAMES[severity], new Highlight(...ranges));
    drawn += ranges.length;
  }
  return { drawn, method: drawn ? 'highlight-api' : 'none' };
}

export function clearHighlights() {
  if (!highlightSupported()) return;
  for (const name of Object.values(HIGHLIGHT_NAMES)) CSS.highlights.delete(name);
}
