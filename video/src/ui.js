import {
  T, W, H, rect, circle, line, path, g, text, textW, textRun, esc, n, lg, rg, mark, card,
} from './theme.js';
import { measure } from './measure.js';

/* --------------------------------------------------------------- browser shell */

export function browserWindow(x, y, w, h, o = {}) {
  const bar = 52;
  const rx = 16;
  const out = [];
  out.push(rect(x, y, w, h, { rx, fill: T.paper2, stroke: T.line200, sw: 1.5 }));
  out.push(rect(x, y, w, bar, { rx, fill: T.line200 }));
  out.push(rect(x, y + bar - 18, w, 18, { fill: T.line200 }));
  const dots = ['#E9705F', '#EFBE4B', '#5FBF78'];
  dots.forEach((c, i) => out.push(circle(x + 26 + i * 20, y + bar / 2, 6, { fill: c })));
  out.push(rect(x + 108, y + 12, w - 220, 28, { rx: 14, fill: '#FFFFFF', stroke: T.line200 }));
  out.push(
    text(o.url ?? 'web.whatsapp.com', {
      x: x + 128, y: y + 31, size: 14, weight: 500, fill: T.cocoa600,
    })
  );
  if (o.badge !== false) {
    out.push(
      g(mark(x + w - 46, y + 10, 30, {}), { opacity: 0.95 })
    );
  }
  return out.join('');
}

/* --------------------------------------------------------------- chat mockup */

export const CHAT = {
  left: [
    { side: 'in', name: 'Sarah · Product', text: 'Can you confirm the release plan?', t: 0 },
  ],
  draft:
    'I think we can maybe ship Friday but the auth migration might cause issues and I dont want to promise.',
};

export function chatMock(x, y, w, h, o = {}) {
  const out = [];
  const sidebar = 300;
  out.push(rect(x, y, w, h, { fill: '#F6F2EB' }));
  // sidebar
  out.push(rect(x, y, sidebar, h, { fill: T.paper2 }));
  out.push(text('Chats', { x: x + 30, y: y + 48, size: 22, weight: 700, fill: T.cocoa950 }));
  out.push(rect(x + 24, y + 68, sidebar - 48, 38, { rx: 12, fill: T.line200 }));
  const contacts = [
    ['Sarah · Product', 'Can you confirm the…'],
    ['Design review', 'Looks good to me'],
    ['Ops · Release', 'Migration window?'],
    ['Amir · Sales', 'Sent the deck'],
  ];
  contacts.forEach((c, i) => {
    const cy = y + 150 + i * 74;
    out.push(circle(x + 54, cy, 23, { fill: i === 0 ? T.terra100 : T.line200 }));
    const initials = c[0].split(' ')[0][0] + (c[0].split(' · ')[1]?.[0] ?? '');
    out.push(text(initials, { x: x + 54, y: cy + 5, size: 13, weight: 700, fill: i === 0 ? T.terra700 : T.cocoa600, anchor: 'middle' }));
    out.push(text(c[0], { x: x + 90, y: cy - 2, size: 14, weight: 700, fill: T.cocoa700 }));
    out.push(text(c[1], { x: x + 90, y: cy + 18, size: 12, weight: 400, fill: T.cocoa600 }));
  });
  // conversation header
  const cx = x + sidebar;
  out.push(rect(cx, y, w - sidebar, 58, { fill: T.paper2 }));
  out.push(circle(cx + 32, y + 29, 20, { fill: T.terra100 }));
  out.push(text('SP', { x: cx + 32, y: y + 34, size: 11, weight: 700, fill: T.terra700, anchor: 'middle' }));
  out.push(text('Sarah · Product', { x: cx + 64, y: y + 34, size: 15, weight: 700, fill: T.cocoa700 }));
  // bubbles
  out.push(rect(cx + 32, y + 96, 392, 54, { rx: 14, fill: '#FFFFFF', stroke: T.line200 }));
  out.push(text('Can you confirm the release plan?', { x: cx + 56, y: y + 129, size: 15, weight: 400, fill: T.cocoa700 }));
  // composer
  const compX = cx + 32;
  const compY = y + h - 142;
  const compW = w - sidebar - 64;
  out.push(rect(compX, compY, compW, 110, { rx: 14, fill: '#FFFFFF', stroke: T.line200 }));
  const pad = 24;
  const lines = o.lines ?? [
    'I think we can maybe ship Friday but the auth',
    'migration might cause issues and I dont want to promise.',
  ];
  lines.forEach((l, i) => {
    out.push(text(l, { x: compX + pad, y: compY + 42 + i * 30, size: 15, weight: 400, fill: T.cocoa950, opacity: 0.92 }));
  });
  return out.join('');
}

