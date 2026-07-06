#!/usr/bin/env node

/**
 * Proto Codegen Script (buf + protoc-gen-es)
 *
 * Generates TypeScript stubs from pact-auth's proto via `buf generate`,
 * then formats the output with the project's own prettier config.
 *
 * Usage: node scripts/proto-codegen.mjs
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'src/__codegen__/proto');

const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: ROOT });

console.log('🚀 Proto Codegen (buf)\n');

console.log('🔧 Running buf generate...');
run('pnpm exec buf generate');

// buf generate (via protoc-gen-es) emits double-quoted, differently-wrapped
// output, but the repo's prettier config uses `singleQuote: true`. Format
// with the project's own prettier so the committed files match what
// `pnpm prettier:check` expects, keeping the tree clean across repeated
// codegen runs.
console.log('\n💅 Formatting...');
run(`pnpm exec prettier --write "${OUTPUT_DIR}/**/*.ts"`);

console.log('\n✨ Complete!\n');
