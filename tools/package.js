#!/usr/bin/env node
/**
 * Build the Chrome Web Store upload package.
 *
 * The package contains the runtime and nothing else. Before the archive is
 * written, the contents are verified against an allow-list and re-scanned for
 * credentials, because a store upload is irreversible in the sense that it is
 * public the moment it is approved.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText } from './scan-secrets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE = path.join(ROOT, 'release');

/** Exactly what a Chrome extension runtime may contain. Anything else fails the build. */
const ALLOWED = [
  /^manifest\.json$/,
  /^background\.js$/,
  /^content\.js$/,
  /^content\.css$/,
  /^(popup|options|onboarding)\.(html|js|css)$/,
  /^icons\/icon(16|32|48|128)\.png$/
];

/** Things that must never ship, even if something upstream produces them. */
const FORBIDDEN = [
  { re: /\.map$/, why: 'source map' },
  { re: /\.(test|spec)\.js$/, why: 'test file' },
  { re: /^tests?\//, why: 'test directory' },
  { re: /^node_modules\//, why: 'dependency directory' },
  { re: /\.(md|txt|log|zip|ts|tsx)$/, why: 'non-runtime file' },
  { re: /(^|\/)\./, why: 'dotfile' },
  { re: /\.(env|key|pem|p12)$/, why: 'credential file' }
];

/** Patterns that would mean remotely hosted executable code, which the store forbids. */
const REMOTE_CODE = [
  { re: /<script[^>]+src=["']https?:/i, why: 'remote <script src>' },
  { re: /import\s*\(\s*["']https?:/i, why: 'dynamic import from a URL' },
  { re: /importScripts\s*\(\s*["']https?:/i, why: 'importScripts from a URL' },
  { re: /\beval\s*\(/, why: 'eval()' },
  { re: /new\s+Function\s*\(/, why: 'new Function()' }
];

async function walk(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ is missing. Run npm run build first.');
    process.exit(1);
  }

  const files = await walk(DIST);
  const problems = [];

  // 1. Nothing unexpected, nothing forbidden.
  for (const file of files) {
    if (file === '.build-info.json') continue;
    for (const rule of FORBIDDEN) {
      if (rule.re.test(file)) problems.push(`${file}: ${rule.why} must not be packaged`);
    }
    if (!ALLOWED.some(re => re.test(file))) {
      problems.push(`${file}: not on the runtime allow-list`);
    }
  }

  // 2. Everything the manifest references must exist.
  const manifest = JSON.parse(await readFile(path.join(DIST, 'manifest.json'), 'utf8'));
  const referenced = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_page,
    ...(manifest.content_scripts || []).flatMap(cs => [...(cs.js || []), ...(cs.css || [])]),
    ...Object.values(manifest.icons || {})
  ].filter(Boolean);
  for (const ref of referenced) {
    if (!files.includes(ref)) problems.push(`manifest references ${ref}, which is not in the package`);
  }

  // 3. No remote code, no credentials, in any shipped file.
  let bytes = 0;
  for (const file of files) {
    const full = path.join(DIST, file);
    bytes += (await stat(full)).size;
    if (!/\.(js|html|css|json)$/.test(file)) continue;
    const text = await readFile(full, 'utf8');
    for (const rule of REMOTE_CODE) {
      if (rule.re.test(text)) problems.push(`${file}: contains ${rule.why}; the Chrome Web Store forbids remotely hosted code`);
    }
    for (const hit of scanText(text)) {
      problems.push(`${file}: possible ${hit.label} at offset ${hit.index}`);
    }
  }

  // 4. Permissions must be justified in writing.
  const rationale = path.join(ROOT, 'docs', 'PERMISSIONS.md');
  if (!existsSync(rationale)) {
    problems.push('docs/PERMISSIONS.md is missing; every permission must have a written rationale');
  } else {
    const text = await readFile(rationale, 'utf8');
    for (const permission of [...(manifest.permissions || []), ...(manifest.host_permissions || [])]) {
      if (!text.includes(permission)) problems.push(`docs/PERMISSIONS.md does not explain the "${permission}" permission`);
    }
  }

  if (problems.length) {
    console.error('\nPackage refused:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  // 5. Write the archive. .build-info.json is excluded: it is build metadata.
  await rm(RELEASE, { recursive: true, force: true });
  await mkdir(RELEASE, { recursive: true });
  const name = `${manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${manifest.version}.zip`;
  const archive = path.join(RELEASE, name);
  execFileSync('zip', ['-q', '-r', '-X', archive, '.', '-x', '.build-info.json'], { cwd: DIST });

  const buffer = await readFile(archive);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  await writeFile(`${archive}.sha256`, `${sha256}  ${name}\n`);

  const contents = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').sort();
  await writeFile(path.join(RELEASE, 'MANIFEST.txt'),
    `${name}\nsha256  ${sha256}\nbuilt   ${new Date().toISOString()}\nversion ${manifest.version}\nfiles   ${contents.length}\n\n${contents.join('\n')}\n`);

  console.log(`  packaged ${contents.length} files, ${(buffer.length / 1024).toFixed(1)} kB (${(bytes / 1024).toFixed(1)} kB unpacked)`);
  console.log(`  ${path.relative(ROOT, archive)}`);
  console.log(`  sha256 ${sha256}`);
}

main().catch(error => { console.error(error); process.exit(1); });
