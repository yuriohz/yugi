#!/usr/bin/env node
/** Refuses to let credentials or private text enter the repository or the package. */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.venv', 'release', 'coverage']);
const BINARY = /\.(png|jpg|jpeg|gif|webp|zip|ico|woff2?|ttf|pdf)$/i;

export const SECRET_PATTERNS = [
  { id: 'openrouter-key', re: /sk-or-v1-[A-Za-z0-9_-]{16,}/, label: 'OpenRouter API key' },
  { id: 'openai-key', re: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/, label: 'OpenAI-style API key' },
  { id: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{20,}/, label: 'Anthropic API key' },
  { id: 'google-key', re: /AIza[0-9A-Za-z_-]{35}/, label: 'Google API key' },
  { id: 'aws-key', re: /AKIA[0-9A-Z]{16}/, label: 'AWS access key id' },
  { id: 'github-token', re: /gh[pousr]_[A-Za-z0-9]{36,}/, label: 'GitHub token' },
  { id: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/, label: 'Slack token' },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, label: 'private key block' },
  { id: 'bearer-literal', re: /Bearer\s+sk-[A-Za-z0-9_-]{16,}/, label: 'hard-coded bearer credential' }
];

/** Allow the detector's own definitions and documentation of the patterns. */
const ALLOWLIST = [
  /tools[\\/]scan-secrets\.js$/,
  /tests[\\/]unit[\\/]scan-secrets\.test\.js$/
];

export function scanText(text) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const p of SECRET_PATTERNS) {
      if (p.re.test(line)) hits.push({ line: i + 1, id: p.id, label: p.label });
    }
  });
  return hits;
}

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), acc);
    } else {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

export async function scanTree(root = ROOT) {
  const findings = [];
  for (const file of await walk(root)) {
    const rel = path.relative(root, file);
    if (BINARY.test(file)) continue;
    if (ALLOWLIST.some(re => re.test(rel))) continue;
    if ((await stat(file)).size > 2_000_000) continue;
    for (const hit of scanText(await readFile(file, 'utf8'))) {
      findings.push({ file: rel, ...hit });
    }
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = await scanTree();
  if (findings.length) {
    for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.label} (${f.id})`);
    console.error(`secret scan failed: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log('secret scan clean');
}
