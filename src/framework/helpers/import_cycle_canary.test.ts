// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint, type Linter } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Regression canary for PACT-715: import-x/no-cycle silently skipped every
// .ts/.tsx file because eslint-plugin-import-x reads its own
// `import-x/parsers` settings key, not the legacy `import/parsers` key that
// eslint-config-next populates. A seeded mutual-import cycle produced zero
// detections until PACT-715 added the `import-x/parsers` bridge in
// eslint.config.mjs. Nothing else in CI would notice a regression - a
// plugin update changing how parser settings are read, or a config refactor
// dropping the bridge, would leave lint green while cycle detection quietly
// stopped covering TypeScript. This test lints a deliberate mutual-import
// fixture through the REAL project ESLint config (not a hand-built one) and
// fails loudly if the bridge ever goes inert.
//
// The fixtures live in a scratch directory created under the repo root
// (never committed - see .gitignore's deny-by-default allowlist, and it is
// removed in afterAll regardless). A repo-root location - rather than the
// OS temp directory - matters here: ESLint's flat config matches `files`
// globs against paths relative to the config's own directory, and a fixture
// living outside that tree risks being silently unmatched instead of linted.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

const filterNoCycleMessages = (messages: Linter.LintMessage[]) =>
  messages.filter((message) => message.ruleId === 'import-x/no-cycle');

describe('ESLint import-x/no-cycle TypeScript bridge', () => {
  let scratchDir: string;
  let cycleMessages: Linter.LintMessage[];
  let brokenCycleMessages: Linter.LintMessage[];

  beforeAll(async () => {
    scratchDir = fs.mkdtempSync(
      path.join(REPO_ROOT, 'import-cycle-canary-tmp-')
    );

    const cycleDir = path.join(scratchDir, 'cycle');
    const brokenDir = path.join(scratchDir, 'broken');
    fs.mkdirSync(cycleDir);
    fs.mkdirSync(brokenDir);

    // Deliberate mutual import cycle: a.ts imports b.ts, b.ts imports a.ts.
    fs.writeFileSync(
      path.join(cycleDir, 'a.ts'),
      "import { valueB } from './b';\n\nexport const valueA = 1 + valueB;\n"
    );
    fs.writeFileSync(
      path.join(cycleDir, 'b.ts'),
      "import { valueA } from './a';\n\nexport const valueB = 1 + valueA;\n"
    );

    // Same shape with the cycle broken - b.ts still depends on a.ts, but
    // a.ts no longer depends on b.ts. Proves the assertion below is not
    // vacuous: import-x/no-cycle only fires when there is an actual cycle.
    fs.writeFileSync(
      path.join(brokenDir, 'a.ts'),
      'export const valueA = 1;\n'
    );
    fs.writeFileSync(
      path.join(brokenDir, 'b.ts'),
      "import { valueA } from './a';\n\nexport const valueB = 1 + valueA;\n"
    );

    const eslint = new ESLint({
      cwd: REPO_ROOT,
      overrideConfigFile: path.join(REPO_ROOT, 'eslint.config.mjs'),
    });

    const [cycleResults, brokenResults] = await Promise.all([
      eslint.lintFiles([
        path.join(cycleDir, 'a.ts'),
        path.join(cycleDir, 'b.ts'),
      ]),
      eslint.lintFiles([
        path.join(brokenDir, 'a.ts'),
        path.join(brokenDir, 'b.ts'),
      ]),
    ]);

    cycleMessages = cycleResults.flatMap((result) => result.messages);
    brokenCycleMessages = brokenResults.flatMap((result) => result.messages);
    // Loading eslint-config-next + typescript-eslint + the typescript
    // resolver's tsconfig program is the dominant cost here, not the
    // two-file lint itself - hence the generous hook timeout below rather
    // than a per-test one. Measured ~9-10s in isolation, but the full
    // `pnpm test` run executes every test file's worker/thread concurrently,
    // and under that contention this hook has been observed to exceed 60s -
    // so the timeout carries large headroom over the isolated measurement,
    // not just over CI-vs-local variance.
  }, 120_000);

  afterAll(() => {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it('reports import-x/no-cycle on a deliberate mutual .ts import cycle', () => {
    expect(filterNoCycleMessages(cycleMessages).length).toBeGreaterThan(0);
  });

  it('reports nothing for the same fixture shape once the cycle is broken', () => {
    expect(filterNoCycleMessages(brokenCycleMessages)).toEqual([]);
  });
});
