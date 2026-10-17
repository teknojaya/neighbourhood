import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env automatically. Load apps/api/.env when present
// (local dev); in CI/Cloud Run DATABASE_URL comes from the environment.
try {
  process.loadEnvFile('.env');
} catch {
  // no local .env — rely on the process environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
