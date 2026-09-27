import {
  T, W, H, rect, circle, line, path, g, text, textW, textRun, esc, n, lg, rg, blur,
  mark, card, glow, clipRect, topBaseline, midBaseline, fitSize, F, PETALS, BUBBLE,
} from './theme.js';
import { measure, spaceWidth } from './measure.js';
import {
  clamp, lerp, ease, spring, win, fade, fadeOut, rise, stagger, rnd, drift, typed, noise2,
} from './anim.js';
import * as ui from './ui.js';

const CX = W / 2;
const CY = H / 2;

/* ============================================================ shared helpers */

const bgPaper = (extra = '') => rect(0, 0, W, H, { fill: T.paper }) + extra;
const bgDark = (extra = '') => rect(0, 0, W, H, { fill: T.inkDeep }) + extra;

function chars(str, o = {}) {
  const opts = { size: 48, weight: 400, family: F.sans, ls: 0, ...o };
  const sw = spaceWidth(opts);
  const items = [...str].map((c) => ({ c, w: c === ' ' ? sw : measure(c, opts).w }));
  const total = items.reduce((s, x) => s + x.w, 0);
  let x = o.x ?? 0;
  if (o.anchor === 'middle') x -= total / 2;
  let acc = 0;
  return items.map((it, i) => {
    const px = x + acc;
    acc += it.w;
    return { ch: it.c, x: px, i, of: items.length };
  });
}

function cursor(x, y, o = {}) {
  const s = o.scale ?? 1;
  const d = 'M0 0 L0 21 L5.4 16.2 L8.6 23.4 L12.4 21.8 L9.2 14.8 L15.4 14.2 Z';
  return g(
    path(d, { fill: '#FFFFFF', stroke: T.cocoa950, sw: 1.6 }) +
      path(d, { fill: 'none', stroke: 'rgba(0,0,0,0.18)', sw: 3.4, transform: 'translate(0 1)' }),
    { transform: `translate(${n(x)} ${n(y)}) scale(${n(s)})`, opacity: o.opacity ?? 1 }
  );
}

function clickRipple(x, y, p) {
  if (p <= 0 || p >= 1) return '';
  const r = 6 + p * 46;
  return circle(x, y, r, { fill: 'none', stroke: T.terra600, sw: 3 * (1 - p), opacity: 0.7 * (1 - p) });
}

function flash(strength, color = '#FFFFFF') {
  return rect(0, 0, W, H, { fill: color, opacity: strength });
}

// drifting message-bubble ambience for dark scenes
function ambientBubbles(t, o = {}) {
  const out = [];
  const count = o.count ?? 10;
  for (let i = 0; i < count; i++) {
    const sx = rnd(i * 3.1) * W;
    const sy = rnd(i * 7.7 + 2) * H;
    const w = 130 + rnd(i * 11.3) * 240;
    const h = 46 + rnd(i * 5.9) * 30;
    const speed = 8 + rnd(i * 2.7) * 22;
    const x = sx + Math.sin(t * 0.22 + i) * 26;
    const y = ((sy - t * speed) % (H + 400) + H + 400) % (H + 400) - 200;
    const op = (o.opacity ?? 0.06) * (0.5 + rnd(i * 17.1) * 0.7);
    const fill = i % 3 === 0 ? T.saffron : '#FFFFFF';
    out.push(
      g(
        rect(0, 0, w, h, { rx: h / 2.4, fill, opacity: op }) +
          path(`M8 ${h - 2} L0 ${h + 12} L22 ${h - 2} Z`, { fill, opacity: op }),
        { transform: `translate(${n(x)} ${n(y)})` }
      )
    );
  }
  return out.join('');
}

function paperTexture(t) {
  return (
    glow(340, 180, 820, T.saffron, 0.16) +
    glow(1620, 940, 780, T.terra500, 0.10) +
    glow(960, 540, 700, T.saffronLight, 0.10)
  );
}

/* ============================================================== 1. cold open */

const CO_LINE1 = 'Every message';
const CO_LINE2 = 'is a first impression.';

export function sceneColdOpen({ t, d }) {
  const out = [];
  out.push(bgDark());
  out.push(glow(CX, 470, 980, T.terra500, 0.22));
  out.push(glow(320, 880, 700, T.saffron, 0.11));
  out.push(glow(1660, 240, 620, T.terra600, 0.13));
  out.push(g(ambientBubbles(t), { opacity: 0.9 }));

  const size = fitSize(CO_LINE2, 1460, { size: 138, family: F.serif, weight: 700 });
  const o1 = { size, family: F.serif, weight: 700 };
  const top1 = 372;
  const top2 = top1 + size * 1.16;

  const exitP = win(t, d - 0.55, 0.55, ease.inQuad);
  const scale = 1 + exitP * 0.06 + Math.sin(t * 0.9) * 0.002;
  const grp = [`transform="translate(${CX} ${CY}) scale(${n(scale)}) translate(${-CX} ${-CY})"`];

  const body = [];
  const w1 = textRun(CO_LINE1, { ...o1, x: CX, anchor: 'middle' });
  w1.forEach((wrd) => {
    const p = win(t, 0.22 + wrd.i * 0.085, 0.85, ease.outQuint);
    const y = topBaseline(top1, o1) + (1 - p) * 54;
    body.push(text(wrd.text, { x: wrd.x, y, ...o1, fill: T.paper, opacity: p * 0.98 }));
  });
  const w2 = textRun(CO_LINE2, { ...o1, x: CX, anchor: 'middle' });
  const gId = 'coGrad';
  w2.forEach((wrd) => {
    const p = win(t, 0.95 + wrd.i * 0.085, 0.85, ease.outQuint);
    const y = topBaseline(top2, o1) + (1 - p) * 54;
    const fill = wrd.i >= 3 ? `url(#${gId})` : T.paper;
    body.push(text(wrd.text, { x: wrd.x, y, ...o1, fill, opacity: p * 0.98 }));
  });

  // underline sweep under line two
  const uw = 620;
  const up = win(t, 1.95, 0.7, ease.outQuart);
  if (up > 0) {
    body.push(
      rect(CX - uw / 2, top2 + size * 1.02, uw * up, 5, { rx: 2.5, fill: T.saffron, opacity: 0.85 })
    );
  }

  out.push(
    `<defs>${lg(gId, [[0, T.saffronLight], [0.55, T.saffron], [1, T.terra500]], { x1: 0, y1: 0, x2: 1, y2: 0 })}</defs>`
  );
  out.push(g(body.join(''), { transform: grp[0].match(/"(.*)"/)[1] }));

  // soft top haze
  out.push(rect(0, 0, W, 160, { fill: 'url(#topHaze)' }));
  out.push(
    `<defs>${lg('topHaze', [[0, T.inkDeep, 0.55], [1, T.inkDeep, 0]], { x1: 0, y1: 0, x2: 0, y2: 1 })}</defs>`
  );
  return out.join('');
}

