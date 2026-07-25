import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const localDevelopmentUrl =
  'postgresql://edu_mentor:local_development_only@localhost:5432/edu_mentor?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDevelopmentUrl,
  },
});
