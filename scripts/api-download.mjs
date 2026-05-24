#!/usr/bin/env node

/**
 * Download swagger specs from GitHub for each service in schema/.
 *
 * Each schema/{service}/services.config.json must exist with:
 *   { "repo": "pact-backend", "path": "/api/swagger.yaml", "production": false }
 *
 * production: true  — download failure exits non-zero (breaks CI).
 * production: false — download failure prints a warning and continues (safe during early dev).
 *
 * Requires GITHUB_TOKEN (or GIT_TOKEN) in env with read access to the PACT-Toolkit org.
 */

import { existsSync } from 'fs';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'schema');
const GITHUB_ORG = 'PACT-Toolkit';
const GITHUB_API = 'https://api.github.com';

const getAuthHeaders = () => {
  const token = process.env.GITHUB_TOKEN ?? process.env.GIT_TOKEN;

  if (!token) {
    console.error(
      '❌  GITHUB_TOKEN (or GIT_TOKEN) is required to download schemas.'
    );
    process.exit(1);
  }

  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'pact-web-codegen',
  };
};

const downloadSpec = async (service, config) => {
  const { repo, path, branch = 'main' } = config;
  const url = `${GITHUB_API}/repos/${GITHUB_ORG}/${repo}/contents${path}?ref=${branch}`;
  const res = await fetch(url, { headers: getAuthHeaders() });

  if (!res.ok) {
    throw new Error(
      `GitHub API ${res.status} for ${GITHUB_ORG}/${repo}${path}: ${await res.text()}`
    );
  }

  const json = await res.json();

  if (json.encoding !== 'base64') {
    throw new Error(`Unexpected encoding '${json.encoding}' for ${service}`);
  }

  return Buffer.from(json.content, 'base64').toString('utf-8');
};

async function main() {
  console.log('📥 Downloading API schemas\n');

  if (!existsSync(SCHEMA_DIR)) {
    console.log(
      'No schema/ directory found. Create schema/{service}/services.config.json to add a service.'
    );

    return;
  }

  const entries = await readdir(SCHEMA_DIR, { withFileTypes: true });
  const services = entries
    .filter(
      (e) =>
        e.isDirectory() &&
        existsSync(join(SCHEMA_DIR, e.name, 'services.config.json'))
    )
    .map((e) => e.name);

  if (services.length === 0) {
    console.log(
      'No services found. Create schema/{service}/services.config.json to add a service.'
    );

    return;
  }

  const configs = await Promise.all(
    services.map(async (service) => {
      const configPath = join(SCHEMA_DIR, service, 'services.config.json');
      const config = JSON.parse(await readFile(configPath, 'utf-8'));

      return { service, config };
    })
  );

  const results = await Promise.allSettled(
    configs.map(async ({ service, config }) => {
      const spec = await downloadSpec(service, config);

      await mkdir(join(SCHEMA_DIR, service), { recursive: true });
      await writeFile(join(SCHEMA_DIR, service, 'swagger.yaml'), spec);
      console.log(`  ✅ ${service}`);

      return { service, production: config.production ?? false };
    })
  );

  let hasProductionFailure = false;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (result.status === 'rejected') {
      const { service, config } = configs[i];
      const isProduction = config.production ?? false;

      if (isProduction) {
        console.error(`  ❌ ${service} (production): ${result.reason.message}`);
        hasProductionFailure = true;
      } else {
        console.warn(`  ⚠️  ${service} (pre-production): ${result.reason.message} — skipped`);
      }
    }
  }

  if (hasProductionFailure) {
    process.exit(1);
  }

  console.log('\n✨ Done\n');
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
