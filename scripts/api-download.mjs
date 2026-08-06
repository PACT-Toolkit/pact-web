#!/usr/bin/env node

/**
 * Download swagger specs (and other vendored contract files) from GitHub for
 * each service in schema/.
 *
 * Each schema/{service}/services.config.json must exist with:
 *   { "repo": "pact-backend", "path": "/api/swagger.yaml", "production": false }
 *
 * A fetch failure for ANY configured service (regardless of the `production`
 * flag) fails the whole run: every failing service is reported by name with
 * its unreachable repo/path/branch, then the process exits non-zero. There is
 * no "safe to skip" mode - a stale vendored spec that silently stops updating
 * is worse than a loud CI failure.
 *
 * production: true  - the service's generated client ships in production
 *                     builds. Still hard-fails on fetch errors, same as
 *                     production: false.
 * production: false - the service is excluded from production client builds
 *                     (early development or unstable schema), but a fetch
 *                     failure during `pnpm api:update` still hard-fails the
 *                     run. This flag no longer controls fetch-error severity;
 *                     see AGENTS.md for how the flag is meant to be consumed.
 * manual: true      - skip download entirely; the swagger.yaml is hand-maintained
 *                     in-repo rather than pulled from a producing service. No
 *                     service uses this today (benchmark moved to the gateway's
 *                     per-tag slice); kept for specs with no upstream source.
 * schemaFile: "name.json" - the downloaded content is written to
 *                     schema/{service}/{schemaFile} instead of the default
 *                     swagger.yaml. Used for vendored non-OpenAPI contracts
 *                     (e.g. schema/pact-decisions' JSON Schema file, consumed
 *                     by `pnpm schema:codegen` rather than orval) so they
 *                     stay outside rest-codegen.mjs's swagger.yaml scan.
 * files: [{ "path": ..., "schemaFile": ... }, ...] - for a service that
 *                     vendors more than one file from the same repo (e.g.
 *                     schema/pact-decisions also pulls decisions/benign_labels.json
 *                     alongside the JSON Schema). Takes precedence over the
 *                     single path/schemaFile pair above when present; repo,
 *                     branch and production still apply to every file.
 *
 * Requires GITHUB_TOKEN (or GIT_TOKEN) in env with read access to the PACT-Toolkit org.
 */

import { existsSync } from 'fs';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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

const downloadFile = async (service, repo, path, branch) => {
  const url = `${GITHUB_API}/repos/${GITHUB_ORG}/${repo}/contents${path}?ref=${branch}`;
  const res = await fetch(url, { headers: getAuthHeaders() });

  if (!res.ok) {
    throw new Error(
      `GitHub API ${res.status} for ${GITHUB_ORG}/${repo}${path} (branch: ${branch}): ${await res.text()}`
    );
  }

  const json = await res.json();

  if (json.encoding !== 'base64') {
    throw new Error(`Unexpected encoding '${json.encoding}' for ${service}`);
  }

  return Buffer.from(json.content, 'base64').toString('utf-8');
};

// A config's `files` array takes precedence; otherwise fall back to the
// single legacy path/schemaFile pair (defaulting schemaFile to swagger.yaml).
const targetsFor = (config) =>
  config.files ?? [{ path: config.path, schemaFile: config.schemaFile }];

/**
 * Reduce the settled download results down to the services that failed,
 * each carrying enough detail (service, repo, path, branch, message) to name
 * the failure precisely. Pure and side-effect free so it can be unit tested
 * without touching the network or the filesystem.
 */
export function summarizeFailures(configs, results) {
  const failures = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (result.status !== 'rejected') {
      continue;
    }

    const { service, config } = configs[i];

    failures.push({
      service,
      repo: config.repo,
      path: config.path,
      branch: config.branch ?? 'main',
      message: result.reason?.message ?? String(result.reason),
    });
  }

  return failures;
}

export async function main({ schemaDir = SCHEMA_DIR } = {}) {
  console.log('📥 Downloading API schemas\n');

  if (!existsSync(schemaDir)) {
    console.log(
      'No schema/ directory found. Create schema/{service}/services.config.json to add a service.'
    );

    return;
  }

  const entries = await readdir(schemaDir, { withFileTypes: true });
  const services = entries
    .filter(
      (e) =>
        e.isDirectory() &&
        existsSync(join(schemaDir, e.name, 'services.config.json'))
    )
    .map((e) => e.name);

  if (services.length === 0) {
    console.log(
      'No services found. Create schema/{service}/services.config.json to add a service.'
    );

    return;
  }

  const allConfigs = await Promise.all(
    services.map(async (service) => {
      const configPath = join(schemaDir, service, 'services.config.json');
      const config = JSON.parse(await readFile(configPath, 'utf-8'));

      return { service, config };
    })
  );

  for (const { service } of allConfigs.filter((c) => c.config.manual)) {
    console.log(`  ⏭️  ${service} (manual) — hand-maintained, not downloaded`);
  }

  const configs = allConfigs.filter(({ config }) => !config.manual);

  const results = await Promise.allSettled(
    configs.map(async ({ service, config }) => {
      const { repo, branch = 'main' } = config;

      await mkdir(join(schemaDir, service), { recursive: true });

      for (const { path, schemaFile } of targetsFor(config)) {
        const spec = await downloadFile(service, repo, path, branch);
        const filename = schemaFile ?? 'swagger.yaml';

        await writeFile(join(schemaDir, service, filename), spec);
      }

      console.log(`  ✅ ${service}`);
    })
  );

  const failures = summarizeFailures(configs, results);

  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} service(s) failed to download:\n`);

    for (const failure of failures) {
      console.error(
        `  - ${failure.service}: ${GITHUB_ORG}/${failure.repo}${failure.path ?? ''} (branch: ${failure.branch}) - ${failure.message}`
      );
    }

    process.exit(1);
  }

  console.log('\n✨ Done\n');
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  });
}