/* ================================================================ 2. impact */

const IMPACT = 'Make it land.';

export function sceneImpact({ t, d }) {
  const out = [];
  out.push(bgPaper());
  out.push(paperTexture(t));

  // flash from the dark previous shot
  const fl = fadeOut(t, 0, 0.30, ease.outQuad);
  if (fl > 0) out.push(flash(0.85 * fl, T.paper2));

  // shockwaves
  for (let i = 0; i < 3; i++) {
    const p = win(t, i * 0.085, 1.05, ease.outCubic);
    if (p <= 0 || p >= 1) continue;
    out.push(
      circle(CX, CY, 70 + p * 1010, {
        fill: 'none', stroke: i === 0 ? T.terra600 : T.terra500,
        sw: 10 * (1 - p) + 1, opacity: 0.42 * (1 - p),
      })
    );
  }
  // radial speed streaks
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 0.2;
    const p = win(t, 0, 0.55, ease.outQuint);
    const r0 = 260 + p * (520 + rnd(i) * 420);
    const r1 = r0 + 90 + rnd(i * 3) * 160;
    const op = 0.30 * (1 - win(t, 0.12, 0.6, ease.outQuad));
    if (op <= 0.01) continue;
    out.push(
      line(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0 * 0.62,
        CX + Math.cos(a) * r1, CY + Math.sin(a) * r1 * 0.62, {
        stroke: i % 3 === 0 ? T.saffron : T.terra500, sw: 2.4, opacity: op, cap: 'round',
      })
    );
  }

  const size = fitSize(IMPACT, 1500, { size: 232, weight: 900, ls: -6 });
  const o = { size, weight: 900, ls: -6, family: F.sans };
  const gId = 'impGrad';
  const p = win(t, 0, 0.62, ease.outExpo);
  const sc = lerp(1.42, 1, p);
  const op = fade(t, 0, 0.16, ease.outQuad);
  const shake = (1 - fade(t, 0, 0.28, ease.outQuad)) * 9;
  const sx = Math.sin(t * 90) * shake;
  const sy = Math.cos(t * 74) * shake * 0.6;

  const ghost = [];
  for (let i = 3; i >= 1; i--) {
    const gp = 1 - i * 0.22;
    ghost.push(
      text(IMPACT, {
        x: CX + sx, y: CY + size * 0.35 + sy, ...o, fill: T.terra500,
        anchor: 'middle', opacity: 0.10 * (1 - p) * i,
        transform: `translate(${CX} ${CY}) scale(${n(lerp(1.6, 1, p) + i * 0.012)}) translate(${-CX} ${-CY})`,
      })
    );
  }

  out.push(
    `<defs>${lg(gId, [[0, T.terra700], [0.42, T.terra500], [0.78, T.saffron], [1, T.saffronLight]], { x1: 0, y1: 0, x2: 1, y2: 0.35 })}</defs>`
  );
  out.push(
    g(
      ghost.join('') +
        text(IMPACT, {
          x: CX, y: CY + size * 0.35, ...o, fill: `url(#${gId})`, anchor: 'middle', opacity: op,
          transform: `translate(${n(CX + sx)} ${n(CY + sy)}) scale(${n(sc)}) translate(${n(-CX)} ${n(-CY)})`,
        }),
      {}
    )
  );

  // petals flying out
  for (let i = 0; i < 3; i++) {
    const pp = win(t, 0.05 + i * 0.05, 1.0, ease.outCubic);
    const a = -Math.PI / 2 + (i - 1) * 0.7;
    const dist = 380 + pp * 620;
    const px = CX + Math.cos(a) * dist;
    const py = CY + Math.sin(a) * dist * 0.8 + 120;
    const rot = pp * 220 + i * 40;
    out.push(
      g(path(PETALS[i], { fill: T.saffronLight, opacity: 0.9 * (1 - pp) }), {
        transform: `translate(${n(px)} ${n(py)}) scale(0.5) rotate(${n(rot)}) translate(-256 -300)`,
        opacity: 0.85 * (1 - pp),
      })
    );
  }

  // bottom kicker
  const kp = win(t, 0.55, 0.6, ease.outQuint);
  if (kp > 0) {
    out.push(
      text('WORDSAFFRON', {
        x: CX, y: CY + size * 0.72, size: 19, weight: 800, ls: 12,
        fill: T.terra700, anchor: 'middle', opacity: kp * 0.75,
      })
    );
  }
  return out.join('');
}

/* ============================================================= 3. wordmark */

const WM = 'WordSaffron';

export function sceneWordmark({ t, d }) {
  const out = [];
  out.push(bgPaper());
  out.push(paperTexture(t));

  const exit = win(t, d - 0.5, 0.5, ease.inQuad);
  const cam = 1 - exit * 0.05;

  const body = [];
  const mSize = 330;
  const mx = CX - mSize / 2;
  const my = 168;
  const sp = spring(t - 0.02, { stiffness: 150, damping: 15 });
  const bp = clamp(sp);
  const petalP = [0, 1, 2].map((i) => clamp(spring(t - 0.30 - i * 0.09, { stiffness: 200, damping: 14 })));
  const halo = win(t, 0.1, 0.9, ease.outQuad);
  body.push(
    g(
      circle(CX, my + mSize / 2, mSize * (0.42 + halo * 0.16), { fill: T.terra100, opacity: 0.55 * (1 - halo * 0.35) }) +
        mark(mx, my, mSize, {
          petalScale: petalP.map((p) => lerp(0.2, 1, p)),
          petalOpacity: petalP,
        }),
      {
        transform: `translate(${CX} ${my + mSize / 2}) scale(${n(lerp(0.55, 1, bp))}) translate(${-CX} ${-my - mSize / 2})`,
      }
    )
  );

  const size = fitSize(WM, 1240, { size: 158, family: F.serif, weight: 700 });
  const o = { size, family: F.serif, weight: 700 };
  const top = 566;
  const cs = chars(WM, { ...o, x: CX, anchor: 'middle' });
  cs.forEach((c) => {
    const p = win(t, 0.42 + c.i * 0.045, 0.6, ease.outQuint);
    if (p <= 0) return;
    const y = topBaseline(top, o) + (1 - p) * 40;
    body.push(
      text(c.ch, {
        x: c.x, y, ...o, fill: T.cocoa950, opacity: p,
        transform: `translate(${n(c.x)} ${n(y)}) rotate(${n((1 - p) * -6)}) translate(${n(-c.x)} ${n(-y)})`,
      })
    );
  });

  // rule + eyebrow
  const rp = win(t, 1.05, 0.7, ease.outQuart);
  if (rp > 0) {
    const rw = 470 * rp;
    body.push(rect(CX - rw / 2, top + size * 0.92, rw, 3, { rx: 1.5, fill: T.saffron, opacity: 0.8 }));
    body.push(
      text('REWRITE · REVIEW · PROOFREAD', {
        x: CX, y: top + size * 1.28, size: 17, weight: 800, ls: 7.4,
        fill: T.terra700, anchor: 'middle', opacity: rp * 0.9,
      })
    );
  }

  out.push(g(body.join(''), {
    transform: `translate(${CX} ${CY}) scale(${n(cam)}) translate(${-CX} ${-CY})`,
  }));
  return out.join('');
}

