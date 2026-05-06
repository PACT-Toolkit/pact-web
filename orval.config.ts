import { defineConfig } from 'orval';

export default defineConfig({
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
