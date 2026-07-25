import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import {
  IDEMPOTENCY_RETENTION_MS,
  requireIdempotencyKey,
} from '../../common/idempotency/idempotency-key.js';
import type {
  AdminMentorAssignment,
  AdminMentorAssignmentPage,
  ListAdminMentorAssignmentFilters,
} from './admin-mentor-assignment.js';
import { AdminMentorAssignmentsRepository } from './admin-mentor-assignments.repository.js';

const CREATE_ADMIN_MENTOR_ASSIGNMENT_OPERATION = 'admin.mentor-assignments.create';
const ISO_TIMESTAMP_WITH_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/u;

export interface CreateAdminMentorAssignmentCommand {
  readonly capability: 'SPECIALIST';
  readonly endsAt: string | null;
  readonly enrollmentId: string | null;
  readonly idempotencyKey: string | undefined;
  readonly mentorUserId: string;
  readonly oleadaId: string;
  readonly startsAt: string;
  readonly traceId: string;
}

export interface CloseAdminMentorAssignmentCommand {
  readonly expectedVersion: number;
  readonly mentorAssignmentId: string;
  readonly traceId: string;
}

function parseTimestamp(field: 'endsAt' | 'startsAt', value: string): Date {
  const parsed = new Date(value);

  if (!ISO_TIMESTAMP_WITH_OFFSET.test(value) || Number.isNaN(parsed.getTime())) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
      fields: [field],
    });
  }

  return parsed;
}

@Injectable()
export class AdminMentorAssignmentsService {
  constructor(
    @Inject(AdminMentorAssignmentsRepository)
    private readonly repository: AdminMentorAssignmentsRepository,
    @Inject(IdempotencyFingerprintService)
    private readonly fingerprints: IdempotencyFingerprintService,
  ) {}

  list(
    principal: AuthPrincipal,
    page: number,
    limit: number,
    filters: ListAdminMentorAssignmentFilters,
  ): Promise<AdminMentorAssignmentPage> {
    return this.repository.list(principal.organization.id, page, limit, filters);
  }

  async create(
    principal: AuthPrincipal,
    command: CreateAdminMentorAssignmentCommand,
  ): Promise<AdminMentorAssignment> {
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    const startsAt = parseTimestamp('startsAt', command.startsAt);
    const endsAt = command.endsAt === null ? null : parseTimestamp('endsAt', command.endsAt);

    if (
      endsAt !== null &&
      (endsAt.getTime() <= startsAt.getTime() || endsAt.getTime() <= Date.now())
    ) {
      throw new ApiError(
        422,
        'INVALID_ASSIGNMENT_PERIOD',
        'La fecha de fin debe ser posterior al inicio y mantener la asignación vigente.',
      );
    }

    const canonicalRequest = {
      capability: command.capability,
      endsAt: endsAt?.toISOString() ?? null,
      enrollmentId: command.enrollmentId,
      mentorUserId: command.mentorUserId,
      oleadaId: command.oleadaId,
      startsAt: startsAt.toISOString(),
    };
    const requestHash = this.fingerprints.hashRequest(
      CREATE_ADMIN_MENTOR_ASSIGNMENT_OPERATION,
      canonicalRequest,
    );
    const result = await this.repository.create({
      actorUserId: principal.userId,
      capability: command.capability,
      endsAt,
      enrollmentId: command.enrollmentId,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
      idempotencyKeyHash: this.fingerprints.hashIdempotencyKey(idempotencyKey),
      mentorUserId: command.mentorUserId,
      oleadaId: command.oleadaId,
      organizationId: principal.organization.id,
      requestHash,
      startsAt,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'created':
      case 'replayed':
        return result.assignment;
      case 'idempotency_key_reused':
        throw new ApiError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'La clave de idempotencia ya se usó con otros datos.',
        );
      case 'invalid_target':
        throw new ApiError(
          422,
          'MENTOR_ASSIGNMENT_TARGET_INVALID',
          'El mentor, la oleada o el enrollment no están disponibles para esta asignación.',
        );
      case 'oleada_closed':
        throw new ApiError(409, 'OLEADA_CLOSED', 'La oleada está cerrada.');
      case 'mentor_not_eligible':
        throw new ApiError(
          422,
          'MENTOR_NOT_ELIGIBLE_FOR_ASSIGNMENT',
          'La persona debe estar activa y contar con rol y capacidad de mentor especialista.',
        );
      case 'active_scope_conflict':
        throw new ApiError(
          409,
          'ACTIVE_MENTOR_ASSIGNMENT_EXISTS',
          'Ya existe una asignación activa para este alcance.',
        );
    }
  }

  async close(principal: AuthPrincipal, command: CloseAdminMentorAssignmentCommand): Promise<void> {
    const result = await this.repository.close({
      actorUserId: principal.userId,
      expectedVersion: command.expectedVersion,
      mentorAssignmentId: command.mentorAssignmentId,
      organizationId: principal.organization.id,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'closed':
        return;
      case 'not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
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
      case 'already_closed':
        throw new ApiError(409, 'MENTOR_ASSIGNMENT_CLOSED', 'La asignación ya está cerrada.');
      case 'not_started':
        throw new ApiError(
          409,
          'MENTOR_ASSIGNMENT_NOT_STARTED',
          'Una asignación futura no puede cerrarse antes de su inicio.',
        );
    }
  }
}