/* ============================================== 4. select anywhere (browser) */

export function sceneSelect({ t, d, beat }) {
  const out = [];
  out.push(bgPaper());
  out.push(glow(CX, 300, 900, T.saffron, 0.14));
  out.push(glow(200, 900, 700, T.terra500, 0.09));

  const bw = 1420;
  const bh = 780;
  const bx = CX - bw / 2;
  const by = 150;
  const camP = win(t, 0, 2.4, ease.outQuint);
  const sc = lerp(1.08, 1, camP);
  const cam = `translate(${CX} ${CY}) scale(${n(sc)}) translate(${-CX} ${-CY}) translate(0 ${n(lerp(18, 0, camP))})`;

  const win_ = [];
  win_.push(ui.browserWindow(bx, by, bw, bh, { url: 'web.whatsapp.com' }));
  const inner = { x: bx + 1, y: by + 52, w: bw - 2, h: bh - 52 };
  win_.push(ui.chatMock(inner.x, inner.y, inner.w, inner.h, {}));

  // selection sweep
  const compX = inner.x + 300 + 32;
  const compY = inner.y + inner.h - 142;
  const lines = [
    'I think we can maybe ship Friday but the auth',
    'migration might cause issues and I dont want to promise.',
  ];
  const selP = win(t, 0.62, 0.72, ease.inOutQuad);
  win_.push(ui.selectionHighlight(compX, compY, lines, { progress: selP, fill: T.terra500, opacity: 0.30 }));

  // spotlight on the composer
  const spP = win(t, 0.35, 0.7, ease.outQuad);
  const sid = 'spotR';
  win_.push(
    `<defs>${rg(sid, [
      [0, T.ink, 0], [0.30, T.ink, 0], [0.62, T.ink, 0.30], [1, T.ink, 0.42],
    ], { cx: (compX + 300) / W, cy: (compY + 20) / H, r: 0.62 })}</defs>`
  );
  if (spP > 0) win_.push(rect(inner.x, inner.y, inner.w, inner.h, { fill: `url(#${sid})`, opacity: spP }));

  // assistant badge
  const bSize = 62;
  const bP = clamp(spring(t - 1.42, { stiffness: 260, damping: 17 }));
  if (t > 1.30) {
    const bx2 = compX + 1054 - 82;
    const by2 = compY + 62;
    const pulse = (t - 1.42) % 0.9;
    win_.push(
      ui.badge(bx2, by2, bSize, {
        pulse: clamp(pulse / 0.9) * (t < 2.6 ? 1 : 0.35),
        opacity: fade(t, 1.42, 0.18),
        transform: `translate(${n(bx2 + bSize / 2)} ${n(by2 + bSize / 2)}) scale(${n(lerp(0.4, 1, bP))}) translate(${n(-bx2 - bSize / 2)} ${n(-by2 - bSize / 2)})`,
      })
    );
  }

  // cursor: move in then drag
  const travel = win(t, 0.15, 0.55, ease.inOutCubic);
  const drag = win(t, 0.62, 0.72, ease.inOutQuad);
  const startX = compX + 4;
  const lineW = textW(lines[0], { size: 15 });
  const cx1 = lerp(1780, startX, travel);
  const cy1 = lerp(980, compY + 26, travel);
  const cx2 = drag > 0 ? lerp(startX, startX + lineW * 0.98 + 300, drag) : cx1;
  const cy2 = drag > 0 ? lerp(compY + 26, compY + 56, drag) : cy1;
  const curX = drag > 0 ? cx2 : cx1;
  const curY = drag > 0 ? cy2 : cy1;
  win_.push(cursor(curX, curY, { scale: 1.35, opacity: fade(t, 0.05, 0.12) }));
  if (drag > 0 && drag < 1) win_.push(clickRipple(curX, curY, (t * 3) % 1));

  out.push(g(win_.join(''), { transform: cam }));

  // "anywhere" chips
  const chips = [
    ['whatsapp', 250, 250], ['gmail', 1720, 300], ['linkedin', 180, 700],
    ['slack', 1760, 780], ['notion', 300, 940], ['docs', 1660, 980],
  ];
  const chipStart = 1.55;
  chips.forEach(([label, x, y], i) => {
    const p = win(t, chipStart + i * 0.075, 0.5, ease.outQuint);
    if (p <= 0) return;
    const pill = ui.pill(x, y + (1 - p) * 26, label, {
      size: 15, h: 38, fill: T.paper2, stroke: T.line300, color: T.cocoa700, padX: 18,
    });
    out.push(
      g(
        circle(x + 4, y + 19 + (1 - p) * 26, 4.5, { fill: T.terra500, opacity: p }) + pill.svg,
        { opacity: p * 0.95 }
      )
    );
  });

  return out.join('');
}

/* ================================================= 5. choose mode + compare */

const ORIGINAL_LINES = [
  'I think we can ship Friday but the auth migration',
  'might cause issues and I dont want to promise.',
];
const SUGGESTED =
  'We can likely ship on Friday, but the authentication migration still carries some risk. I would rather confirm the migration first than make a promise we may not be able to keep.';

