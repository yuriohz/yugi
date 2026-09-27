import { frameSvg } from './render.js';
import { measure } from './measure.js';
import { saveMetrics } from './measure.js';
import { SHOTS, TOTAL } from './timeline.js';
import { renderSvg } from './theme.js';

// Parse every <text> in a generated frame and verify it sits inside the frame
// (with transforms ignored: catches gross layout overflow, not sub-pixel drift).
const RE = /<text\s([^>]*)>([^<]*)<\/text>/g;

function attr(str, key, dflt) {
  const m = str.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : dflt;
}

function checkFrame(t) {
  const svg = frameSvg(t);
  const issues = [];
  let count = 0;
  for (const m of svg.matchAll(RE)) {
    const attrs = m[1];
    const content = m[2];
    if (!content.trim()) continue;
    count++;
    const x = parseFloat(attr(attrs, 'x', '0'));
    const y = parseFloat(attr(attrs, 'y', '0'));
    const size = parseFloat(attr(attrs, 'font-size', '48'));
    const weight = parseInt(attr(attrs, 'font-weight', '400'), 10);
    const family = attr(attrs, 'font-family', 'Inter');
    const ls = parseFloat(attr(attrs, 'letter-spacing', '0'));
    const anchor = attr(attrs, 'text-anchor', 'start');
    const w = measure(content, { size, weight, family, ls }).w;
    let x1 = x;
    if (anchor === 'middle') x1 = x - w / 2;
    else if (anchor === 'end') x1 = x - w;
    const x2 = x1 + w;
    if (x1 < 12 || x2 > 1908) issues.push(`x-overflow "${content.slice(0, 40)}" [${x1.toFixed(0)} → ${x2.toFixed(0)}]`);
    if (y < 30 || y > 1058) issues.push(`y-out "${content.slice(0, 40)}" y=${y.toFixed(0)}`);
  }
  return { count, issues };
}

function stats(t, scale = 0.4) {
  const img = renderSvg(frameSvg(t), scale);
  const px = img.pixels;
  let sum = 0, min = 255, max = 0, n = 0;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * 4;
      const l = 0.2126 * px[i + 2] + 0.7152 * px[i + 1] + 0.0722 * px[i];
      sum += l; n++;
      if (l < min) min = l;
      if (l > max) max = l;
      if (l < 200) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return {
    mean: (sum / n).toFixed(1),
    min: min.toFixed(0),
    max: max.toFixed(0),
    bbox: `${(minX / scale).toFixed(0)},${(minY / scale).toFixed(0)} → ${(maxX / scale).toFixed(0)},${(maxY / scale).toFixed(0)}`,
  };
}

const samples = [];
for (const s of SHOTS) {
  const d = s.end - s.start;
  for (const f of [0.05, 0.3, 0.6, 0.85]) samples.push([s.id, s.start + d * f]);
}

let bad = 0;
for (const [id, t] of samples) {
  const { count, issues } = checkFrame(t);
  const st = stats(t);
  const flag = issues.length ? ' ✗' : '';
  if (issues.length) bad++;
  console.log(
    `${id.padEnd(10)} t=${t.toFixed(2).padStart(6)}  texts=${String(count).padStart(3)}  ` +
    `lum=${st.mean.padStart(5)} (${st.min}–${st.max})  ink-bbox ${st.bbox}${flag}`
  );
  issues.forEach((i) => console.log('    ↳', i));
}
console.log(bad ? `\n${bad} frame(s) with layout issues` : '\nall frames within bounds');
saveMetrics();
