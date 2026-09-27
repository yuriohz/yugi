#!/usr/bin/env node
/**
 * Deterministic runtime build for the WordSaffron Chrome extension.
 *
 * Produces `dist/` containing runtime files only. No sources maps, no tests,
 * no dev dependencies, no remotely hosted code.
 */
import { build } from 'esbuild';
import { cp, mkdir, rm, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

/** Entry points bundled from ESM sources into classic/module browser scripts. */
const ENTRIES = [
  { in: 'background/service-worker.js', out: 'background.js', format: 'esm' },
  { in: 'content/content.js', out: 'content.js', format: 'iife' },
  { in: 'ui/popup.js', out: 'popup.js', format: 'iife' },
  { in: 'ui/options.js', out: 'options.js', format: 'iife' },
  { in: 'ui/onboarding.js', out: 'onboarding.js', format: 'iife' }
];

/** Static assets copied verbatim. */
const STATIC_FILES = [
  ['manifest.json', 'manifest.json'],
  ['content/content.css', 'content.css'],
  ['ui/popup.html', 'popup.html'],
  ['ui/popup.css', 'popup.css'],
  ['ui/options.html', 'options.html'],
  ['ui/options.css', 'options.css'],
  ['ui/onboarding.html', 'onboarding.html'],
  ['ui/onboarding.css', 'onboarding.css']
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

export async function runBuild({ silent = false } = {}) {
  const log = silent ? () => {} : (...a) => console.log(...a);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const entry of ENTRIES) {
    const entryPath = path.join(SRC, entry.in);
    if (!existsSync(entryPath)) {
      throw new Error(`Build entry missing: ${entry.in}`);
    }
    await build({
      entryPoints: [entryPath],
      outfile: path.join(DIST, entry.out),
      bundle: true,
      format: entry.format,
      target: ['chrome114'],
      platform: 'browser',
      sourcemap: false,
      minify: false,
      legalComments: 'none',
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' }
    });
    log(`  bundled ${entry.in} -> dist/${entry.out}`);
  }

  for (const [from, to] of STATIC_FILES) {
    const src = path.join(SRC, from);
    if (!existsSync(src)) throw new Error(`Static asset missing: ${from}`);
    await cp(src, path.join(DIST, to));
    log(`  copied  ${from} -> dist/${to}`);
  }

  await cp(path.join(ROOT, 'icons'), path.join(DIST, 'icons'), { recursive: true });
  log('  copied  icons/');

  // Validate the built manifest against what actually exists on disk.
  const manifest = JSON.parse(await readFile(path.join(DIST, 'manifest.json'), 'utf8'));
  const referenced = new Set();
  const collect = value => {
    if (typeof value === 'string' && /\.(js|css|html|png)$/.test(value)) referenced.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(manifest);
  const missing = [...referenced].filter(f => !existsSync(path.join(DIST, f)));
  if (missing.length) throw new Error(`manifest references missing files: ${missing.join(', ')}`);

  // Refuse to ship anything that loads remote executable code.
  const shipped = await walk(DIST);
  for (const file of shipped) {
    if (!/\.(js|html)$/.test(file)) continue;
    const text = await readFile(file, 'utf8');
    const remote = text.match(/<script[^>]+src=["']https?:\/\//i)
      || text.match(/import\s*\(\s*["']https?:\/\//)
      || text.match(/importScripts\s*\(\s*["']https?:\/\//);
    if (remote) throw new Error(`remotely hosted code referenced in ${path.relative(ROOT, file)}`);
  }

  let bytes = 0;
  for (const f of shipped) bytes += (await stat(f)).size;
  const summary = { files: shipped.length, bytes, version: manifest.version };
  await writeFile(path.join(DIST, '.build-info.json'), JSON.stringify(summary, null, 2) + '\n');
  log(`  built ${summary.files} files, ${(bytes / 1024).toFixed(1)} kB, version ${summary.version}`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBuild().catch(err => {
    console.error(`build failed: ${err.message}`);
    process.exit(1);
  });
}
