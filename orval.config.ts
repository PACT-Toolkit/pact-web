import { defineConfig } from 'orval';

export default defineConfig({
  account: {
    input: '.rest-codegen-temp/account.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/account/hooks.ts',
      schemas: 'src/__codegen__/rest/account/types',
      client: 'swr',
      baseUrl: '/v1/account',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  audit: {
    input: '.rest-codegen-temp/audit.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/audit/hooks.ts',
      schemas: 'src/__codegen__/rest/audit/types',
      client: 'swr',
      baseUrl: '/v1/audit',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  benchmark: {
    input: '.rest-codegen-temp/benchmark.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/benchmark/hooks.ts',
      schemas: 'src/__codegen__/rest/benchmark/types',
      client: 'swr',
      baseUrl: '/api/pact/benchmark/v1',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  check: {
    input: '.rest-codegen-temp/check.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/check/hooks.ts',
      schemas: 'src/__codegen__/rest/check/types',
      client: 'swr',
      baseUrl: '/api/pact/gateway/v1',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  classifier: {
    input: '.rest-codegen-temp/classifier.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/classifier/hooks.ts',
      schemas: 'src/__codegen__/rest/classifier/types',
      client: 'swr',
      baseUrl: '/api/pact/gateway/v1',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  files: {
    input: '.rest-codegen-temp/files.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/files/hooks.ts',
      schemas: 'src/__codegen__/rest/files/types',
      client: 'swr',
      baseUrl: '/v1/files',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  policy: {
    input: '.rest-codegen-temp/policy.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/policy/hooks.ts',
      schemas: 'src/__codegen__/rest/policy/types',
      client: 'swr',
      baseUrl: '/api/pact/gateway/v1',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  rules: {
    input: '.rest-codegen-temp/rules.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/rules/hooks.ts',
      schemas: 'src/__codegen__/rest/rules/types',
      client: 'swr',
      baseUrl: '/api/pact/gateway/v1',
      override: {
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
});
