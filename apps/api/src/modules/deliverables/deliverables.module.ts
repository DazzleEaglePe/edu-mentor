import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../../common/idempotency/idempotency.module.js';
import { DeliverableMutationsRepository } from './deliverable-mutations.repository.js';
import { DeliverablesController } from './deliverables.controller.js';
import { DeliverablesRepository } from './deliverables.repository.js';
import { DeliverablesService } from './deliverables.service.js';

@Module({
  controllers: [DeliverablesController],
  imports: [IdempotencyModule],
  providers: [DeliverableMutationsRepository, DeliverablesRepository, DeliverablesService],
})
export class DeliverablesModule {}
