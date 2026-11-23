#!/usr/bin/env node
/**
 * Enforces the project's hard rule: no generative-AI / LLM dependencies or
 * API calls in the game runtime. Fails CI if any are introduced.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED_PACKAGES = [
  /^openai$/, /^@anthropic-ai\//, /^@google\/generative-ai$/, /^@google\/genai$/, /^cohere/, /^@mistralai\//,
  /^ollama$/, /^langchain/, /^@langchain\//, /^llamaindex$/, /^ai$/, /^@ai-sdk\//, /^replicate$/,
  /^@huggingface\//, /^@xenova\/transformers$/, /^@mlc-ai\//, /^node-llama-cpp$/, /^groq-sdk$/,
];
const BANNED_SOURCE = [/api\.openai\.com/, /api\.anthropic\.com/, /generativelanguage\.googleapis\.com/, /api\.mistral\.ai/, /api\.cohere\.ai/];

const roots = ['package.json', 'packages', 'apps'];
const failures = [];

function walk(path) {
  const st = statSync(path);
  if (st.isDirectory()) {
    if (/node_modules|dist|\.git/.test(path)) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }
  if (path.endsWith('package.json')) {
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (BANNED_PACKAGES.some((re) => re.test(name))) failures.push(`${path}: banned dependency "${name}"`);
      }
    }
  } else if (/\.(ts|tsx|js|mjs)$/.test(path)) {
    const src = readFileSync(path, 'utf8');
    for (const re of BANNED_SOURCE) if (re.test(src)) failures.push(`${path}: references ${re}`);
  }
}

for (const r of roots) walk(r);
if (failures.length) {
  console.error('Runtime AI usage is prohibited in NEON WILDS:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('check-no-ai: OK');