export function sceneRewrite({ t, d }) {
  const out = [];
  out.push(bgPaper());
  out.push(glow(600, 300, 900, T.saffron, 0.13));
  out.push(glow(1500, 900, 820, T.terra500, 0.10));

  const bw = 1180, bh = 700;
  const bx = 120, by = 190;
  out.push(ui.browserWindow(bx, by, bw, bh, { url: 'web.whatsapp.com' }));
  const inner = { x: bx + 1, y: by + 52, w: bw - 2, h: bh - 52 };
  out.push(ui.chatMock(inner.x, inner.y, inner.w, inner.h, {}));

  // panel geometry
  const pw = 700;
  const px = 1000;
  const modeH = 232;
  const cmpH = 356;
  const pIn = clamp(spring(t - 0.02, { stiffness: 170, damping: 20 }));
  const toCompare = win(t, 1.92, 0.5, ease.inOutCubic);
  const ph = lerp(modeH, cmpH, toCompare);
  const py = lerp(330, 250, toCompare);
  const pScale = lerp(0.94, 1, pIn);
  const pTransform =
    `translate(${n(px + pw / 2)} ${n(py + ph / 2)}) scale(${n(pScale)}) translate(${n(-px - pw / 2)} ${n(-py - ph / 2)})`;

  const body = [];
  // ---- modes view
  const modesOpacity = 1 - toCompare;
  if (modesOpacity > 0.01) {
    const mv = [];
    mv.push(ui.panelHeader(px + 24, py + 34, pw - 48, 'Rewrite selected text', { opacity: modesOpacity }));
    const cw = 124, ch = 78, gap = 10;
    const total = ui.MODES.length * cw + (ui.MODES.length - 1) * gap;
    let cxp = px + (pw - total) / 2;
    const selectedIndex = 3;
    ui.MODES.forEach((m, i) => {
      const p = clamp(spring(t - 0.30 - i * 0.055, { stiffness: 210, damping: 18 }));
      const sel = t > 1.28 && i === selectedIndex;
      mv.push(
        g(ui.modeCard(cxp, py + 56, cw, ch, m, { selected: sel, opacity: modesOpacity * clamp(p * 1.2) }), {
          transform: `translate(${n(cxp + cw / 2)} ${n(py + 56 + ch / 2)}) scale(${n(lerp(0.86, 1, p))}) translate(${n(-cxp - cw / 2)} ${n(-py - 56 - ch / 2)})`,
        })
      );
      cxp += cw + gap;
    });
    mv.push(line(px + 24, py + 152, px + pw - 24, py + 152, { stroke: T.line200, opacity: modesOpacity }));
    const prof = ui.pill(px + 24, py + 166, 'Work profile', { size: 12, h: 30, caret: true, opacity: modesOpacity });
    mv.push(prof.svg);
    const len = ui.pill(px + 168, py + 166, 'Same length', { size: 12, h: 30, caret: true, opacity: modesOpacity });
    mv.push(len.svg);
    const btnP = clamp(spring(t - 0.55, { stiffness: 220, damping: 18 }));
    const pressed = t > 1.72 && t < 1.86;
    mv.push(
      g(ui.button(px + pw - 24 - 128, py + 164, 128, 34, 'Rewrite', { opacity: modesOpacity * btnP }), {
        transform: `translate(${n(px + pw - 88)} ${n(py + 181)}) scale(${n(pressed ? 0.94 : 1)}) translate(${n(-px - pw + 88)} ${n(-py - 181)})`,
      })
    );
    if (t > 1.72) mv.push(clickRipple(px + pw - 88, py + 181, (t - 1.72) / 0.5));
    body.push(g(mv.join(''), { opacity: 1 }));
  }

  // ---- compare view
  const cmpOpacity = toCompare;
  if (cmpOpacity > 0.01) {
    const cv = [];
    cv.push(
      text('Proposed rewrite', {
        x: px + 24, y: py + 36, size: 13, weight: 600, fill: T.cocoa600, opacity: cmpOpacity,
      })
    );
    const chipP = win(t, 3.15, 0.45, ease.outQuint);
    if (chipP > 0) {
      const chip = ui.checkChip(px + pw - 24 - 178, py + 20, 'Meaning preserved', { opacity: chipP });
      cv.push(chip.svg);
    }
    cv.push(line(px + 24, py + 54, px + pw - 24, py + 54, { stroke: T.line200, opacity: cmpOpacity }));

    // original (dim)
    const oTop = py + 78;
    cv.push(
      text('ORIGINAL', {
        x: px + 24, y: oTop, size: 10, weight: 800, ls: 2.2, fill: T.cocoa400, opacity: cmpOpacity * 0.9,
      })
    );
    ORIGINAL_LINES.forEach((l, i) => {
      cv.push(
        text(l, {
          x: px + 24, y: oTop + 22 + i * 21, size: 14, weight: 400, fill: T.cocoa600,
          opacity: cmpOpacity * 0.72,
        })
      );
    });
    cv.push(
      line(px + 24, oTop + 74, px + pw - 24, oTop + 74, { stroke: T.line200, opacity: cmpOpacity })
    );

    // suggested, word-by-word reveal
    const sTop = oTop + 92;
    cv.push(
      text('SUGGESTION', {
        x: px + 24, y: sTop, size: 10, weight: 800, ls: 2.2, fill: T.terra700, opacity: cmpOpacity,
      })
    );
    const maxW = pw - 48;
    const wrapped = wrapWords(SUGGESTED, maxW, { size: 15.5, weight: 400 });
    const revealStart = 2.15;
    let idx = 0;
    wrapped.forEach((ln, li) => {
      let x = px + 24;
      ln.words.forEach((w) => {
        const p = win(t, revealStart + idx * 0.022, 0.28, ease.outQuad);
        idx++;
        const y = sTop + 26 + li * 25 + (1 - p) * 8;
        cv.push(
          text(w.text, {
            x, y, size: 15.5, weight: 500, fill: T.cocoa950, opacity: cmpOpacity * p,
          })
        );
        x += w.w + w.gap;
      });
    });

    // footer controls
    const fTop = py + cmpH - 62;
    cv.push(line(px + 24, fTop - 16, px + pw - 24, fTop - 16, { stroke: T.line200, opacity: cmpOpacity }));
    const fP = win(t, 3.35, 0.5, ease.outQuint);
    cv.push(
      g(ui.button(px + pw - 24 - 168, fTop, 168, 34, 'Replace selection', { opacity: cmpOpacity * fP }), {})
    );
    const copy = ui.pill(px + 24, fTop, 'Copy', { size: 12.5, h: 34, fill: '#FFFFFF', stroke: T.line300, opacity: cmpOpacity * fP });
    cv.push(copy.svg);
    const again = ui.pill(px + 24 + copy.w + 10, fTop, 'Try again', { size: 12.5, h: 34, fill: '#FFFFFF', stroke: T.line300, opacity: cmpOpacity * fP });
    cv.push(again.svg);
    body.push(cv.join(''));
  }

  out.push(
    g(
      card(px, py, pw, ph, { rx: 16, fill: T.paper2, stroke: T.line200, sw: 1.5, shadow: true, shadowOpacity: 0.20, dy: 16 }) +
        body.join(''),
      { transform: pTransform, opacity: clamp(pIn * 1.4) }
    )
  );

  // cursor journey: card -> rewrite button
  const c1 = win(t, 0.85, 0.45, ease.inOutCubic);
  const c2 = win(t, 1.42, 0.32, ease.inOutCubic);
  let curX = 1780, curY = 980;
  if (c1 > 0) {
    const cardX = px + 20 + 3 * 134 + 62;
    curX = lerp(1780, cardX, c1);
    curY = lerp(980, py + 95, c1);
  }
  if (c2 > 0) {
    curX = lerp(px + 20 + 3 * 134 + 62, px + pw - 88, c2);
    curY = lerp(py + 95, py + 181, c2);
  }
  if (t < 2.05) out.push(cursor(curX, curY, { scale: 1.3, opacity: fade(t, 0.6, 0.2) * (1 - fadeOut(t, 1.95, 0.1)) }));

  return out.join('');
}

