import { Resvg } from '@resvg/resvg-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { FONT_FILES } from './fonts.js';

// Text metrics by rasterising and scanning ink extents. resvg has no metrics API,
// and ink extents are what we actually want for optical layout.
const CACHE_FILE = new URL('../.metrics.json', import.meta.url);
const store = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
let dirty = false;

export function saveMetrics() {
  if (dirty) writeFileSync(CACHE_FILE, JSON.stringify(store));
}

const PADX = 60;
const PADY = 80;

function keyOf(text, o) {
  return [text, o.size, o.weight, o.family, o.ls || 0, o.italic ? 1 : 0].join('|');
}

function raster(text, o) {
  const size = o.size;
  const H = Math.ceil(size * 3);
  const W = 4200;
  const style = o.italic ? ' font-style="italic"' : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<text x="${PADX}" y="${PADY + size}" font-family="${o.family}" font-size="${size}" ` +
    `font-weight="${o.weight}" letter-spacing="${o.ls || 0}" fill="#000"${style}>${text}</text>` +
    `</svg>`;
  const img = new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: FONT_FILES },
    fitTo: { mode: 'width', value: W },
  }).render();
  return { px: img.pixels, w: img.width, h: img.height, baseline: PADY + size };
}

export function measure(text, opts = {}) {
  const o = {
    size: 48,
    weight: 400,
    family: 'Inter',
    ls: 0,
    italic: false,
    ...opts,
  };
  if (!text) return { w: 0, h: 0, top: 0, bottom: 0, left: 0 };
  const k = keyOf(text, o);
  if (store[k]) return store[k];
  const { px, w, h, baseline } = raster(text, o);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (px[row + x * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity) { minX = maxX = PADX; minY = maxY = baseline; }
  const m = {
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    left: minX - PADX,
    top: minY - baseline,
    bottom: maxY - baseline,
  };
  store[k] = m;
  dirty = true;
  return m;
}

export function spaceWidth(opts) {
  const a = measure('H', opts).w;
  const b = measure('H H', opts).w;
  return Math.max(1, b - 2 * a);
}

export function words(text, opts) {
  const sw = spaceWidth(opts);
  return text.split(/\s+/).filter(Boolean).map((word, i, arr) => ({
    text: word,
    w: measure(word, opts).w,
    gap: i < arr.length - 1 ? sw : 0,
  }));
}

export function wrap(text, maxWidth, opts = {}) {
  const out = [];
  let line = [];
  let width = 0;
  const sw = spaceWidth(opts);
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = measure(word, opts).w;
    if (line.length && width + sw + w > maxWidth) {
      out.push(line.join(' '));
      line = [word];
      width = w;
    } else {
      width += (line.length ? sw : 0) + w;
      line.push(word);
    }
  }
  if (line.length) out.push(line.join(' '));
  return out;
}

// baseline y that puts the ink top of this text at `top`
export function baselineForTop(top, opts) {
  return top - measure(opts.probe || 'Hg', opts).top;
}

export function shrinkToFit(text, maxWidth, opts = {}, min = 8) {
  let o = { ...opts };
  while (o.size > min && measure(text, o).w > maxWidth) o.size -= 1;
  return o.size;
}
