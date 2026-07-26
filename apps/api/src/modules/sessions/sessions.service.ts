import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import { IdempotencyFingerprintService } from '../../common/idempotency/idempotency-fingerprint.service.js';
import {
  IDEMPOTENCY_RETENTION_MS,
  requireIdempotencyKey,
} from '../../common/idempotency/idempotency-key.js';
import type { SessionPhase, SessionType } from '../../generated/prisma/enums.js';
import { SessionMutationsRepository } from './session-mutations.repository.js';
import type {
  SessionListFilters,
  SessionPage,
  SessionParticipantView,
  SessionSummaryView,
  SessionView,
} from './session-view.js';
import { SessionsRepository } from './sessions.repository.js';

const ISO_TIMESTAMP_WITH_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/u;
const CREATE_SESSION_OPERATION = 'sessions.create';
const CHECKPOINT_MONTHS = new Set([1, 2, 3, 6]);

export interface SessionListCommand {
  readonly from?: string;
  readonly limit: number;
  readonly oleadaId?: string;
  readonly page: number;
  readonly phase?: 'FASE_1' | 'FASE_2';
  readonly status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  readonly to?: string;
}

export interface CreateSessionCommand {
  readonly checkpointMonth?: number;
  readonly description?: string;
  readonly durationMinutes: number;
  readonly enrollmentIds: readonly string[];
  readonly idempotencyKey: string | undefined;
  readonly meetingUrl?: string;
  readonly mentorUserId?: string;
  readonly oleadaId: string;
  readonly phase: SessionPhase;
  readonly startsAt: string;
  readonly timezone: string;
  readonly title: string;
  readonly traceId: string;
  readonly type: SessionType;
  readonly weekNumber?: number;
}

export interface SetOwnConfirmationCommand {
  readonly expectedVersion: number;
  readonly sessionId: string;
  readonly status: 'CONFIRMED' | 'DECLINED';
  readonly traceId: string;
}

export interface SetParticipantAttendanceCommand {
  readonly enrollmentId: string;
  readonly expectedVersion: number;
  readonly sessionId: string;
  readonly status: 'ATTENDED' | 'ABSENT';
  readonly traceId: string;
}

function parseTimestamp(field: 'from' | 'startsAt' | 'to', value: string): Date {
  const parsed = new Date(value);

  if (!ISO_TIMESTAMP_WITH_OFFSET.test(value) || Number.isNaN(parsed.getTime())) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
      fields: [field],
    });
  }

  return parsed;
}