function wrapWords(str, maxW, opts) {
  const sw = spaceWidth(opts);
  const lines = [];
  let cur = { words: [], w: 0 };
  for (const wd of str.split(/\s+/).filter(Boolean)) {
    const w = measure(wd, opts).w;
    if (cur.words.length && cur.w + sw + w > maxW) {
      lines.push(cur);
      cur = { words: [], w: 0 };
    }
    cur.words.push({ text: wd, w, gap: sw });
    cur.w += (cur.words.length > 1 ? sw : 0) + w;
  }
  if (cur.words.length) lines.push(cur);
  return lines;
}

/* ============================================================ 6. five modes */

const MODE_BEATS = [
  {
    mode: ui.MODES[0],
    before: 'i think we can maybe ship friday but the auth migration might cause issues',
    after: 'We can likely ship on Friday, but the authentication migration still carries some risk.',
  },
  {
    mode: ui.MODES[1],
    before: 'Please be advised that the meeting has been rescheduled.',
    after: 'Heads up — the meeting moved. Let me know if that still works for you.',
  },
  {
    mode: ui.MODES[2],
    before: 'Send me the file now.',
    after: 'Could you send the file when you get a chance? Thanks so much.',
  },
  {
    mode: ui.MODES[3],
    before: 'I think we can maybe ship Friday???',
    after: "We're shipping Friday. I'll raise the auth migration risk separately.",
  },
  {
    mode: ui.MODES[4],
    before: 'The API outage was definitely caused by the database migration.',
    after: 'Your direction may be right, but the evidence does not rule out other causes.',
    verdict: 'Conclusion is not yet supported',
  },
];

export function sceneModes({ t, d, beat }) {
  const out = [];
  out.push(bgPaper());
  out.push(glow(CX, 420, 1000, T.saffron, 0.13));
  out.push(glow(260, 880, 720, T.terra500, 0.09));

  // beats come from the speech: local times of each spoken mode name
  const b = (beat?.beats ?? [0.39, 1.29, 2.17, 2.98, 4.59]).map((x) => x);

  let current = 0;
  for (let i = 0; i < b.length; i++) if (t >= b[i] - 0.28) current = i;

  const cw = 1180, chh = 470;
  const cxp = CX - cw / 2;
  const cyp = 250;

  for (let i = Math.max(0, current - 1); i <= current; i++) {
    const item = MODE_BEATS[i];
    const start = b[i];
    const inP = win(t, start - 0.02, 0.62, ease.outQuint);
    const leaving = i < current;
    const outP = leaving ? win(t, b[current], 0.5, ease.inOutCubic) : 0;
    const exitP = win(t, d - 0.4, 0.4, ease.inQuad);
    const xOff = lerp(160, 0, inP) - outP * 190;
    const op = (leaving ? 1 - outP : 1) * (1 - exitP * 0.6);
    const sc = lerp(0.965, 1, inP) - outP * 0.05;
    if (op <= 0.01) continue;

    const inner = [];
    // header
    inner.push(
      g(ui.modeIcon(item.mode.icon, cxp + 52, cyp + 54, 20, T.terra600), { opacity: op })
    );
    inner.push(
      text(`${item.mode.name}${item.mode.name2 ? ` ${item.mode.name2.replace('& ', '')}` : ''}`, {
        x: cxp + 88, y: cyp + 63, size: 42, weight: 800, ls: -0.8, fill: T.cocoa950, opacity: op,
      })
    );
    inner.push(
      text(`0${i + 1} / 05`, {
        x: cxp + cw - 40, y: cyp + 62, size: 15, weight: 800, ls: 3,
        fill: T.cocoa400, anchor: 'end', opacity: op,
      })
    );
    inner.push(text(item.mode.sub, { x: cxp + 88, y: cyp + 92, size: 17, weight: 500, fill: T.cocoa600, opacity: op }));
    inner.push(line(cxp + 40, cyp + 124, cxp + cw - 40, cyp + 124, { stroke: T.line200, opacity: op }));

    // before
    inner.push(
      text('BEFORE', { x: cxp + 40, y: cyp + 160, size: 10.5, weight: 800, ls: 2.4, fill: T.cocoa400, opacity: op })
    );
    inner.push(
      text(item.before, { x: cxp + 40, y: cyp + 190, size: 21, weight: 400, fill: T.cocoa600, opacity: op * 0.85 })
    );

    // after (word reveal)
    inner.push(
      text('AFTER', {
        x: cxp + 40, y: cyp + 246, size: 10.5, weight: 800, ls: 2.4,
        fill: item.verdict ? T.warning : T.terra700, opacity: op,
      })
    );
    const words = textRun(item.after, { x: cxp + 40, y: 0, size: 25, weight: 600 });
    let wx = cxp + 40;
    let wy = cyp + 284;
    const maxRight = cxp + cw - 40;
    words.forEach((w, wi) => {
      if (wx + w.w > maxRight) {
        wx = cxp + 40;
        wy += 38;
      }
      const p = win(t, start + 0.16 + wi * 0.028, 0.3, ease.outQuad);
      inner.push(
        text(w.text, {
          x: wx, y: wy + (1 - p) * 10, size: 25, weight: 600, fill: T.cocoa950, opacity: op * p,
        })
      );
      wx += w.w + w.gap;
    });

    if (item.verdict) {
      const vp = win(t, start + 0.95, 0.5, ease.outQuint);
      const chipW = textW(item.verdict, { size: 14, weight: 700 }) + 56;
      inner.push(
        g(
          rect(cxp + 40, cyp + 350, chipW, 36, { rx: 18, fill: '#FFF2DF', stroke: T.warning, sw: 1.2, opacity: vp }) +
            circle(cxp + 62, cyp + 368, 9, { fill: T.warning, opacity: vp }) +
            text('!', { x: cxp + 62, y: cyp + 373, size: 12, weight: 800, fill: '#FFFFFF', anchor: 'middle', opacity: vp }) +
            text(item.verdict, { x: cxp + 82, y: cyp + 374, size: 14, weight: 700, fill: T.warning, opacity: vp }),
          {}
        )
      );
    }

    out.push(
      g(
        card(cxp, cyp, cw, chh, { rx: 20, fill: T.paper2, stroke: T.line200, sw: 1.5, shadow: true, dy: 18, shadowOpacity: 0.16 }) +
          inner.join(''),
        {
          transform: `translate(${n(xOff)} 0) translate(${CX} ${cyp + chh / 2}) scale(${n(sc)}) translate(${-CX} ${-cyp - chh / 2})`,
          opacity: op,
        }
      )
    );
  }

  // progress segments
  const segW = 132, segGap = 12;
  const totalW = 5 * segW + 4 * segGap;
  let sx = CX - totalW / 2;
  const sy = cyp + chh + 54;
  b.forEach((start, i) => {
    const active = i <= current;
    const p = i < current ? 1 : i === current ? win(t, start, Math.max(0.5, (b[i + 1] ?? d) - start), ease.linear) : 0;
    out.push(rect(sx, sy, segW, 5, { rx: 2.5, fill: T.line300, opacity: 0.75 }));
    out.push(rect(sx, sy, segW * p, 5, { rx: 2.5, fill: active ? T.terra600 : T.line300 }));
    sx += segW + segGap;
  });

  // heading
  out.push(
    text('FIVE MODES', {
      x: CX, y: 186, size: 15, weight: 800, ls: 7.6, fill: T.terra700, anchor: 'middle',
      opacity: clamp(win(t, 0, 0.5, ease.outQuad)),
    })
  );

  return out.join('');
}

