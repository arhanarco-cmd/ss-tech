import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'main/server/src'),
      '@client': path.resolve(__dirname, 'main/client/src'),
    },
  },
});