export function selectionHighlight(x, y, lines, o = {}) {
  // highlight behind composer lines: o.progress 0..1 sweeps left→right
  const out = [];
  const lh = 30;
  const size = 15;
  const p = o.progress ?? 1;
  const totalChars = lines.join(' ').length;
  let seen = 0;
  lines.forEach((l, i) => {
    const w = textW(l, { size, weight: 400 });
    const start = seen;
    const end = seen + l.length;
    seen += l.length + 1;
    const a = (p * totalChars - start) / l.length;
    if (a <= 0) return;
    const ww = w * Math.min(1, a);
    out.push(
      rect(x, y + 42 + i * lh - 20, ww, 26, {
        rx: 4, fill: o.fill ?? T.terra500, opacity: o.opacity ?? 0.28,
      })
    );
  });
  return out.join('');
}

/* ----------------------------------------------------------------- assistant badge */

export function badge(x, y, size, o = {}) {
  const out = [];
  const s = size;
  if (o.pulse) {
    const r = s * (0.5 + o.pulse * 0.9);
    out.push(circle(x + s / 2, y + s / 2, r, { fill: T.terra500, opacity: 0.16 * (1 - o.pulse) }));
  }
  out.push(rect(x, y, s, s, { rx: s * 0.32, fill: '#FFFFFF', stroke: T.line200, sw: 1 }));
  out.push(mark(x + s * 0.13, y + s * 0.11, s * 0.74, {}));
  return g(out.join(''), { transform: o.transform, opacity: o.opacity });
}

/* ----------------------------------------------------------------- mode cards */

export const MODES = [
  { name: 'Polish', sub: 'Same voice, cleaner', icon: 'sparkle', accent: T.terra600, tint: T.pistachio100 },
  { name: 'Casual', sub: 'Natural and easygoing', icon: 'smile', accent: T.terra600, tint: '#FDF3E3' },
  { name: 'Polite', sub: 'Respectful, still clear', icon: 'heart', accent: T.terra600, tint: '#F3EDE6' },
  { name: 'Professional', name2: '& Firm', sub: 'Direct and confident', icon: 'brief', accent: T.terra600, tint: '#EFE9E2' },
  { name: 'Technical', name2: 'Review', sub: 'Logic and sources', icon: 'check', accent: T.terra600, tint: '#EAF0E4' },
];

export function modeCard(x, y, w, h, mode, o = {}) {
  const out = [];
  const selected = o.selected;
  out.push(
    rect(x, y, w, h, {
      rx: 10,
      fill: selected ? o.tint ?? mode.tint : '#FFFFFF',
      stroke: selected ? T.terra600 : T.line200,
      sw: selected ? 2 : 1.2,
      opacity: o.opacity,
    })
  );
  const ix = x + 20;
  const iy = y + 20;
  out.push(circle(ix + 11, iy + 11, 11, { fill: selected ? T.terra600 : T.terra100, opacity: o.opacity }));
  out.push(modeIcon(mode.icon, ix + 11, iy + 11, 11, selected ? '#FFFFFF' : T.terra700));
  const tx = x + 20;
  if (mode.name2) {
    out.push(text(mode.name, { x: tx, y: y + 56, size: 12.5, weight: 700, fill: T.cocoa700, opacity: o.opacity }));
    out.push(text(mode.name2, { x: tx, y: y + 70, size: 12.5, weight: 700, fill: T.cocoa700, opacity: o.opacity }));
    out.push(text(mode.sub, { x: tx, y: y + 88, size: 9.5, weight: 400, fill: T.cocoa600, opacity: o.opacity }));
  } else {
    out.push(text(mode.name, { x: tx, y: y + 62, size: 12.5, weight: 700, fill: T.cocoa700, opacity: o.opacity }));
    out.push(text(mode.sub, { x: tx, y: y + 80, size: 9.5, weight: 400, fill: T.cocoa600, opacity: o.opacity }));
  }
  if (selected) {
    out.push(circle(x + w - 20, y + 18, 8, { fill: T.terra600 }));
    out.push(path('M-3.4 0.2 L-1 2.8 L3.6 -2.4', {
      transform: `translate(${x + w - 20} ${y + 18})`,
      stroke: '#FFFFFF', sw: 1.8, fill: 'none', cap: 'round', opacity: o.opacity,
    }));
  }
  return out.join('');
}

