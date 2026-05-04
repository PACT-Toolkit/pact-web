#!/usr/bin/env node

/**
 * REST API Codegen Script (Orval)
 *
 * Converts Swagger 2.0 specs to OpenAPI 3.x and generates SWR hooks using Orval.
 *
 * Usage: node scripts/rest-codegen.mjs
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { readdir, mkdir, rm, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { splitHooksFile } from './orval-post-processing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'schema');
const OUTPUT_DIR = join(ROOT, 'src/__codegen__/rest');
const TEMP_DIR = join(ROOT, '.rest-codegen-temp');

const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: ROOT });

/**
 * Clean and recreate a directory
 */
const cleanDir = async (dir) => {
  if (existsSync(dir)) await rm(dir, { recursive: true });
  await mkdir(dir, { recursive: true });
};

/**
 * Convert Swagger 2.0 to OpenAPI 3.x for a service
 */
const convertToOpenApi = (serviceName) => {
  const swaggerPath = join(SCHEMA_DIR, serviceName, 'swagger.yaml');
  const openApiPath = join(TEMP_DIR, `${serviceName}.openapi.yaml`);

  run(
    `pnpm exec swagger2openapi "${swaggerPath}" -o "${openApiPath}" --yaml --patch`,
  );

  return openApiPath;
};

/**
 * Resolve sub-property $ref values that orval cannot handle.
 *
 * Swagger specs sometimes use $ref pointers into nested properties, e.g.
 * `$ref: "#/components/schemas/Application/properties/nickname"`.
 * swagger2openapi preserves these, but orval generates imports for type files
 * that don't exist (e.g. `./nickname`). This function inlines those references
 * by looking up the target property schema and replacing the $ref.
 */
const normalizeSubPropertyRefs = async (openApiPath) => {
  const content = await readFile(openApiPath, 'utf-8');

  const subPropRefPattern =
    /\$ref:\s*["']#\/components\/schemas\/([^/]+)\/properties\/([^"'\s]+)["']/g;

  if (!subPropRefPattern.test(content)) return;

  const lines = content.split('\n');
  const resolvedLines = lines.map((line) => {
    const match = line.match(
      /^(\s*)\$ref:\s*["']#\/components\/schemas\/([^/]+)\/properties\/([^"'\s]+)["']\s*$/,
    );
    if (!match) return line;

    const [, indent, schemaName, propName] = match;

    const propSchema = findPropertySchema(lines, schemaName, propName);
    if (!propSchema) return line;

    return propSchema.map((schemaLine) => `${indent}${schemaLine}`).join('\n');
  });

  await writeFile(openApiPath, resolvedLines.join('\n'));
};

/**
 * Find a property's schema definition within the YAML lines.
 */
const findPropertySchema = (lines, schemaName, propName) => {
  let inSchemas = false;
  let inTargetSchema = false;
  let inProperties = false;
  let inTargetProp = false;
  let schemaIndent = -1;
  let propsIndent = -1;
  let propIndent = -1;
  const result = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (trimmed === 'schemas:') {
      inSchemas = true;
      schemaIndent = indent;
      continue;
    }

    if (inSchemas && !inTargetSchema) {
      if (indent <= schemaIndent && trimmed.length > 0) {
        inSchemas = false;
        continue;
      }
      if (trimmed === `${schemaName}:`) {
        inTargetSchema = true;
        schemaIndent = indent;
        continue;
      }
    }

    if (inTargetSchema && !inProperties) {
      if (indent <= schemaIndent && trimmed.length > 0) break;
      if (trimmed === 'properties:') {
        inProperties = true;
        propsIndent = indent;
        continue;
      }
    }

    if (inProperties && !inTargetProp) {
      if (indent <= propsIndent && trimmed.length > 0) break;
      if (trimmed === `${propName}:`) {
        inTargetProp = true;
        propIndent = indent;
        continue;
      }
    }

    if (inTargetProp) {
      if (indent <= propIndent && trimmed.length > 0) break;
      result.push(line.slice(propIndent + 2));
    }
  }

  return result.length > 0 ? result : null;
};

/**
 * Generate Orval config dynamically for discovered services
 */
const generateOrvalConfig = async (services) => {
  const configs = services
    .map((name) => {
      const inputPath = `.rest-codegen-temp/${name}.openapi.yaml`;
      const outputDir = `src/__codegen__/rest/${name}`;

      return `  '${name}': {
    input: '${inputPath}',
    output: {
      mode: 'split',
      target: '${outputDir}/hooks.ts',
      schemas: '${outputDir}/types',
      client: 'swr',
      baseUrl: '/api/pact/${name}',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },`;
    })
    .join('\n');

  const configContent = `import { defineConfig } from 'orval';

export default defineConfig({
${configs}
});
`;

  await writeFile(join(ROOT, 'orval.config.ts'), configContent);
};

/**
 * Generate barrel index file for a service
 */
const generateIndexFile = async (serviceName) => {
  const dir = join(OUTPUT_DIR, serviceName);
  const indexContent = `/**
 * Auto-generated barrel file for ${serviceName}
 * Do not edit manually - run \`pnpm rest:codegen\` to regenerate
 */

export * from './fetchers';
export * from './hooks';
export * from './types';
`;

  await writeFile(join(dir, 'index.ts'), indexContent);
};

/**
 * Convert kebab-case to camelCase for namespace exports
 */
const toCamelCase = (str) =>
  str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

/**
 * Generate top-level index file
 */
const generateTopLevelIndex = async (services) => {
  const exports = services
    .map((s) => `export * as ${toCamelCase(s)} from './${s}';`)
    .join('\n');

  const content = `/**
 * Auto-generated barrel file for REST API
 * Do not edit manually - run \`pnpm rest:codegen\` to regenerate
 */

${exports}
`;

  await writeFile(join(OUTPUT_DIR, 'index.ts'), content);
};

async function main() {
  console.log('🚀 REST API Codegen (Orval)\n');

  await Promise.all([cleanDir(TEMP_DIR), cleanDir(OUTPUT_DIR)]);

  const entries = await readdir(SCHEMA_DIR, { withFileTypes: true });
  const services = entries
    .filter(
      (e) =>
        e.isDirectory() && existsSync(join(SCHEMA_DIR, e.name, 'swagger.yaml')),
    )
    .map((e) => e.name);

  if (services.length === 0) {
    console.log('No services found with swagger.yaml files.');
    return;
  }

  console.log(`📌 Found: ${services.join(', ')}\n`);

  console.log('📄 Converting Swagger to OpenAPI 3.x...');
  for (const name of services) {
    const openApiPath = convertToOpenApi(name);
    await normalizeSubPropertyRefs(openApiPath);
    console.log(`✅ ${name}`);
  }

  console.log('\n⚙️  Generating Orval config...');
  await generateOrvalConfig(services);

  console.log('\n🔧 Running Orval...');
  run('pnpm exec orval');

  console.log('\n🔀 Splitting hooks from fetchers...');
  await Promise.all(services.map((name) => splitHooksFile(name, OUTPUT_DIR)));

  console.log('\n📦 Generating index files...');
  await Promise.all(services.map(generateIndexFile));
  await generateTopLevelIndex(services);

  if (existsSync(TEMP_DIR)) await rm(TEMP_DIR, { recursive: true });

  console.log('\n💅 Formatting...');
  try {
    run(`pnpm exec prettier --write "${OUTPUT_DIR}/**/*.ts"`);
  } catch {
    // Optional
  }

  console.log('\n✨ Complete!\n');
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
