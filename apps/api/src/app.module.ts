import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from './config/runtime-config.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AdminProgramModule } from './modules/admin-program/admin-program.module.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DeliverablesModule } from './modules/deliverables/deliverables.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';

@Module({
  imports: [
    RuntimeConfigModule,
    DatabaseModule,
    RedisModule,
    AuthModule,
    AdminUsersModule,
    AdminProgramModule,
    SessionsModule,
    DeliverablesModule,
    HealthModule,
  ],
})
export class AppModule {}