/* ======================================================== 7. fidelity check */

const FID_TOKENS = [
  { t: 'We can likely ship on ' },
  { t: 'Friday', k: 'date' },
  { t: ', but the authentication migration still carries risk for ' },
  { t: '12', k: 'number' },
  { t: ' services. Ping ' },
  { t: 'Amir', k: 'name' },
  { t: ' before ' },
  { t: '16:45', k: 'time' },
  { t: ' and check ' },
  { t: 'wordsaffron.dev/runbook', k: 'url' },
  { t: '.' },
];

export function sceneFidelity({ t, d }) {
  const out = [];
  out.push(bgPaper());
  out.push(glow(CX, 420, 980, T.pistachio100, 0.55));
  out.push(glow(1600, 900, 700, T.terra500, 0.08));

  const cw = 1380, ch = 520;
  const cxp = CX - cw / 2, cyp = 232;
  const inP = clamp(spring(t - 0.02, { stiffness: 170, damping: 20 }));

  const body = [];
  body.push(
    text('MEANING CHECK', { x: cxp + 44, y: cyp + 52, size: 12, weight: 800, ls: 4.6, fill: T.terra700 })
  );
  body.push(
    text('Everything that must survive, did.', {
      x: cxp + 44, y: cyp + 92, size: 22, weight: 500, fill: T.cocoa600,
    })
  );

  // layout tokens
  const opts = { size: 32, weight: 500, family: F.sans };
  const sw = spaceWidth(opts);
  const maxW = cw - 88;
  const laid = [];
  let x = cxp + 44, y = cyp + 168;
  FID_TOKENS.forEach((tok) => {
    const words = tok.t.split(/(\s+)/).filter((s) => s.length);
    words.forEach((piece) => {
      const isSpace = /^\s+$/.test(piece);
      const w = isSpace ? sw : measure(piece, opts).w;
      if (!isSpace && x + w > cxp + cw - 44) {
        x = cxp + 44;
        y += 48;
      }
      if (!isSpace) laid.push({ text: piece, x, y, w, k: tok.k });
      x += w;
    });
  });

  // scan line
  const scanStart = 0.85;
  const scanDur = 2.05;
  const scanP = win(t, scanStart, scanDur, ease.inOutQuad);
  const scanX = cxp + 30 + (cw - 60) * scanP;

  laid.forEach((tk, i) => {
    const appear = win(t, 0.18 + i * 0.012, 0.35, ease.outQuad);
    const cxm = tk.x + tk.w / 2;
    const passed = scanP > 0 && cxm < scanX;
    const hp = passed ? win(t, scanStart + (cxm - cxp - 30) / (cw - 60) * scanDur, 0.28, ease.outQuad) : 0;
    if (tk.k) {
      body.push(
        rect(tk.x - 7, tk.y - 30, tk.w + 14, 42, {
          rx: 8, fill: T.terra100, opacity: hp * 0.95,
        })
      );
      body.push(
        rect(tk.x - 7, tk.y + 12, tk.w + 14, 3, { rx: 1.5, fill: T.terra600, opacity: hp })
      );
    }
    body.push(
      text(tk.text, {
        x: tk.x, y: tk.y, ...opts, fill: tk.k ? T.cocoa950 : T.cocoa700, opacity: appear,
      })
    );
  });

  if (scanP > 0 && scanP < 1) {
    body.push(
      `<defs>${lg('scanG', [[0, T.terra600, 0], [0.5, T.terra600, 0.5], [1, T.terra600, 0]], { x1: 0, y1: 0, x2: 1, y2: 0 })}</defs>`
    );
    body.push(rect(scanX - 90, cyp + 128, 180, 300, { fill: 'url(#scanG)', opacity: 0.16 }));
    body.push(rect(scanX - 1.5, cyp + 128, 3, 300, { fill: T.terra600, opacity: 0.85 }));
  }

  // chips row
  const chipDefs = [
    { label: 'Friday — date', at: 0.30 },
    { label: '12 — number', at: 1.05 },
    { label: 'Amir — name', at: 1.55 },
    { label: '16:45 — time', at: 2.05 },
    { label: 'URL — link', at: 2.55 },
  ];
  let chipX = cxp + 44;
  chipDefs.forEach((c) => {
    const p = clamp(spring(t - (scanStart + c.at * 0.62) - 0.25, { stiffness: 260, damping: 20 }));
    if (p <= 0.01) return;
    const chip = ui.checkChip(chipX, cyp + 372, c.label, { size: 13, h: 34, opacity: p });
    body.push(
      g(chip.svg, {
        transform: `translate(${n(chipX)} ${n(cyp + 372 + 17)}) scale(${n(lerp(0.8, 1, p))}) translate(${n(-chipX)} ${n(-cyp - 389)})`,
      })
    );
    chipX += chip.w + 12;
  });

  // verdict
  const vP = win(t, 3.15, 0.5, ease.outQuint);
  if (vP > 0) {
    const txt = '5 details checked · 5 preserved';
    const w = textW(txt, { size: 20, weight: 700 }) + 76;
    body.push(
      g(
        rect(cxp + 44, cyp + 424, w, 48, { rx: 24, fill: T.pistachio100, stroke: T.pistachio600, sw: 1.4, opacity: vP }) +
          circle(cxp + 44 + 26, cyp + 448, 11, { fill: T.pistachio600, opacity: vP }) +
          path('M-4.4 -0.2 L-1.2 3.4 L4.6 -3.4', {
            transform: `translate(${n(cxp + 70)} ${n(cyp + 448)})`, stroke: '#FFFFFF', sw: 2, fill: 'none', cap: 'round', opacity: vP,
          }) +
          text(txt, { x: cxp + 44 + 52, y: cyp + 455, size: 20, weight: 700, fill: T.pistachio600, opacity: vP }),
        {}
      )
    );
    body.push(
      text('No claims, dates, or commitments were added.', {
        x: cxp + 44 + w + 24, y: cyp + 455, size: 16, weight: 500, fill: T.cocoa600, opacity: vP * 0.9,
      })
    );
  }

  out.push(
    g(
      card(cxp, cyp, cw, ch, { rx: 20, fill: T.paper2, stroke: T.line200, sw: 1.5, shadow: true, dy: 18, shadowOpacity: 0.16 }) +
        body.join(''),
      {
        transform: `translate(${CX} ${cyp + ch / 2}) scale(${n(lerp(0.96, 1, inP))}) translate(${-CX} ${-cyp - ch / 2})`,
        opacity: clamp(inP * 1.5),
      }
    )
  );

  out.push(
    text('YOUR FACTS SURVIVE', {
      x: CX, y: 176, size: 15, weight: 800, ls: 7.6, fill: T.terra700, anchor: 'middle',
      opacity: win(t, 0, 0.5, ease.outQuad),
    })
  );
  return out.join('');
}

