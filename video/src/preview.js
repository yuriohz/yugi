import { frameSvg } from './render.js';
import { renderSvg } from './theme.js';
import { saveMetrics } from './measure.js';

// Render a frame as an ASCII luminance map so composition can be checked without
// opening an image.  Dark ink = dense glyphs, light = empty paper.
const RAMP = ' .:-=+*#%@';

export function asciiFrame(t, cols = 118, crop = null) {
  const scale = cols / (crop ? crop.w : 1920);
  const img = renderSvg(frameSvg(t), scale);
  const { pixels: px, width: w, height: h } = img;
  const rows = Math.round((h / w) * cols * 0.5);
  const out = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x = Math.min(w - 1, Math.round((c / cols) * w));
      const y = Math.min(h - 1, Math.round((r / rows) * h));
      const i = (y * w + x) * 4;
      const l = (0.2126 * px[i + 2] + 0.7152 * px[i + 1] + 0.0722 * px[i]) / 255;
      // invert: dark ink -> dense char
      const k = Math.min(RAMP.length - 1, Math.max(0, Math.round((1 - l) * (RAMP.length - 1) * 1.9)));
      line += RAMP[k];
    }
    out.push(line);
  }
  return out.join('\n');
}

const argv = process.argv.slice(2);
const cropIdx = argv.indexOf('--crop');
const crop = cropIdx >= 0 ? argv[cropIdx + 1].split(',').map(Number) : null;
const times = argv.filter((a) => /^[0-9.]+$/.test(a)).map(Number);
const list = times.length ? times : [1.8, 4.2, 6.8, 9.4, 13.2, 16.6, 22.4, 27.2, 31.6];
for (const t of list) {
  console.log(`\n=== t=${t.toFixed(2)}s ${crop ? `crop ${crop.join(',')} ` : ''}${'='.repeat(70)}`);
  console.log(asciiFrame(t, 118, crop ? { x: crop[0], y: crop[1], w: crop[2], h: crop[3] } : null));
}
saveMetrics();
