import { defineConfig } from 'vitest/config';

// Integration tests against a real PostgreSQL (TEST_DATABASE_URL), run serially.
export default defineConfig({
  test: {
    include: ['src/**/*.db.test.ts'],
    globalSetup: ['src/test/db-global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
