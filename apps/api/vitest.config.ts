import { defineConfig } from 'vitest/config';

// Unit + HTTP tests with in-memory fakes. PostgreSQL tests: vitest.db.config.ts.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], exclude: ['src/**/*.db.test.ts', 'node_modules/**'] },
});
