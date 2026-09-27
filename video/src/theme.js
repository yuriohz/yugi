import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { FONT_FILES, SANS, SERIF } from './fonts.js';
import { measure, spaceWidth } from './measure.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

export const W = 1920;
export const H = 1080;
export const SAFE = 104;

export const T = {
  paper: '#FBF5E9',
  paper2: '#FFFCF7',
  cocoa950: '#35251F',
  cocoa700: '#493A33',
  cocoa600: '#6B5E56',
  cocoa400: '#8B7B70',
  terra700: '#7D3424',
  terra600: '#9C412B',
  terra500: '#A7472D',
  terra100: '#F3E2D9',
  saffron: '#D99A21',
  saffron700: '#805200',
  saffronLight: '#F0C764',
  pistachio100: '#E8EFDC',
  pistachio600: '#56704C',
  line300: '#D8CABB',
  line200: '#E9E0D4',
  error: '#B42332',
  warning: '#805200',
  info: '#315B8A',
  // cinematic extensions of cocoa-950 for film scenes
  inkDeep: '#1E130F',
  ink: '#2A1A14',
  ink2: '#3A241C',
};

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const n = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/* ---------------------------------------------------------------- primitives */

export const rect = (x, y, w, h, o = {}) => {
  const a = [];
  if (o.rx) a.push(`rx="${n(o.rx)}"`);
  if (o.opacity != null) a.push(`opacity="${n(o.opacity)}"`);
  if (o.fill) a.push(`fill="${o.fill}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}" stroke-width="${n(o.sw ?? 1)}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.transform) a.push(`transform="${o.transform}"`);
  if (o.filter) a.push(`filter="${o.filter}"`);
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}" ${a.join(' ')}/>`;
};

export const circle = (cx, cy, r, o = {}) => {
  const a = [];
  if (o.fill) a.push(`fill="${o.fill}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}" stroke-width="${n(o.sw ?? 1)}"`);
  if (o.opacity != null) a.push(`opacity="${n(o.opacity)}"`);
  if (o.transform) a.push(`transform="${o.transform}"`);
  if (o.filter) a.push(`filter="${o.filter}"`);
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.max(0, r))}" ${a.join(' ')}/>`;
};

