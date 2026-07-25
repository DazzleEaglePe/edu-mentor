import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import {
  IDEMPOTENCY_RETENTION_MS,
  requireIdempotencyKey,
} from '../../common/idempotency/idempotency-key.js';
import type { EnrollmentStatus, ProgramPhase } from '../../generated/prisma/enums.js';
import type {
  AdminEnrollment,
  AdminEnrollmentPage,
  ListAdminEnrollmentFilters,
} from './admin-enrollment.js';
import { AdminEnrollmentsRepository } from './admin-enrollments.repository.js';

const CREATE_ADMIN_ENROLLMENT_OPERATION = 'admin.enrollments.create';

export interface CreateAdminEnrollmentCommand {
  readonly currentPhase: 'FASE_0' | 'FASE_1';
  readonly idempotencyKey: string | undefined;
  readonly oleadaId: string;
  readonly traceId: string;
  readonly userId: string;
}

export interface UpdateAdminEnrollmentCommand {
  readonly currentPhase?: ProgramPhase;
  readonly currentWeek?: number | null;
  readonly enrollmentId: string;
  readonly expectedVersion: number;
  readonly status?: EnrollmentStatus;
  readonly traceId: string;
}

function hiddenResource(): ApiError {
  return new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
}

@Injectable()
export class AdminEnrollmentsService {
  constructor(
    @Inject(AdminEnrollmentsRepository)
    private readonly repository: AdminEnrollmentsRepository,
    @Inject(IdempotencyFingerprintService)
    private readonly fingerprints: IdempotencyFingerprintService,
  ) {}

  list(
    principal: AuthPrincipal,
    page: number,
    limit: number,
    filters: ListAdminEnrollmentFilters,
  ): Promise<AdminEnrollmentPage> {
    return this.repository.list(principal.organization.id, page, limit, filters);
  }

  async create(
    principal: AuthPrincipal,
    command: CreateAdminEnrollmentCommand,
  ): Promise<AdminEnrollment> {
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    const requestHash = this.fingerprints.hashRequest(CREATE_ADMIN_ENROLLMENT_OPERATION, {
      currentPhase: command.currentPhase,
      oleadaId: command.oleadaId,
      userId: command.userId,
    });
    const result = await this.repository.create({
      actorUserId: principal.userId,
      currentPhase: command.currentPhase,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
      idempotencyKeyHash: this.fingerprints.hashIdempotencyKey(idempotencyKey),
      oleadaId: command.oleadaId,
      organizationId: principal.organization.id,
      requestHash,
      traceId: command.traceId,
      userId: command.userId,
    });

    switch (result.kind) {
      case 'created':
      case 'replayed':
        return result.enrollment;
      case 'idempotency_key_reused':
        throw new ApiError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'La clave de idempotencia ya se usó con otros datos.',
        );
      case 'invalid_target':
        throw new ApiError(
          422,
          'ENROLLMENT_TARGET_INVALID',
          'La persona o la oleada no están disponibles para esta inscripción.',
        );
      case 'oleada_closed':
        throw new ApiError(409, 'OLEADA_CLOSED', 'La oleada está cerrada.');
      case 'user_not_eligible':
        throw new ApiError(
          422,
          'USER_NOT_ELIGIBLE_FOR_ENROLLMENT',
          'La persona debe estar activa y tener el rol participante.',
        );
      case 'capacity_reached':
        throw new ApiError(409, 'OLEADA_CAPACITY_REACHED', 'La oleada ya alcanzó su capacidad.', {
          capacity: result.capacity,
        });
      case 'already_exists':
        throw new ApiError(
          409,
          'ENROLLMENT_ALREADY_EXISTS',
          'La persona ya tiene una inscripción en esta oleada.',
        );
    }
  }

  async update(
    principal: AuthPrincipal,
    command: UpdateAdminEnrollmentCommand,
  ): Promise<AdminEnrollment> {
    if (
      command.currentPhase === undefined &&
      command.currentWeek === undefined &&
      command.status === undefined
    ) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['currentPhase', 'currentWeek', 'status'],
      });
    }

    const result = await this.repository.update({
      actorUserId: principal.userId,
      enrollmentId: command.enrollmentId,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      traceId: command.traceId,
      ...(command.currentPhase === undefined ? {} : { currentPhase: command.currentPhase }),
      ...(command.currentWeek === undefined ? {} : { currentWeek: command.currentWeek }),
      ...(command.status === undefined ? {} : { status: command.status }),
    });

    switch (result.kind) {
      case 'updated':
        return result.enrollment;
      case 'not_found':
        throw hiddenResource();
      case 'conflict':
        throw new ApiError(
          409,
          'VERSION_CONFLICT',
          'El recurso cambió. Actualiza e inténtalo otra vez.',
          {
            currentVersion: result.currentVersion,
            expectedVersion: command.expectedVersion,
          },
        );
      case 'terminal':
        throw new ApiError(
          409,
          'ENROLLMENT_TERMINAL',
          'Una inscripción retirada o completada es de solo lectura.',
        );
      case 'invalid_status_transition':
        throw new ApiError(
          409,
          'INVALID_ENROLLMENT_STATUS_TRANSITION',
          'La transición de estado de la inscripción no está permitida.',
          {
            currentStatus: result.currentStatus,
            requestedStatus: result.requestedStatus,
          },
        );
      case 'invalid_phase_transition':
        throw new ApiError(
          409,
          'INVALID_PHASE_TRANSITION',
          'La fase solo puede avanzar al paso siguiente.',
          {
            currentPhase: result.currentPhase,
            requestedPhase: result.requestedPhase,
          },
        );
      case 'phase_week_mismatch':
        throw new ApiError(
          422,
          'PHASE_WEEK_MISMATCH',
          'La semana actual solo se registra durante FASE_1.',
          {
            phase: result.phase,
          },
        );
    }
  }
}
