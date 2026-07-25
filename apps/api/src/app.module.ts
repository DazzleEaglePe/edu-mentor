import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from './config/runtime-config.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [RuntimeConfigModule, DatabaseModule, RedisModule, AuthModule, HealthModule],
})
export class AppModule {}
