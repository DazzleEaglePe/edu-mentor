import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../../common/idempotency/idempotency.module.js';
import { AdminOleadasController } from './admin-oleadas.controller.js';
import { AdminOleadasRepository } from './admin-oleadas.repository.js';
import { AdminOleadasService } from './admin-oleadas.service.js';

@Module({
  controllers: [AdminOleadasController],
  imports: [IdempotencyModule],
  providers: [AdminOleadasRepository, AdminOleadasService],
})
export class AdminProgramModule {}
