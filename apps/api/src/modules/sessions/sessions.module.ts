import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../../common/idempotency/idempotency.module.js';
import { SessionMutationsRepository } from './session-mutations.repository.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';

@Module({
  controllers: [SessionsController],
  imports: [IdempotencyModule],
  providers: [SessionMutationsRepository, SessionsRepository, SessionsService],
})
export class SessionsModule {}