/* ====================================================== 8. control / privacy */

export function sceneControl({ t, d }) {
  const out = [];
  out.push(bgPaper());
  out.push(glow(420, 300, 820, T.saffron, 0.13));
  out.push(glow(1560, 820, 820, T.terra500, 0.10));

  const heading = 'You hold the switch';
  out.push(
    text('YOUR KEY · YOUR PROVIDER · YOUR RULES', {
      x: CX, y: 168, size: 14, weight: 800, ls: 6.4, fill: T.terra700, anchor: 'middle',
      opacity: win(t, 0, 0.45, ease.outQuad),
    })
  );
  out.push(
    text(heading, {
      x: CX, y: 240, size: 62, weight: 800, ls: -1.4, fill: T.cocoa950, anchor: 'middle',
      opacity: win(t, 0.08, 0.5, ease.outQuint),
    })
  );

  // provider cards
  const pw = 470, ph = 150;
  const p1x = CX - pw - 20, p2x = CX + 20, py = 320;
  const provs = [
    { name: 'OpenRouter', sub: 'Logic review + researched review', tag: 'BRING YOUR OWN KEY' },
    { name: 'Google AI Studio', sub: 'Writing tools + logic-only review', tag: 'BRING YOUR OWN KEY' },
  ];
  provs.forEach((p, i) => {
    const ip = clamp(spring(t - 0.25 - i * 0.12, { stiffness: 200, damping: 19 }));
    const x = i === 0 ? p1x : p2x;
    const body = [];
    body.push(
      text(p.name, { x: x + 28, y: py + 62, size: 26, weight: 700, fill: T.cocoa950, opacity: ip })
    );
    body.push(text(p.sub, { x: x + 28, y: py + 92, size: 15, weight: 400, fill: T.cocoa600, opacity: ip }));
    body.push(
      text(p.tag, { x: x + 28, y: py + 124, size: 10.5, weight: 800, ls: 2.6, fill: T.terra700, opacity: ip })
    );
    body.push(circle(x + pw - 42, py + 44, 16, { fill: T.terra100, opacity: ip }));
    body.push(
      path('M-5 -0.2 L-1.4 3.6 L5.4 -3.6', {
        transform: `translate(${n(x + pw - 42)} ${n(py + 44)})`, stroke: T.terra600, sw: 2.2, fill: 'none', cap: 'round', opacity: ip,
      })
    );
    out.push(
      g(card(x, py, pw, ph, { rx: 16, fill: T.paper2, stroke: T.line200, sw: 1.5, shadow: true, dy: 10, shadowOpacity: 0.12 }) + body.join(''), {
        transform: `translate(${n(x + pw / 2)} ${n(py + ph / 2)}) scale(${n(lerp(0.94, 1, ip))}) translate(${n(-x - pw / 2)} ${n(-py - ph / 2)})`,
        opacity: clamp(ip * 1.4),
      })
    );
  });

  // switches
  const swY = 530;
  const swW = 470;
  const rows = [
    { label: 'Global', sub: 'Everywhere', off: 1.55 },
    { label: 'This site', sub: 'web.whatsapp.com', off: 1.75 },
    { label: 'This tab', sub: 'Until you close it', off: 1.95 },
  ];
  rows.forEach((r, i) => {
    const x = i === 0 ? p1x : i === 1 ? p2x : CX - swW / 2;
    const y = swY - 50 + (i === 2 ? 100 : 0);
    const ip = clamp(spring(t - 0.55 - i * 0.1, { stiffness: 200, damping: 20 }));
    const on = t < r.off;
    const click = Math.max(0, 1 - Math.abs(t - r.off) / 0.12);
    out.push(
      g(ui.switchRow(x, y, swW, r.label, r.sub, on, { opacity: ip }), {
        transform: `translate(${n(x + swW / 2)} ${n(y + 36)}) scale(${n(lerp(0.96, 1, ip) - click * 0.012)}) translate(${n(-x - swW / 2)} ${n(-y - 36)})`,
      })
    );
    if (click > 0) out.push(clickRipple(x + swW - 52, y + 36, clamp((t - r.off) / 0.45)));
  });

  // zero requests counter
  const zP = clamp(spring(t - 2.25, { stiffness: 200, damping: 16 }));
  if (t > 2.1) {
    const body = [];
    body.push(
      text('0', {
        x: CX, y: 800, size: 128, weight: 900, ls: -4, fill: T.terra700, anchor: 'middle',
        opacity: zP, transform: `translate(${CX} 740) scale(${n(lerp(0.7, 1, zP))}) translate(${-CX} -740)`,
      })
    );
    body.push(
      text('REQUESTS MADE WHILE IT IS OFF', {
        x: CX, y: 848, size: 15, weight: 800, ls: 6, fill: T.cocoa600, anchor: 'middle', opacity: zP,
      })
    );
    const chips = ['No backend', 'No account', 'No telemetry'];
    let chipX = CX - 250;
    chips.forEach((c, i) => {
      const p = clamp(spring(t - 2.5 - i * 0.09, { stiffness: 240, damping: 20 }));
      const pill = ui.pill(chipX, 890, c, { size: 14, h: 36, fill: T.terra100, stroke: T.terra100, color: T.terra700, padX: 18 });
      body.push(g(pill.svg, { opacity: p, transform: `translate(${n(chipX)} 908) scale(${n(lerp(0.85, 1, p))}) translate(${n(-chipX)} -908)` }));
      chipX += pill.w + 12;
    });
    out.push(body.join(''));
  }

  return out.join('');
}

