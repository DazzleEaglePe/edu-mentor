import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const localDevelopmentUrl =
  'postgresql://edu_mentor:local_development_only@localhost:5432/edu_mentor?schema=public';
const databaseUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV === 'production' && databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required in production.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl ?? localDevelopmentUrl,
  },
});
