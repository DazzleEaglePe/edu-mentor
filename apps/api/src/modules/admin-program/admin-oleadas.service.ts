import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import {
  IDEMPOTENCY_RETENTION_MS,
  requireIdempotencyKey,
} from '../../common/idempotency/idempotency-key.js';
import type { OleadaStatus } from '../../generated/prisma/enums.js';
import type { AdminOleada, AdminOleadaPage } from './admin-oleada.js';
import { AdminOleadasRepository } from './admin-oleadas.repository.js';

const CREATE_ADMIN_OLEADA_OPERATION = 'admin.oleadas.create';

export interface CreateAdminOleadaCommand {
  readonly capacity: number;
  readonly endDate: string;
  readonly idempotencyKey: string | undefined;
  readonly name: string;
  readonly sector: string;
  readonly startDate: string;
  readonly traceId: string;
}

export interface UpdateAdminOleadaCommand {
  readonly capacity?: number;
  readonly endDate?: string;
  readonly expectedVersion: number;
  readonly name?: string;
  readonly oleadaId: string;
  readonly sector?: string;
  readonly startDate?: string;
  readonly status?: OleadaStatus;
  readonly traceId: string;
}

function parseCalendarDate(field: 'endDate' | 'startDate', value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
      fields: [field],
    });
  }

  return parsed;
}

function normalizedRequiredText(field: 'name' | 'sector', value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
      fields: [field],
    });
  }

  return normalized;
}

function hiddenResource(): ApiError {
  return new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
}

@Injectable()
export class AdminOleadasService {
  constructor(
    @Inject(AdminOleadasRepository) private readonly repository: AdminOleadasRepository,
    @Inject(IdempotencyFingerprintService)
    private readonly fingerprints: IdempotencyFingerprintService,
  ) {}

  list(
    principal: AuthPrincipal,
    page: number,
    limit: number,
    status?: OleadaStatus,
  ): Promise<AdminOleadaPage> {
    return this.repository.list(principal.organization.id, page, limit, status);
  }

  async create(principal: AuthPrincipal, command: CreateAdminOleadaCommand): Promise<AdminOleada> {
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    const name = normalizedRequiredText('name', command.name);
    const sector = normalizedRequiredText('sector', command.sector);
    const startDate = parseCalendarDate('startDate', command.startDate);
    const endDate = parseCalendarDate('endDate', command.endDate);

    if (endDate.getTime() < startDate.getTime()) {
      throw new ApiError(
        422,
        'INVALID_DATE_RANGE',
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      );
    }

    const requestHash = this.fingerprints.hashRequest(CREATE_ADMIN_OLEADA_OPERATION, {
      capacity: command.capacity,
      endDate: command.endDate,
      name,
      sector,
      startDate: command.startDate,
    });
    const result = await this.repository.create({
      actorUserId: principal.userId,
      capacity: command.capacity,
      endDate,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
      idempotencyKeyHash: this.fingerprints.hashIdempotencyKey(idempotencyKey),
      name,
      organizationId: principal.organization.id,
      requestHash,
      sector,
      startDate,
      traceId: command.traceId,
    });

    if (result.kind === 'idempotency_key_reused') {
      throw new ApiError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'La clave de idempotencia ya se usó con otros datos.',
      );
    }

    return result.oleada;
  }

  async update(principal: AuthPrincipal, command: UpdateAdminOleadaCommand): Promise<AdminOleada> {
    if (
      command.capacity === undefined &&
      command.endDate === undefined &&
      command.name === undefined &&
      command.sector === undefined &&
      command.startDate === undefined &&
      command.status === undefined
    ) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['capacity', 'endDate', 'name', 'sector', 'startDate', 'status'],
      });
    }

    const result = await this.repository.update({
      actorUserId: principal.userId,
      expectedVersion: command.expectedVersion,
      oleadaId: command.oleadaId,
      organizationId: principal.organization.id,
      traceId: command.traceId,
      ...(command.capacity === undefined ? {} : { capacity: command.capacity }),
      ...(command.endDate === undefined
        ? {}
        : { endDate: parseCalendarDate('endDate', command.endDate) }),
      ...(command.name === undefined ? {} : { name: normalizedRequiredText('name', command.name) }),
      ...(command.sector === undefined
        ? {}
        : { sector: normalizedRequiredText('sector', command.sector) }),
      ...(command.startDate === undefined
        ? {}
        : { startDate: parseCalendarDate('startDate', command.startDate) }),
      ...(command.status === undefined ? {} : { status: command.status }),
    });

    switch (result.kind) {
      case 'updated':
        return result.oleada;
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
      case 'capacity_below_active':
        throw new ApiError(
          422,
          'CAPACITY_BELOW_ACTIVE_ENROLLMENTS',
          'La capacidad no puede ser menor que las inscripciones activas.',
          {
            activeEnrollmentCount: result.activeEnrollmentCount,
          },
        );
      case 'invalid_transition':
        throw new ApiError(
          409,
          'INVALID_STATUS_TRANSITION',
          'La transición de estado no está permitida.',
          {
            currentStatus: result.currentStatus,
            requestedStatus: result.requestedStatus,
          },
        );
      case 'closed':
        throw new ApiError(409, 'OLEADA_CLOSED', 'Una oleada cerrada es de solo lectura.');
      case 'invalid_date_range':
        throw new ApiError(
          422,
          'INVALID_DATE_RANGE',
          'La fecha de fin no puede ser anterior a la fecha de inicio.',
        );
    }
  }
}
