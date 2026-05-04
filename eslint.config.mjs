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
          type: 'app',
          pattern: 'src/app/*',
          mode: 'folder',
          capture: ['feature'],
        },
        {
          type: 'contexts',
          pattern: 'src/contexts/*',
          mode: 'folder',
        },
        {
          type: 'framework',
          pattern: 'src/framework/*',
          mode: 'folder',
        },
        {
          type: 'pages',
          pattern: 'pages/*',
          mode: 'folder',
        },
      ],
    },
    rules: {
      // ── Module boundaries ────────────────────────────────────────────
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: { type: 'app' },
              allow: [
                { to: { type: 'app' } },
                { to: { type: 'contexts' } },
                { to: { type: 'framework' } },
              ],
            },
            {
              from: { type: 'contexts' },
              allow: [
                { to: { type: 'contexts' } },
                { to: { type: 'framework' } },
              ],
            },
            {
              from: { type: 'framework' },
              allow: [{ to: { type: 'framework' } }],
            },
            {
              from: { type: 'pages' },
              allow: [{ to: { type: 'app' } }],
            },
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
