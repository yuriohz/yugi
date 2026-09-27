import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSvg, svgDoc, grainOverlay, vignette, W, H, g, esc, n } from './theme.js';
import * as scenes from './scenes.js';
import { SHOTS, TOTAL, FPS, TRANSITION, shotIndexAt, modeBeats } from './timeline.js';
import { ffmpegPath } from './audio/ffmpeg.js';
import { clamp, ease, lerp } from './anim.js';
import { saveMetrics } from './measure.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(ROOT, 'out');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const SCENE_FN = {
  coldopen: scenes.sceneColdOpen,
  impact: scenes.sceneImpact,
  wordmark: scenes.sceneWordmark,
  select: scenes.sceneSelect,
  rewrite: scenes.sceneRewrite,
  modes: scenes.sceneModes,
  fidelity: scenes.sceneFidelity,
  control: scenes.sceneControl,
  outro: scenes.sceneOutro,
};

const BEATS = modeBeats();

function ctxFor(shotId, t, abs) {
  const shot = SHOTS.find((s) => s.id === shotId);
  return {
    t,
    d: shot.end - shot.start,
    abs,
    beat: shotId === 'modes' ? { beats: BEATS } : { beats: [] },
  };
}

export function frameSvg(t) {
  const i = shotIndexAt(t);
  const shot = SHOTS[i];
  const dur = shot.end - shot.start;
  const local = Math.min(t - shot.start, dur - 1e-4);
  const incoming = SCENE_FN[shot.id](ctxFor(shot.id, local, t));
  // base plate: the drift below would otherwise expose transparent frame edges
  const base = shot.id === 'coldopen' ? '#1E130F' : '#FBF5E9';
  const layers = [`<rect x="-60" y="-60" width="${W + 120}" height="${H + 120}" fill="${base}"/>`];
  // slow handheld drift keeps static frames alive
  const dx = Math.sin(t * 0.31) * 4 + Math.sin(t * 0.173) * 2.4;
  const dy = Math.cos(t * 0.23) * 3 + Math.sin(t * 0.11) * 1.8;
  layers.push(g(incoming, { opacity: 1, transform: `translate(${n(dx)} ${n(dy)})` }));
  if (i > 0 && local < TRANSITION) {
    const prev = SHOTS[i - 1];
    const pLocal = prev.end - prev.start - 1e-4;
    const outgoing = SCENE_FN[prev.id](ctxFor(prev.id, pLocal, prev.end));
    const pe = ease.inOutQuad(clamp(local / TRANSITION, 0, 1));
    layers.push(
      g(outgoing, {
        opacity: 1 - pe,
        transform: `translate(${W / 2} ${H / 2}) scale(${n(1 + 0.05 * pe)}) translate(${-W / 2} ${-H / 2})`,
      })
    );
  }
  layers.push(vignette(0.24));
  layers.push(grainOverlay(0.05));
  return svgDoc(layers.join(''), {});
}

