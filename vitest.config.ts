import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/': `${path.resolve(__dirname)}/`,
      // `server-only` is a Next.js sentinel that throws if imported on the
      // client. Tests run in a node-ish env, so stub it out.
      'server-only': path.resolve(__dirname, 'src/test/server-only.stub.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      // Root-level pattern covers proxy.test.ts: Next.js requires proxy.ts
      // itself to live at the repo root (framework convention, not a choice
      // - see AGENTS.md's boundaries/ignore list), so its test is co-located
      // there too rather than invented a home under src/ or app/.
      '*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'app/**/*.test.{ts,tsx}',
      'scripts/**/*.test.mjs',
    ],
  },
});