export const line = (x1, y1, x2, y2, o = {}) => {
  const a = [];
  if (o.stroke) a.push(`stroke="${o.stroke}"`);
  a.push(`stroke-width="${n(o.sw ?? 1)}"`);
  if (o.opacity != null) a.push(`opacity="${n(o.opacity)}"`);
  if (o.cap) a.push(`stroke-linecap="${o.cap}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.transform) a.push(`transform="${o.transform}"`);
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${a.join(' ')}/>`;
};

export const path = (d, o = {}) => {
  const a = [];
  if (o.fill) a.push(`fill="${o.fill}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}" stroke-width="${n(o.sw ?? 1)}"`);
  if (o.opacity != null) a.push(`opacity="${n(o.opacity)}"`);
  if (o.cap) a.push(`stroke-linecap="${o.cap}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.transform) a.push(`transform="${o.transform}"`);
  if (o.filter) a.push(`filter="${o.filter}"`);
  return `<path d="${d}" ${a.join(' ')}/>`;
};

export const g = (content, o = {}) => {
  const a = [];
  if (o.opacity != null) a.push(`opacity="${n(o.opacity)}"`);
  if (o.transform) a.push(`transform="${o.transform}"`);
  if (o.filter) a.push(`filter="${o.filter}"`);
  if (o.clip) a.push(`clip-path="url(#${o.clip})"`);
  if (o.mask) a.push(`mask="url(#${o.mask})"`);
  return `<g ${a.join(' ')}>${Array.isArray(content) ? content.join('') : content}</g>`;
};

export const lg = (id, stops, { x1 = 0, y1 = 0, x2 = 1, y2 = 0 } = {}) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
  stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('') +
  `</linearGradient>`;

export const rg = (id, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx, fy } = {}) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx != null ? ` fx="${fx}"` : ''}${fy != null ? ` fy="${fy}"` : ''}>` +
  stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('') +
  `</radialGradient>`;

export const blur = (id, std) =>
  `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${std}"/></filter>`;

export const clipRect = (id, x, y, w, h, rx = 0) =>
  `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}"/></clipPath>`;

/* ---------------------------------------------------------------------- text */

export const F = { sans: SANS, serif: SERIF };

export function text(str, o = {}) {
  const {
    x = 0, y = 0, size = 48, weight = 400, family = SANS, fill = T.cocoa950,
    ls = 0, italic = false, anchor = 'start', opacity = 1, transform, filter,
  } = o;
  const a = [
    `x="${n(x)}"`, `y="${n(y)}"`,
    `font-family="${family}"`, `font-size="${n(size)}"`, `font-weight="${weight}"`,
    `fill="${fill}"`,
  ];
  if (ls) a.push(`letter-spacing="${n(ls)}"`);
  if (italic) a.push(`font-style="italic"`);
  if (anchor !== 'start') a.push(`text-anchor="${anchor}"`);
  if (opacity != null && opacity < 1) a.push(`opacity="${n(opacity)}"`);
  if (transform) a.push(`transform="${transform}"`);
  if (filter) a.push(`filter="${filter}"`);
  return `<text ${a.join(' ')}>${esc(str)}</text>`;
}

// width of a string (ink width, includes letter-spacing on inner gaps)
export const textW = (str, o) => measure(str, { size: o.size, weight: o.weight, family: o.family, ls: o.ls, italic: o.italic }).w;

// baseline y so the *ink top* of this string sits at `top`
export function topBaseline(top, o) {
  return top - measure('Hxlp', { size: o.size, weight: o.weight, family: o.family, ls: o.ls, italic: o.italic }).top;
}
// baseline y so the ink is vertically centred on `cy`
export function midBaseline(cy, o) {
  const m = measure('Hxlp', { size: o.size, weight: o.weight, family: o.family, ls: o.ls, italic: o.italic });
  return cy - (m.top + m.bottom) / 2;
}

// lay out words with real metrics so each can be animated independently
export function textRun(str, o = {}) {
  const opts = { size: 48, weight: 400, family: SANS, ls: 0, italic: false, ...o };
  const sw = spaceWidth(opts);
  const ws = String(str).split(' ').filter(Boolean).map((w) => ({ w, mw: measure(w, opts).w }));
  const total = ws.reduce((s, x, i) => s + x.mw + (i ? sw : 0), 0);
  let x = o.x ?? 0;
  if (o.anchor === 'middle') x -= total / 2;
  else if (o.anchor === 'end') x -= total;
  let acc = 0;
  return ws.map((item, i) => {
    const px = x + acc;
    acc += item.mw + sw;
    return { text: item.w, x: px, w: item.mw, i, of: ws.length };
  });
}

export function fitSize(str, maxW, o = {}, min = 10) {
  let size = o.size ?? 48;
  while (size > min && textW(str, { ...o, size }) > maxW) size -= 1;
  return size;
}

/* ---------------------------------------------------------------------- mark */

export const BUBBLE =
  'M256 52c-111 0-199 72-199 166 0 78 57 138 144 155l-14 65 84-60c103-7 184-78 184-168 0-88-88-158-199-158Z';
export const PETALS = [
  'M239 292c-32-7-60-37-62-77 38 6 72 33 85 62 7 15-7 23-23 15Z',
  'M278 284c5-37 28-71 65-88 6 39-10 72-39 93-13 9-28 7-26-5Z',
  'M245 303c10 7 25 11 40 6-4 17-16 31-33 40-9-13-12-30-7-46Z',
];

export function mark(x, y, size, o = {}) {
  const s = size / 512;
  const bubble = o.bubble ?? T.terra500;
  const petal = o.petal ?? T.saffronLight;
  const inner = [];
  PETALS.forEach((d, i) => {
    const op = o.petalOpacity?.[i] ?? 1;
    const sc = o.petalScale?.[i] ?? 1;
    const t = sc === 1 ? null : `translate(${256 * (1 - sc)} ${300 * (1 - sc)}) scale(${sc})`;
    inner.push(
      `<g${t ? ` transform="${t}"` : ''}${op < 1 ? ` opacity="${n(op)}"` : ''}>${path(d, { fill: petal })}</g>`
    );
  });
  return g(path(BUBBLE, { fill: bubble, opacity: o.bubbleOpacity ?? 1 }) + inner.join(''), {
    transform: `translate(${n(x)} ${n(y)}) scale(${n(s)})`,
    opacity: o.opacity ?? 1,
    filter: o.filter,
  });
}

/* ------------------------------------------------------------------- textures */

let grainB64 = null;
export function grain() {
  if (grainB64) return grainB64;
  const file = join(root, 'assets', 'grain.b64');
  if (existsSync(file)) {
    grainB64 = readFileSync(file, 'utf8').trim();
    return grainB64;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>` +
    `<rect width="256" height="256" filter="url(#n)" opacity="0.9"/></svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
  grainB64 = png.toString('base64');
  writeFileSync(file, grainB64);
  return grainB64;
}

export function grainOverlay(opacity = 0.055) {
  return (
    `<pattern id="grainP" width="256" height="256" patternUnits="userSpaceOnUse">` +
    `<image width="256" height="256" xlink:href="data:image/png;base64,${grain()}"/></pattern>`
  ) + rect(0, 0, W, H, { fill: 'url(#grainP)', opacity });
}

export function vignette(strength = 0.22, tint = '#1E130F') {
  return (
    rg('vigR', [[0.55, tint, 0], [1, tint, strength]], { cx: 0.5, cy: 0.5, r: 0.78 }) +
    rect(0, 0, W, H, { fill: 'url(#vigR)' })
  );
}

// soft ambient glow, gradient-based (cheap) rather than blurred
export function glow(cx, cy, r, color, opacity = 0.5) {
  const id = `gl${Math.round(cx)}_${Math.round(cy)}_${Math.round(r)}`.replace(/[^a-z0-9_]/gi, '');
  return (
    rg(id, [[0, color, opacity], [0.55, color, opacity * 0.35], [1, color, 0]]) +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#${id})"/>`
  );
}

/* ------------------------------------------------------------------- surfaces */

export function card(x, y, w, h, o = {}) {
  const rx = o.rx ?? 14;
  const out = [];
  if (o.shadow !== false) {
    out.push(
      rect(x, y + (o.dy ?? 10), w, h, { rx, fill: o.shadowColor ?? '#4A3226', opacity: o.shadowOpacity ?? 0.16, filter: o.shadowBlur ? `url(#${o.shadowBlur})` : undefined })
    );
  }
  out.push(rect(x, y, w, h, { rx, fill: o.fill ?? T.paper2, stroke: o.stroke ?? T.line200, sw: o.sw ?? 1.5, opacity: o.opacity }));
  return out.join('');
}

/* --------------------------------------------------------------- svg document */

export function svgDoc(children, { bg, defs = '' } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${defs}</defs>` +
    (bg ? rect(0, 0, W, H, { fill: bg }) : '') +
    (Array.isArray(children) ? children.join('') : children) +
    `</svg>`
  );
}

export const renderSvg = (svg, scale = 1) =>
  new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: SANS },
    fitTo: scale === 1 ? undefined : { mode: 'width', value: Math.round(W * scale) },
  }).render();
