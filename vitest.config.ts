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
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
  },
});
