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
  feature: {
    input: '.rest-codegen-temp/feature.openapi.yaml',
    output: {
      mode: 'split',
      target: 'src/__codegen__/rest/feature/hooks.ts',
      schemas: 'src/__codegen__/rest/feature/types',
      client: 'swr',
      baseUrl: '/api/pact/feature',
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
