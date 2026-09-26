#!/usr/bin/env node
/**
 * Dependency-free project lint.
 *
 * Checks syntax of every source file, JSON validity, manifest sanity, and a small
 * set of project-specific rules that the product contract depends on.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'dist', '.venv', 'release', 'coverage']);

async function walk(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      await walk(path.join(dir, e.name), acc);
    } else acc.push(path.join(dir, e.name));
  }
  return acc;
}

const errors = [];
const files = await walk(ROOT);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (file.endsWith('.json')) {
    try { JSON.parse(await readFile(file, 'utf8')); }
    catch (e) { errors.push(`${rel}: invalid JSON — ${e.message}`); }
  }
  if (file.endsWith('.js')) {
    const src = await readFile(file, 'utf8');
    try {
      transformSync(src, { loader: 'js', format: 'esm', sourcefile: file });
    } catch (e) {
      errors.push(`${rel}: syntax error — ${e.message}`);
    }
  }
}

// ---- Project rules -------------------------------------------------------

const manifest = JSON.parse(await readFile(path.join(ROOT, 'src/manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) errors.push('manifest: must be Manifest V3');
if (!manifest.version) errors.push('manifest: missing version');
if (manifest.content_security_policy?.extension_pages?.includes('unsafe-eval')) {
  errors.push('manifest: unsafe-eval is not permitted');
}

const srcFiles = files.filter(f => f.includes(`${path.sep}src${path.sep}`) && f.endsWith('.js'));
for (const file of srcFiles) {
  const rel = path.relative(ROOT, file);
  const text = await readFile(file, 'utf8');
  if (/\binnerHTML\s*=\s*[^;]*\$\{(?!\s*(?:esc|escapeHtml|safe))/.test(text)) {
    errors.push(`${rel}: innerHTML interpolation must go through escapeHtml()`);
  }
  if (/console\.log\(/.test(text) && !rel.includes('tools')) {
    errors.push(`${rel}: console.log is not allowed in shipped code`);
  }
  if (/\beval\s*\(/.test(text)) errors.push(`${rel}: eval() is not allowed`);
}

// The fidelity contract must never make absolute claims.
const BANNED_CLAIMS = [
  /\bundetectable\b/i,
  /guaranteed\s+human/i,
  /guaranteed\s+correct/i,
  /100%\s+accurate/i,
  /bypass(?:es)?\s+AI\s+detect/i
];
// Files whose job is to enumerate or forbid the phrases are exempt.
const CLAIM_EXEMPT = /EXECUTION_PLAN\.md|IMPLEMENTATION_STATUS\.md|PRODUCT_PLAN_V2\.md|NAMING_RESEARCH\.md|tools[\\/]lint\.js|src[\\/]core[\\/]constants\.js|tests[\\/]/;
// A line that forbids the phrase is fine; a line that promises it is not.
const NEGATION = /\bnever\b|\bnot\b|\bno\b|\bcannot\b|\bcan't\b|\bavoid\b|\bprohibit|\bforbid|\bbanned\b|\bdon'?t\b|\bdoes not\b|\brefus|\bwithout\b|“|"|«/i;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (!/\.(js|html|md)$/.test(file)) continue;
  if (CLAIM_EXEMPT.test(rel)) continue;
  const text = await readFile(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const re of BANNED_CLAIMS) {
      const m = line.match(re);
      if (m && !NEGATION.test(line)) {
        errors.push(`${rel}:${i + 1}: prohibited assurance claim "${m[0]}"`);
      }
    }
  });
}

if (errors.length) {
  for (const e of errors) console.error(`  ${e}`);
  console.error(`lint failed: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`lint clean (${files.length} files)`);
