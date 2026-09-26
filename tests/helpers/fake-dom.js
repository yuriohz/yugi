/**
 * A tiny DOM stand-in.
 *
 * The adapters only use querySelector, querySelectorAll, textContent, classList
 * and closest. Rather than pull in a full DOM implementation, this builds a
 * node tree from a declarative description and implements exactly that surface,
 * including a small CSS selector matcher for the shapes the adapters use.
 */

export function h(tag, attrs = {}, children = []) {
  const node = {
    tagName: String(tag).toUpperCase(),
    attributes: { ...attrs },
    children: [],
    parentElement: null,
    value: attrs.value
  };
  node.classList = {
    contains: name => String(attrs.class || '').split(/\s+/).includes(name)
  };
  for (const child of [].concat(children)) {
    if (typeof child === 'string') node.children.push({ text: child });
    else { child.parentElement = node; node.children.push(child); }
  }
  Object.defineProperty(node, 'textContent', {
    get() { return collectText(node); },
    configurable: true
  });
  node.querySelector = selector => query(node, selector)[0] || null;
  node.querySelectorAll = selector => query(node, selector);
  node.closest = selector => {
    let current = node;
    while (current) {
      if (matchesAny(current, selector)) return current;
      current = current.parentElement;
    }
    return null;
  };
  node.ownerDocument = null;
  return node;
}

function collectText(node) {
  if (node.text !== undefined) return node.text;
  return node.children.map(collectText).join(' ').replace(/\s+/g, ' ').trim();
}

function descendants(node, out = []) {
  for (const child of node.children) {
    if (child.text !== undefined) continue;
    out.push(child);
    descendants(child, out);
  }
  return out;
}

function query(node, selector) {
  return descendants(node).filter(n => matchesAny(n, selector));
}

function matchesAny(node, selectorList) {
  return String(selectorList).split(',').map(s => s.trim()).filter(Boolean)
    .some(selector => matchesCompound(node, selector));
}

/** Supports tag, .class, #id, [attr], [attr="v"], [attr*="v"] and combinations. */
function matchesCompound(node, selector) {
  // Descendant combinators: only the right-most part is checked, which is
  // sufficient for the adapter selectors and keeps this helper honest about
  // what it supports.
  const part = selector.split(/\s+/).filter(Boolean).pop();
  if (!part) return false;

  const tokens = part.match(/^[a-z0-9]+|\.[-\w]+|#[-\w]+|\[[^\]]+\]/gi) || [];
  if (!tokens.length) return false;

  for (const token of tokens) {
    if (token.startsWith('.')) {
      if (!String(node.attributes.class || '').split(/\s+/).includes(token.slice(1))) return false;
    } else if (token.startsWith('#')) {
      if (node.attributes.id !== token.slice(1)) return false;
    } else if (token.startsWith('[')) {
      if (!matchesAttribute(node, token.slice(1, -1))) return false;
    } else if (!/^[a-z0-9]+$/i.test(token)) {
      return false;
    } else if (node.tagName !== token.toUpperCase()) {
      return false;
    }
  }
  return true;
}

function matchesAttribute(node, body) {
  const m = body.match(/^([-\w]+)(?:(\*?=)"?([^"]*)"?)?$/);
  if (!m) return false;
  const [, name, op, value] = m;
  const actual = node.attributes[name];
  if (actual === undefined) return false;
  if (!op) return true;
  if (op === '=') return String(actual) === value;
  if (op === '*=') return String(actual).includes(value);
  return false;
}

/** Build a document-like root. */
export function doc(children) {
  const root = h('body', {}, children);
  const assign = node => {
    node.ownerDocument = root;
    for (const child of node.children) if (child.text === undefined) assign(child);
  };
  assign(root);
  return root;
}