export function modeIcon(kind, cx, cy, r, color) {
  const s = r / 11;
  const t = `translate(${n(cx - 11 * s)} ${n(cy - 11 * s)}) scale(${n(s)})`;
  const common = { fill: 'none', stroke: color, sw: 1.9, cap: 'round', transform: t };
  if (kind === 'sparkle') {
    return (
      path('M11 2 L12.9 8.2 L19 10 L12.9 11.8 L11 18 L9.1 11.8 L3 10 L9.1 8.2 Z', { fill: color, transform: t }) +
      path('M18.5 15.2 L19.4 17.8 L22 18.7 L19.4 19.6 L18.5 22 L17.6 19.6 L15 18.7 L17.6 17.8 Z', { fill: color, opacity: 0.6, transform: t })
    );
  }
  if (kind === 'smile')
    return (
      circle(11, 11, 8, { fill: 'none', stroke: color, sw: 1.9, transform: t }) +
      path('M7.6 12.6 Q11 16 14.4 12.6', common) +
      circle(8.6, 9, 0.9, { fill: color, transform: t }) +
      circle(13.4, 9, 0.9, { fill: color, transform: t })
    );
  if (kind === 'heart')
    return path('M11 18.6 C11 18.6 3.4 13.9 3.4 8.9 C3.4 6.3 5.4 4.4 7.8 4.4 C9.4 4.4 10.6 5.2 11 6.2 C11.4 5.2 12.6 4.4 14.2 4.4 C16.6 4.4 18.6 6.3 18.6 8.9 C18.6 13.9 11 18.6 11 18.6 Z', { fill: color, transform: t });
  if (kind === 'brief')
    return (
      rect(2.6, 6.6, 16.8, 11.4, { rx: 2, fill: 'none', stroke: color, sw: 1.8, transform: t }) +
      path('M8 6.6 V4.8 A1.4 1.4 0 0 1 9.4 3.4 H12.6 A1.4 1.4 0 0 1 14 4.8 V6.6', common)
    );
  if (kind === 'check')
    return (
      circle(11, 11, 8.2, { fill: 'none', stroke: color, sw: 1.8, transform: t }) +
      path('M7.6 11.2 L10.2 13.8 L14.8 8.4', common)
    );
  return circle(cx, cy, r * 0.6, { fill: color });
}

/* --------------------------------------------------------------- panel chrome */

export function panelHeader(x, y, w, title, o = {}) {
  const out = [];
  out.push(text(title, { x, y, size: 13, weight: 600, fill: T.cocoa600, opacity: o.opacity }));
  if (o.right) {
    out.push(text(o.right, { x: x + w, y, size: 11, weight: 600, fill: T.cocoa600, anchor: 'end', opacity: o.opacity }));
  }
  return out.join('');
}