function parseRange(
  fromValue: string | undefined,
  toValue: string | undefined,
): {
  readonly from?: Date;
  readonly to?: Date;
} {
  const from = fromValue === undefined ? undefined : parseTimestamp('from', fromValue);
  const to = toValue === undefined ? undefined : parseTimestamp('to', toValue);

  if (from !== undefined && to !== undefined && from.getTime() >= to.getTime()) {
    throw new ApiError(
      422,
      'INVALID_TIME_RANGE',
      'El inicio del rango debe ser anterior al final.',
    );
  }

  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class SessionsService {
  constructor(
    @Inject(SessionsRepository) private readonly repository: SessionsRepository,
    @Inject(SessionMutationsRepository)
    private readonly mutations: SessionMutationsRepository,
    @Inject(IdempotencyFingerprintService)
    private readonly fingerprints: IdempotencyFingerprintService,
  ) {}

  async create(principal: AuthPrincipal, command: CreateSessionCommand): Promise<SessionView> {
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    const startsAt = parseTimestamp('startsAt', command.startsAt);
    const endsAt = new Date(startsAt.getTime() + command.durationMinutes * 60_000);
    const timezone = command.timezone.trim();
    const title = command.title.trim();
    const description = command.description?.trim() || null;
    const meetingUrl = command.meetingUrl?.trim() || null;
    const enrollmentIds = [...command.enrollmentIds].sort();
    const actorIsAdmin = principal.roles.includes('ADMIN');
    const actorIsMentor = principal.roles.includes('MENTOR');
    let mentorUserId = command.mentorUserId;

    if (mentorUserId === undefined) {
      if (!actorIsMentor) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
          fields: ['mentorUserId'],
        });
      }

      mentorUserId = principal.userId;
    } else if (!actorIsAdmin && mentorUserId !== principal.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
    }

    if (title.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
        fields: ['title'],
      });
    }

    if (!validTimezone(timezone)) {
      throw new ApiError(422, 'INVALID_TIMEZONE', 'La zona horaria no es válida.', {
        timezone,
      });
    }

    const phasePeriodValid =
      (command.phase === 'FASE_1' &&
        command.weekNumber !== undefined &&
        command.checkpointMonth === undefined) ||
      (command.phase === 'FASE_2' &&
        command.weekNumber === undefined &&
        command.checkpointMonth !== undefined &&
        CHECKPOINT_MONTHS.has(command.checkpointMonth));

    if (!phasePeriodValid) {
      throw new ApiError(
        422,
        'PHASE_PERIOD_MISMATCH',
        'La semana o el checkpoint no corresponde a la fase seleccionada.',
      );
    }

    if (
      (command.type === 'ONE_ON_ONE' && enrollmentIds.length !== 1) ||
      (command.type === 'GROUP' && enrollmentIds.length < 2)
    ) {
      throw new ApiError(
        422,
        'SESSION_PARTICIPANT_COUNT_INVALID',
        'La cantidad de participantes no corresponde al tipo de sesión.',
      );
    }

    const canonicalRequest = {
      checkpointMonth: command.checkpointMonth ?? null,
      description,
      durationMinutes: command.durationMinutes,
      enrollmentIds,
      meetingUrl,
      mentorUserId,
      oleadaId: command.oleadaId,
      phase: command.phase,
      startsAt: startsAt.toISOString(),
      timezone,
      title,
      type: command.type,
      weekNumber: command.weekNumber ?? null,
    };
    const result = await this.mutations.create({
      actorIsAdmin,
      actorUserId: principal.userId,
      checkpointMonth: command.checkpointMonth ?? null,
      description,
      endsAt,
      enrollmentIds,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
      idempotencyKeyHash: this.fingerprints.hashIdempotencyKey(idempotencyKey),
      meetingUrl,
      mentorUserId,
      oleadaId: command.oleadaId,
      organizationId: principal.organization.id,
      phase: command.phase,
      requestHash: this.fingerprints.hashRequest(CREATE_SESSION_OPERATION, canonicalRequest),
      startsAt,
      timezone,
      title,
      traceId: command.traceId,
      type: command.type,
      weekNumber: command.weekNumber ?? null,
    });

    switch (result.kind) {
      case 'created':
      case 'replayed':
        return result.session;
      case 'idempotency_key_reused':
        throw new ApiError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'La clave de idempotencia ya se usó con otros datos.',
        );
      case 'invalid_target':
        throw new ApiError(
          422,
          'SESSION_TARGET_INVALID',
          'La oleada, el mentor o los participantes no están disponibles para esta sesión.',
        );
      case 'oleada_closed':
        throw new ApiError(409, 'OLEADA_CLOSED', 'La oleada está cerrada.');
      case 'participant_count_invalid':
        throw new ApiError(
          422,
          'SESSION_PARTICIPANT_COUNT_INVALID',
          'La cantidad de participantes no corresponde al tipo de sesión.',
        );
      case 'phase_mismatch':
        throw new ApiError(
          422,
          'PARTICIPANT_PHASE_MISMATCH',
          'Los participantes deben estar activos en la fase de la sesión.',
        );
      case 'mentor_not_eligible':
        throw new ApiError(
          422,
          'MENTOR_NOT_ELIGIBLE_FOR_SESSION',
          'La persona seleccionada no es un mentor especialista activo.',
        );
      case 'mentor_not_assigned':
        throw new ApiError(
          403,
          'MENTOR_NOT_ASSIGNED',
          'El mentor no tiene una asignación vigente para los participantes.',
        );
      case 'schedule_conflict':
        throw new ApiError(409, 'SCHEDULE_CONFLICT', 'El horario ya no está disponible.', {
          canViewConflictingSession: result.conflict.canViewConflictingSession,
          conflictingSessionId: result.conflict.conflictingSessionId,
          occupiedInterval: result.conflict.occupiedInterval,
          resourceId: result.conflict.resourceId,
          resourceType: result.conflict.resourceType,
        });
    }
  }

  async list(principal: AuthPrincipal, command: SessionListCommand): Promise<SessionPage> {
    const range = parseRange(command.from, command.to);
    const filters: SessionListFilters = {
      ...range,
      ...(command.oleadaId === undefined ? {} : { oleadaId: command.oleadaId }),
      ...(command.phase === undefined ? {} : { phase: command.phase }),
      ...(command.status === undefined ? {} : { status: command.status }),
    };

    return this.repository.list(principal, command.page, command.limit, filters);
  }

  async calendar(
    principal: AuthPrincipal,
    fromValue: string,
    toValue: string,
  ): Promise<readonly SessionSummaryView[]> {
    const { from, to } = parseRange(fromValue, toValue);

    if (from === undefined || to === undefined) {
      throw new Error('Calendar range unexpectedly omitted a required boundary.');
    }

    return this.repository.calendar(principal, from, to);
  }

  async get(principal: AuthPrincipal, sessionId: string): Promise<SessionView> {
    const session = await this.repository.findById(principal, sessionId);

    if (session === null) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
    }

    return session;
  }

  async setOwnConfirmation(
    principal: AuthPrincipal,
    command: SetOwnConfirmationCommand,
  ): Promise<SessionParticipantView> {
    const result = await this.mutations.setOwnConfirmation({
      actorUserId: principal.userId,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      sessionId: command.sessionId,
      status: command.status,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'updated':
      case 'unchanged':
        return result.participant;
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
      case 'confirmation_closed':
        throw new ApiError(422, 'CONFIRMATION_CLOSED', 'La ventana de confirmación ya cerró.', {
          confirmationClosesAt: result.confirmationClosesAt,
        });
      case 'session_not_scheduled':
        throw new ApiError(
          409,
          'SESSION_NOT_SCHEDULED',
          'La sesión ya no admite cambios de confirmación.',
        );
    }
  }

  async setParticipantAttendance(
    principal: AuthPrincipal,
    command: SetParticipantAttendanceCommand,
  ): Promise<SessionParticipantView> {
    const result = await this.mutations.setParticipantAttendance({
      actorIsAdmin: principal.roles.includes('ADMIN'),
      actorUserId: principal.userId,
      enrollmentId: command.enrollmentId,
      expectedVersion: command.expectedVersion,
      organizationId: principal.organization.id,
      sessionId: command.sessionId,
      status: command.status,
      traceId: command.traceId,
    });

    switch (result.kind) {
      case 'updated':
      case 'unchanged':
        return result.participant;
      case 'not_found':
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recurso solicitado.');
      case 'forbidden':
        throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
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
      case 'session_not_started':
        throw new ApiError(422, 'SESSION_NOT_STARTED', 'La sesión todavía no ha comenzado.', {
          startsAt: result.startsAt,
        });
      case 'session_not_attendable':
        throw new ApiError(
          409,
          'SESSION_NOT_ATTENDABLE',
          'El estado de la sesión no admite registrar asistencia.',
        );
      case 'attendance_already_recorded':
        throw new ApiError(
          409,
          'ATTENDANCE_ALREADY_RECORDED',
          'La asistencia ya fue registrada y solo administración puede corregirla.',
        );
    }
  }
}
