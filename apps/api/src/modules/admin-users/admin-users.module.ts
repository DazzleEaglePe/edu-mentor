import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../../common/idempotency/idempotency.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersRepository } from './admin-users.repository.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  controllers: [AdminUsersController],
  imports: [AuthModule, IdempotencyModule],
  providers: [AdminUsersRepository, AdminUsersService],
})
export class AdminUsersModule {}