export function pill(x, y, label, o = {}) {
  const size = o.size ?? 12.5;
  const padX = o.padX ?? 14;
  const h = o.h ?? 30;
  const w = textW(label, { size, weight: 600 }) + padX * 2 + (o.caret ? 14 : 0);
  const out = [rect(x, y, w, h, { rx: h / 2, fill: o.fill ?? T.line200, stroke: o.stroke, sw: o.sw ?? 1, opacity: o.opacity })];
  out.push(
    text(label, {
      x: x + padX, y: y + h / 2 + size * 0.36, size, weight: o.weight ?? 600,
      fill: o.color ?? T.cocoa700, opacity: o.opacity,
    })
  );
  if (o.caret)
    out.push(path('M0 0 L4 4.6 L8 0', {
      transform: `translate(${n(x + w - padX - 8)} ${n(y + h / 2 - 2.6)})`,
      stroke: o.color ?? T.cocoa700, sw: 1.5, fill: 'none', cap: 'round', opacity: o.opacity,
    }));
  return { svg: out.join(''), w };
}

export function button(x, y, w, h, label, o = {}) {
  const out = [rect(x, y, w, h, { rx: 7, fill: o.fill ?? T.terra600, opacity: o.opacity, stroke: o.stroke, sw: o.sw })];
  out.push(
    text(label, {
      x: x + w / 2, y: y + h / 2 + 4.2, size: 12.5, weight: 700,
      fill: o.color ?? '#FFFFFF', anchor: 'middle', opacity: o.opacity,
    })
  );
  return out.join('');
}

export function toggle(x, y, w, h, on, o = {}) {
  const out = [];
  out.push(rect(x, y, w, h, { rx: h / 2, fill: on ? T.pistachio600 : T.line300, opacity: o.opacity }));
  const kr = h - 6;
  const kx = on ? x + w - h + 3 : x + 3;
  out.push(circle(kx + kr / 2, y + h / 2, kr / 2, { fill: '#FFFFFF', opacity: o.opacity }));
  return out.join('');
}

export function checkChip(x, y, label, o = {}) {
  const size = o.size ?? 12;
  const h = o.h ?? 26;
  const tw = textW(label, { size, weight: o.weight ?? 600 });
  const w = tw + 46;
  const out = [rect(x, y, w, h, {
    rx: h / 2, fill: o.fill ?? T.pistachio100, stroke: o.stroke ?? T.pistachio600, sw: 1, opacity: o.opacity,
  })];
  out.push(circle(x + 15, y + h / 2, 7.5, { fill: T.pistachio600, opacity: o.opacity }));
  out.push(path('M-3 -0.2 L-0.9 2.4 L3.2 -2.4', {
    transform: `translate(${n(x + 15)} ${n(y + h / 2)})`,
    stroke: '#FFFFFF', sw: 1.7, fill: 'none', cap: 'round', opacity: o.opacity,
  }));
  out.push(text(label, {
    x: x + 28, y: y + h / 2 + size * 0.36, size, weight: o.weight ?? 600,
    fill: o.color ?? T.pistachio600, opacity: o.opacity,
  }));
  return { svg: out.join(''), w };
}

export function switchRow(x, y, w, label, sub, on, o = {}) {
  const out = [];
  out.push(rect(x, y, w, o.h ?? 72, { rx: 12, fill: '#FFFFFF', stroke: T.line200, sw: 1.2, opacity: o.opacity }));
  out.push(text(label, { x: x + 20, y: y + 32, size: 15, weight: 700, fill: T.cocoa950, opacity: o.opacity }));
  if (sub) out.push(text(sub, { x: x + 20, y: y + 54, size: 12, weight: 400, fill: T.cocoa600, opacity: o.opacity }));
  out.push(toggle(x + w - 78, y + ((o.h ?? 72) - 28) / 2, 52, 28, on, { opacity: o.opacity }));
  return out.join('');
}

/* --------------------------------------------------------------- text helpers */

export function chapterLabel(str, x, y, o = {}) {
  return text(str.toUpperCase(), {
    x, y, size: o.size ?? 13, weight: 800, ls: o.ls ?? 4.2,
    fill: o.fill ?? T.terra700, opacity: o.opacity, family: o.family,
  });
}

export function underlineSweep(x, y, w, o = {}) {
  const p = o.progress ?? 1;
  return rect(x, y, w * p, o.h ?? 4, { rx: (o.h ?? 4) / 2, fill: o.fill ?? T.saffron, opacity: o.opacity });
}
