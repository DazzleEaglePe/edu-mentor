import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../../config/runtime-config.js';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    const pool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 1_000,
      idleTimeoutMillis: 10_000,
      max: 10,
    });

    super({
      adapter: new PrismaPg(pool),
    });

    this.pool = pool;
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
