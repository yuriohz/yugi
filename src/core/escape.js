/** HTML escaping for every value interpolated into extension UI markup. */
const MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;'
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, ch => MAP[ch]);
}

/** Escape a value destined for an HTML attribute value in a template string. */
export function escapeAttr(value) {
  return escapeHtml(value).replace(/\r?\n/g, '&#10;');
}