async function run() {
  const args = process.argv.slice(2);
  const get = (k, def) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : def;
  };
  const flag = (k) => args.includes(k);
  const scale = parseFloat(get('--scale', '1.5'));
  const fps = parseInt(get('--fps', String(FPS)), 10);
  const from = parseFloat(get('--from', '0'));
  const to = parseFloat(get('--to', String(TOTAL)));
  const out = get('--out', join(OUT, 'wordsaffron-launch.mp4'));

  if (flag('--still')) {
    const t = parseFloat(get('--still', '1.0'));
    const svg = frameSvg(t);
    const img = renderSvg(svg, scale);
    writeFileSync(get('--png', join(OUT, `still-${t.toFixed(2)}.png`)), img.asPng());
    console.log('wrote still at', t);
    saveMetrics();
    return;
  }
  if (flag('--sheet')) {
    buildSheet(scale);
    saveMetrics();
    return;
  }
  if (flag('--svg')) {
    writeFileSync(get('--svg', join(OUT, 'frame.svg')), frameSvg(parseFloat(get('--t', '1'))));
    console.log('wrote svg');
    return;
  }

  const workers = Math.max(1, parseInt(get('--workers', '1'), 10));
  const silent = flag('--silent');
  const frames = Math.round((to - from) * fps);
  if (workers > 1 && !silent) {
    return renderParallel({ from, to, fps, scale, frames, out, workers });
  }
  const vw = Math.round(W * scale);
  const vh = Math.round(H * scale);
  console.log(`rendering ${frames} frames  ${vw}x${vh}  → ${W}x${H} @ ${fps}fps`);

  const ff = ffmpegPath();
  const filter = scale === 1
    ? 'format=yuv420p'
    : `scale=${W}:${H}:flags=lanczos,format=yuv420p`;

  const videoOut = silent ? out : join(OUT, 'video-silent.mp4');
  const p = spawn(ff, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${vw}x${vh}`, '-r', String(fps), '-i', 'pipe:0',
    '-an', '-vf', filter,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
    '-g', String(fps * 2), '-keyint_min', String(fps * 2), '-sc_threshold', '0',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    videoOut,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const t = from + f / fps;
    const svg = frameSvg(t);
    const img = renderSvg(svg, scale);
    if (!p.stdin.write(Buffer.from(img.pixels))) {
      // backpressure: wait for drain
      await new Promise((res) => p.stdin.once('drain', res));
    }
    if (f % 30 === 0) {
      const el = (Date.now() - t0) / 1000;
      const rate = f / el;
      process.stdout.write(`\r  frame ${f}/${frames}  ${(f / frames * 100).toFixed(0)}%  ${rate.toFixed(1)} fps  eta ${((frames - f) / Math.max(rate, 0.01)).toFixed(0)}s   `);
    }
  }
  p.stdin.end();
  await new Promise((res, done) => p.on('close', res));
  saveMetrics();

  const audioFile = join(OUT, 'audio.wav');
  const hasAudio = existsSync(audioFile) && !silent;
  const cmd = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', join(OUT, 'video-silent.mp4'),
    ...(hasAudio ? ['-i', audioFile] : []),
    '-c:v', 'copy',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-movflags', '+faststart', out,
  ];
  execSync(ff, cmd);
  console.log(`\nwrote ${out}`);
}

async function renderParallel({ from, to, fps, scale, frames, out, workers }) {
  const self = fileURLToPath(import.meta.url);
  const chunk = Math.max(30, Math.ceil(frames / workers / 30) * 30);
  const jobs = [];
  let f0 = 0;
  while (f0 < frames) {
    const n = Math.min(chunk, frames - f0);
    const t0 = from + f0 / fps;
    const t1 = from + (f0 + n) / fps;
    jobs.push({ idx: jobs.length, t0, t1, seg: join(OUT, `seg-${jobs.length}.mp4`) });
    f0 += n;
  }
  console.log(`rendering ${frames} frames across ${jobs.length} workers (parallel)`);
  await Promise.all(jobs.map((job) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      self, '--from', String(job.t0), '--to', String(job.t1),
      '--scale', String(scale), '--fps', String(fps), '--out', job.seg, '--silent',
    ], { stdio: ['ignore', 'pipe', 'inherit'] });
    let last = '';
    child.stdout.on('data', (d) => {
      const str = d.toString();
      const m = str.match(/frame (\d+)\/(\d+)\s+(\d+)%/g);
      if (m) last = m[m.length - 1];
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${job.idx} exit ${code}`))));
    const iv = setInterval(() => {
      process.stdout.write(`\r  w${job.idx} ${last.padEnd(28)}`);
    }, 1000);
    child.on('close', () => clearInterval(iv));
  })));
  console.log('\nconcatenating segments…');
  const list = join(OUT, 'segs.txt');
  writeFileSync(list, jobs.map((j) => `file '${j.seg}'`).join('\n'));
  execFileSync(ffmpegPath(), [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0',
    '-i', list, '-c', 'copy', join(OUT, 'video-silent.mp4'),
  ], { stdio: 'inherit' });
  const audioFile = join(OUT, 'audio.wav');
  const hasAudio = existsSync(audioFile);
  execFileSync(ffmpegPath(), [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', join(OUT, 'video-silent.mp4'),
    ...(hasAudio ? ['-i', audioFile] : []),
    '-c:v', 'copy', ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-movflags', '+faststart', out,
  ], { stdio: 'inherit' });
  console.log(`wrote ${out}`);
}

function execSync(bin, cmd) {
  execFileSync(bin, cmd, { stdio: 'inherit' });
}

function buildSheet(scale) {
  const times = [1.6, 3.9, 6.6, 9.2, 12.6, 16.2, 18.4, 23.0, 27.2, 31.4, 33.5, 34.8];
  const cols = 4;
  const rows = Math.ceil(times.length / cols);
  const tw = Math.round(480 * scale / scale);
  const cells = times.map((t, i) => {
    const img = renderSvg(frameSvg(t), 0.25);
    const png = img.asPng().toString('base64');
    const x = (i % cols) * tw;
    const y = Math.floor(i / cols) * Math.round(tw * H / W);
    return `<image x="${x}" y="${y}" width="${tw}" height="${Math.round(tw * H / W)}" xlink:href="data:image/png;base64,${png}"/>` +
      `<text x="${x + 10}" y="${y + 26}" font-family="monospace" font-size="16" fill="#00ff88" opacity="0.9">${t.toFixed(2)}s</text>`;
  }).join('');
  const sheet =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${tw * cols}" height="${Math.round(tw * H / W) * rows}">` +
    `<rect width="100%" height="100%" fill="#111"/>${cells}</svg>`;
  const png = renderSvg(sheet, 1).asPng();
  writeFileSync(join(OUT, 'contact-sheet.png'), png);
  console.log('wrote out/contact-sheet.png', times.length, 'frames');
}

const isMain = process.argv[1] && process.argv[1].endsWith('render.js');
if (isMain) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
