import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../../common/idempotency/idempotency.module.js';
import { AdminEnrollmentsController } from './admin-enrollments.controller.js';
import { AdminEnrollmentsRepository } from './admin-enrollments.repository.js';
import { AdminEnrollmentsService } from './admin-enrollments.service.js';
import { AdminOleadasController } from './admin-oleadas.controller.js';
import { AdminOleadasRepository } from './admin-oleadas.repository.js';
import { AdminOleadasService } from './admin-oleadas.service.js';

@Module({
  controllers: [AdminEnrollmentsController, AdminOleadasController],
  imports: [IdempotencyModule],
  providers: [
    AdminEnrollmentsRepository,
    AdminEnrollmentsService,
    AdminOleadasRepository,
    AdminOleadasService,
  ],
})
export class AdminProgramModule {}
