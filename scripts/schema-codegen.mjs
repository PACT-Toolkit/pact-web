#!/usr/bin/env node

/**
 * pact.decisions Schema Codegen (json-schema-to-typescript)
 *
 * Generates TypeScript types from the vendored pact.decisions JSON Schema
 * (schema/pact-decisions/pact.decisions.schema.json, mirrored from
 * pact-gateway's contracts/pact.decisions.schema.json via `pnpm api:update`).
 *
 * Usage: node scripts/schema-codegen.mjs
 */

import { execSync } from 'child_process';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { compile } from 'json-schema-to-typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = join(
  ROOT,
  'schema/pact-decisions/pact.decisions.schema.json'
);
const OUTPUT_DIR = join(ROOT, 'src/__codegen__/schema/pact-decisions');

const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: ROOT });

const bannerFor = (file) => `/**
 * Auto-generated from pact-gateway's contracts/pact.decisions.schema.json
 * (vendored at schema/pact-decisions/pact.decisions.schema.json).
 * Do not edit ${file} manually - run \`pnpm schema:codegen\` to regenerate.
 */
`;

async function main() {
  console.log('🚀 pact.decisions Schema Codegen (json-schema-to-typescript)\n');

  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf-8'));

  console.log('🔧 Compiling types...');
  // json-schema-to-typescript names the root interface from the schema's own
  // `title` ("pact.decisions") whenever one is present, ignoring the `name`
  // argument below -- it resolves to PactDecisions regardless of what's
  // passed here. The app-facing DecisionPayload alias lives one layer up, in
  // src/app/audit/domain/audit_decision_payload.ts.
  const body = await compile(schema, 'PactDecisions', {
    bannerComment: '',
    additionalProperties: false,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, 'decisions.ts'),
    bannerFor('this file') + '\n' + body
  );
  await writeFile(
    join(OUTPUT_DIR, 'index.ts'),
    bannerFor('this file') + `\nexport * from './decisions';\n`
  );

  console.log('\n💅 Formatting...');
  run(`pnpm exec prettier --write "${OUTPUT_DIR}/**/*.ts"`);

  console.log('\n✨ Complete!\n');
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
