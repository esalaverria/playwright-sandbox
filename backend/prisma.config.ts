import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** Fallback lets `prisma generate` run locally without a `.env`; migrate/deploy always sets DATABASE_URL. */
const datasourceUrl =
  process.env.DATABASE_URL ??
  'postgresql://northpeak:northpeak@127.0.0.1:5432/northpeak?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: datasourceUrl,
  },
});
