import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const config = [
  {
    ignores: [
      '.next/',
      '.claude/',
      'node_modules/',
      '**/__codegen__/',
      'public/',
      'out/',
      'playwright-report/',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    plugins: {
      boundaries,
      'import-x': importX,
    },
    settings: {
      'import-x/internal-regex': '^@/',
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      'boundaries/elements': [
        {
          // Feature slices: src/app/{feature}/**. The capture lets the
          // dependency matrix below express "same feature only" generically.
          type: 'feature',
          pattern: 'src/app/*',
          mode: 'folder',
          capture: ['feature'],
        },
        {
          // The Next.js app router at the repo root (route segments, layouts,
          // route handlers). Distinct from the `feature` type above, which is
          // the unrelated `src/app/*` feature-slice tree.
          type: 'router',
          pattern: 'app/**',
          mode: 'full',
        },
        {
          // Shared UI kit + sidebar composition, including src/components/ui.
          type: 'components',
          pattern: 'src/components/**',
          mode: 'full',
        },
        {
          type: 'framework',
          pattern: 'src/framework/*',
          mode: 'folder',
        },
        {
          // Framework-agnostic leaf utilities (no feature/UI knowledge).
          type: 'lib',
          pattern: 'src/lib/**',
          mode: 'full',
        },
        {
          // Orval/buf-generated REST + proto + JSON-schema clients. Leaf:
          // nothing under __codegen__ imports anything else in the app.
          type: 'codegen',
          pattern: 'src/__codegen__/**',
          mode: 'full',
        },
        {
          // Central MSW wiring at the repo root (mocks/), aggregating each
          // feature's mock/ modules for dev:mock mode.
          type: 'mocks',
          pattern: 'mocks/**',
          mode: 'full',
        },
      ],
      'boundaries/ignore': [
        // Tests and unit-test support files cross layers freely (e.g. a
        // feature's test importing another feature's fixtures, or a
        // framework test exercising mocks/).
        '**/*.test.*',
        '**/*.spec.*',
        'src/test/**',
        // Root-level config and tooling files - not part of the app's
        // layer hierarchy.
        'eslint.config.mjs',
        'instrumentation.ts',
        'next-env.d.ts',
        'next.config.ts',
        'orval.config.ts',
        'playwright.config.ts',
        'playwright.e2e.config.ts',
        'postcss.config.mjs',
        'proxy.ts',
        'vitest.config.ts',
        'vitest.setup.ts',
        // Playwright E2E suite and its fixtures - runs standalone against
        // real services, outside the app's layer hierarchy.
        'e2e/**',
        'playwright/**',
        // Codegen and asset-download scripts - build tooling, not app code.
        'scripts/**',
      ],
    },
    rules: {
      // ── Module boundaries ────────────────────────────────────────────
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              // The Next.js router may render any feature and reach into the
              // shared layers, but features never import the router back.
              from: { type: 'router' },
              allow: [
                { to: { type: 'router' } },
                { to: { type: 'feature' } },
                { to: { type: 'components' } },
                { to: { type: 'framework' } },
                { to: { type: 'lib' } },
              ],
            },
            {
              from: { type: 'feature' },
              allow: [
                // Same feature only - the capture ties `to.feature` back to
                // the importing file's own feature name.
                {
                  to: {
                    type: 'feature',
                    captured: { feature: '{{from.feature}}' },
                  },
                },
                { to: { type: 'components' } },
                { to: { type: 'framework' } },
                { to: { type: 'lib' } },
                { to: { type: 'codegen' } },
                { to: { type: 'mocks' } },
              ],
            },
            // ── Grandfathered cross-feature imports (PACT-573) ──────────
            // These are the only 7 cross-feature import pairs that exist at
            // HEAD. New cross-feature imports beyond this closed list must
            // not be added here - extract shared code into a proper shared
            // layer instead, or route through an explicit public API.
            //
            // consensus/filter/dashboard -> audit: each imports something
            // from the audit slice unrelated to the decision vocabulary
            // (ConsensusRawPayloadToggle's prettyPayload, filter's
            // audit_decision_stats_access, dashboard's AuditRow /
            // AuditDecisionInsights components / audit_decision_stats_access).
            // classifier and redactor used to appear here too, for the
            // shared decision-vocabulary types and helpers (DecisionPayload,
            // parseDecisionPayload, etc.) that lived in the audit slice -
            // that vocabulary is promoted to src/lib/decisions (PACT-581),
            // which every feature may import unconditionally, so those two
            // pairs are gone from this closed list.
            {
              from: { type: 'feature', captured: { feature: 'consensus' } },
              allow: [
                { to: { type: 'feature', captured: { feature: 'audit' } } },
              ],
            },
            {
              from: { type: 'feature', captured: { feature: 'dashboard' } },
              allow: [
                { to: { type: 'feature', captured: { feature: 'audit' } } },
                {
                  to: { type: 'feature', captured: { feature: 'benchmark' } },
                },
                {
                  to: { type: 'feature', captured: { feature: 'test_lab' } },
                },
              ],
            },
            {
              from: { type: 'feature', captured: { feature: 'filter' } },
              allow: [
                { to: { type: 'feature', captured: { feature: 'audit' } } },
              ],
            },
            {
              from: { type: 'feature', captured: { feature: 'test_lab' } },
              allow: [
                { to: { type: 'feature', captured: { feature: 'gateway' } } },
                {
                  to: { type: 'feature', captured: { feature: 'redactor' } },
                },
              ],
            },
            {
              from: { type: 'components' },
              allow: [
                { to: { type: 'components' } },
                { to: { type: 'lib' } },
                { to: { type: 'framework' } },
                { to: { type: 'codegen' } },
              ],
            },
            {
              from: { type: 'framework' },
              allow: [
                { to: { type: 'framework' } },
                { to: { type: 'components' } },
                { to: { type: 'lib' } },
                { to: { type: 'codegen' } },
                // src/framework/msw/msw_provider.tsx dynamically imports the
                // central mocks/ entrypoint to bootstrap MSW in dev:mock mode
                // (isMock()-guarded, dynamic so mocks stay out of the prod
                // bundle). Not part of the PACT-573 spec's original matrix -
                // the spec assumed framework->mocks was test-only; this
                // static edge is the real, non-test import discovered while
                // wiring the matrix. See PR description for detail.
                { to: { type: 'mocks' } },
              ],
            },
            {
              from: { type: 'lib' },
              allow: [
                { to: { type: 'lib' } },
                // Generated types are leaves too, and src/lib/decisions
                // (PACT-581) needs the pact-decisions codegen schema to
                // define the shared DecisionPayload vocabulary.
                { to: { type: 'codegen' } },
              ],
            },
            {
              from: { type: 'mocks' },
              allow: [
                { to: { type: 'mocks' } },
                { to: { type: 'feature' } },
                { to: { type: 'codegen' } },
                { to: { type: 'framework' } },
              ],
            },
            // codegen is a leaf: no rule needed, default disallow applies.
          ],
        },
      ],

      // ── Imports ──────────────────────────────────────────────────────
      'import-x/no-extraneous-dependencies': 'error',
      'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
      'import-x/consistent-type-specifier-style': ['error', 'prefer-inline'],
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // ── TypeScript ───────────────────────────────────────────────────
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // ── React ────────────────────────────────────────────────────────
      'react/self-closing-comp': 'error',
      'react/jsx-key': 'error',
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],

      // ── General ──────────────────────────────────────────────────────
      'no-console': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },
  prettier,
  {
    // Headless-domain enforcement (PACT-572): domain/ holds pure logic, API
    // contracts, and hooks without JSX. Rendering never happens in domain/.
    files: ['src/app/*/domain/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'domain/ is headless: no .tsx files. Move rendering into ui/; domain/ files are always .ts (React hooks without JSX are fine).',
        },
      ],
    },
  },
  {
    files: ['src/app/*/domain/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXElement',
          message:
            'domain/ is headless: no JSX. Move rendering into ui/; domain/ may still hold React hooks that return plain values.',
        },
        {
          selector: 'JSXFragment',
          message:
            'domain/ is headless: no JSX fragments. Move rendering into ui/; domain/ may still hold React hooks that return plain values.',
        },
      ],
    },
  },
  {
    files: ['mocks/**/*', 'src/**/mock/**/*'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
      'no-underscore-dangle': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // The Playwright e2e suite runs in Node, talks to pact-auth + Postgres
    // directly, and is free to import devDependencies (pg, otpauth,
    // @playwright/test). Treat it like the mock layer above.
    files: ['e2e/**/*', 'playwright.e2e.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['eslint.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['scripts/**/*.mjs', 'orval.config.ts', 'next.config.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { ...globals.node },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      'no-console': 'off',
    },
  },
];

export default config;
