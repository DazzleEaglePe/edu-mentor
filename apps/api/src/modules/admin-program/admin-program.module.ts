import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../../common/idempotency/idempotency.module.js';
import { AdminEnrollmentsController } from './admin-enrollments.controller.js';
import { AdminEnrollmentsRepository } from './admin-enrollments.repository.js';
import { AdminEnrollmentsService } from './admin-enrollments.service.js';
import { AdminMentorAssignmentsController } from './admin-mentor-assignments.controller.js';
import { AdminMentorAssignmentsRepository } from './admin-mentor-assignments.repository.js';
import { AdminMentorAssignmentsService } from './admin-mentor-assignments.service.js';
import { AdminOleadasController } from './admin-oleadas.controller.js';
import { AdminOleadasRepository } from './admin-oleadas.repository.js';
import { AdminOleadasService } from './admin-oleadas.service.js';

@Module({
  controllers: [
    AdminEnrollmentsController,
    AdminMentorAssignmentsController,
    AdminOleadasController,
  ],
  imports: [IdempotencyModule],
  providers: [
    AdminEnrollmentsRepository,
    AdminEnrollmentsService,
    AdminMentorAssignmentsRepository,
    AdminMentorAssignmentsService,
    AdminOleadasRepository,
    AdminOleadasService,
  ],
})
export class AdminProgramModule {}