/* ================================================================= 9. outro */

export function sceneOutro({ t, d }) {
  const out = [];
  out.push(bgPaper());
  out.push(glow(CX, 500, 1000, T.saffron, 0.20));
  out.push(glow(CX, 620, 620, T.terra500, 0.13));

  // drifting petals
  for (let i = 0; i < 7; i++) {
    const sx = 120 + rnd(i * 5.1) * (W - 240);
    const speed = 14 + rnd(i * 3.3) * 26;
    const y = ((rnd(i * 9.7) * H + 200 - t * speed) % (H + 300) + H + 300) % (H + 300) - 150;
    const x = sx + Math.sin(t * 0.5 + i * 1.7) * 34;
    const rot = t * (8 + i * 3) + i * 40;
    const sc = 0.13 + rnd(i * 2.2) * 0.1;
    out.push(
      g(path(PETALS[i % 3], { fill: T.saffronLight }), {
        transform: `translate(${n(x)} ${n(y)}) scale(${n(sc)}) rotate(${n(rot)}) translate(-256 -300)`,
        opacity: 0.42,
      })
    );
  }

  const mSize = 190;
  const mx = CX - mSize / 2;
  const my = 176;
  const bp = clamp(spring(t - 0.05, { stiffness: 140, damping: 15 }));
  const petalP = [0, 1, 2].map((i) => clamp(spring(t - 0.35 - i * 0.1, { stiffness: 190, damping: 14 })));
  out.push(
    g(
      circle(CX, my + mSize / 2, mSize * 0.75, { fill: T.terra100, opacity: 0.5 }) +
        mark(mx, my, mSize, { petalScale: petalP.map((p) => lerp(0.2, 1, p)), petalOpacity: petalP }),
      {
        transform: `translate(${CX} ${my + mSize / 2}) scale(${n(lerp(0.5, 1, bp))}) translate(${-CX} ${-my - mSize / 2})`,
      }
    )
  );

  const size = fitSize(WM, 1180, { size: 142, family: F.serif, weight: 700 });
  const o = { size, family: F.serif, weight: 700 };
  const top = 428;
  chars(WM, { ...o, x: CX, anchor: 'middle' }).forEach((c) => {
    const p = win(t, 0.55 + c.i * 0.042, 0.6, ease.outQuint);
    if (p <= 0) return;
    const y = topBaseline(top, o) + (1 - p) * 36;
    out.push(text(c.ch, { x: c.x, y, ...o, fill: T.cocoa950, opacity: p }));
  });

  const tagP = win(t, 1.5, 0.8, ease.outQuint);
  if (tagP > 0) {
    const rule = 420 * tagP;
    out.push(rect(CX - rule / 2, top + size * 0.86, rule, 3, { rx: 1.5, fill: T.saffron, opacity: 0.85 }));
    const tagline = 'A pinch of clarity. Still your words.';
    const ts = fitSize(tagline, 1100, { size: 54, family: F.serif, weight: 400, italic: true });
    out.push(
      text(tagline, {
        x: CX, y: topBaseline(top + size * 0.86 + 42, { size: ts, family: F.serif, italic: true }),
        size: ts, family: F.serif, italic: true, fill: T.terra600, anchor: 'middle', opacity: tagP,
      })
    );
  }

  const metaP = win(t, 2.6, 0.7, ease.outQuad);
  if (metaP > 0) {
    const pillW = textW('Chrome Web Store', { size: 17, weight: 700 }) + 58;
    out.push(
      rect(CX - pillW / 2, 770, pillW, 50, { rx: 25, fill: T.cocoa950, opacity: metaP })
    );
    out.push(
      text('Chrome Web Store', {
        x: CX, y: 801, size: 17, weight: 700, fill: T.paper, anchor: 'middle', opacity: metaP,
      })
    );
    out.push(
      text('Motion-graphics mockup · not a runtime capture', {
        x: CX, y: 862, size: 12.5, weight: 500, fill: T.cocoa400, anchor: 'middle', opacity: metaP * 0.9,
      })
    );
  }

  // gentle breathe
  const breathe = 1 + Math.sin(t * 0.7) * 0.004;
  return g(out.join(''), {
    transform: `translate(${CX} ${CY}) scale(${n(breathe)}) translate(${-CX} ${-CY})`,
  });
}
