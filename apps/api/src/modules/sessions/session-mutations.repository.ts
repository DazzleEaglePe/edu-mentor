import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  completeIdempotency,
  reserveIdempotency,
} from '../../common/idempotency/idempotency-transaction.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type {
  CreateSessionInput,
  CreateSessionResult,
  ScheduleConflict,
  SetOwnConfirmationInput,
  SetOwnConfirmationResult,
} from './session-mutation.js';
import type { ConfirmationSummary, SessionParticipantView, SessionView } from './session-view.js';
import { sessionViewInclude, toSessionView } from './sessions.repository.js';

const CREATE_SESSION_OPERATION = 'sessions.create';
const SESSION_TYPES = new Set(['ONE_ON_ONE', 'GROUP', 'CHECKPOINT']);
const SESSION_PHASES = new Set(['FASE_1', 'FASE_2']);
const SESSION_STATUSES = new Set(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']);
const CONFIRMATION_STATUSES = new Set(['PENDING', 'CONFIRMED', 'DECLINED']);
const ATTENDANCE_STATUSES = new Set(['PENDING', 'ATTENDED', 'ABSENT']);

type ReservationClient = Pick<Prisma.TransactionClient, 'scheduleReservation'>;

interface ConflictLookupInput {
  readonly actorIsAdmin: boolean;
  readonly actorUserId: string;
  readonly endsAt: Date;
  readonly enrollmentIds: readonly string[];
  readonly mentorUserId: string;
  readonly organizationId: string;
  readonly startsAt: Date;
}

interface LockedConfirmation {
  readonly confirmation_closes_at: Date;
  readonly enrollment_id: string;
  readonly session_status: string;
}

class CreateSessionAbort extends Error {
  constructor(readonly result: CreateSessionResult) {
    super(result.kind);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function parseConfirmationSummary(value: unknown): ConfirmationSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const { confirmed, declined, pending, total } = value;

  if (
    typeof confirmed !== 'number' ||
    typeof declined !== 'number' ||
    typeof pending !== 'number' ||
    typeof total !== 'number'
  ) {
    return null;
  }

  return { confirmed, declined, pending, total };
}

function parseParticipant(value: unknown): SessionParticipantView | null {
  if (!isRecord(value) || !isRecord(value.participant)) {
    return null;
  }

  const { attendanceStatus, confirmationStatus, confirmedAt, enrollmentId, participant, version } =
    value;

  if (
    typeof attendanceStatus !== 'string' ||
    !ATTENDANCE_STATUSES.has(attendanceStatus) ||
    typeof confirmationStatus !== 'string' ||
    !CONFIRMATION_STATUSES.has(confirmationStatus) ||
    !isNullableString(confirmedAt) ||
    typeof enrollmentId !== 'string' ||
    typeof participant.fullName !== 'string' ||
    typeof participant.id !== 'string' ||
    typeof version !== 'number'
  ) {
    return null;
  }

  return {
    attendanceStatus: attendanceStatus as SessionParticipantView['attendanceStatus'],
    confirmationStatus: confirmationStatus as SessionParticipantView['confirmationStatus'],
    confirmedAt,
    enrollmentId,
    participant: {
      fullName: participant.fullName,
      id: participant.id,
    },
    version,
  };
}

function parseStoredSession(value: Prisma.JsonValue): SessionView | null {
  if (
    !isRecord(value) ||
    !isRecord(value.mentor) ||
    !isRecord(value.oleada) ||
    !Array.isArray(value.participants)
  ) {
    return null;
  }

  const summary = parseConfirmationSummary(value.confirmationSummary);
  const participants = value.participants.map(parseParticipant);
  const {
    canConfirm,
    checkpointMonth,
    confirmationClosesAt,
    description,
    endsAt,
    id,
    meetingUrl,
    mentor,
    oleada,
    phase,
    rescheduledFromId,
    startsAt,
    status,
    timezone,
    title,
    type,
    version,
    weekNumber,
  } = value;

  if (
    typeof canConfirm !== 'boolean' ||
    (typeof checkpointMonth !== 'number' && checkpointMonth !== null) ||
    typeof confirmationClosesAt !== 'string' ||
    summary === null ||
    !isNullableString(description) ||
    typeof endsAt !== 'string' ||
    typeof id !== 'string' ||
    !isNullableString(meetingUrl) ||
    typeof mentor.fullName !== 'string' ||
    typeof mentor.id !== 'string' ||
    typeof oleada.id !== 'string' ||
    typeof oleada.name !== 'string' ||
    typeof phase !== 'string' ||
    !SESSION_PHASES.has(phase) ||
    participants.some((participant) => participant === null) ||
    !isNullableString(rescheduledFromId) ||
    typeof startsAt !== 'string' ||
    typeof status !== 'string' ||
    !SESSION_STATUSES.has(status) ||
    typeof timezone !== 'string' ||
    typeof title !== 'string' ||
    typeof type !== 'string' ||
    !SESSION_TYPES.has(type) ||
    typeof version !== 'number' ||
    (typeof weekNumber !== 'number' && weekNumber !== null)
  ) {
    return null;
  }

  return {
    canConfirm,
    checkpointMonth,
    confirmationClosesAt,
    confirmationSummary: summary,
    description,
    endsAt,
    id,
    meetingUrl,
    mentor: {
      fullName: mentor.fullName,
      id: mentor.id,
    },
    oleada: {
      id: oleada.id,
      name: oleada.name,
    },
    participants: participants as SessionParticipantView[],
    phase: phase as SessionView['phase'],
    rescheduledFromId,
    startsAt,
    status: status as SessionView['status'],
    timezone,
    title,
    type: type as SessionView['type'],
    version,
    weekNumber,
  };
}

function participantJson(participant: SessionParticipantView): Prisma.InputJsonObject {
  return {
    attendanceStatus: participant.attendanceStatus,
    confirmationStatus: participant.confirmationStatus,
    confirmedAt: participant.confirmedAt,
    enrollmentId: participant.enrollmentId,
    participant: {
      fullName: participant.participant.fullName,
      id: participant.participant.id,
    },
    version: participant.version,
  };
}

function sessionJson(session: SessionView): Prisma.InputJsonObject {
  return {
    canConfirm: session.canConfirm,
    checkpointMonth: session.checkpointMonth,
    confirmationClosesAt: session.confirmationClosesAt,
    confirmationSummary: {
      confirmed: session.confirmationSummary.confirmed,
      declined: session.confirmationSummary.declined,
      pending: session.confirmationSummary.pending,
      total: session.confirmationSummary.total,
    },
    description: session.description,
    endsAt: session.endsAt,
    id: session.id,
    meetingUrl: session.meetingUrl,
    mentor: {
      fullName: session.mentor.fullName,
      id: session.mentor.id,
    },
    oleada: {
      id: session.oleada.id,
      name: session.oleada.name,
    },
    participants: session.participants.map(participantJson),
    phase: session.phase,
    rescheduledFromId: session.rescheduledFromId,
    startsAt: session.startsAt,
    status: session.status,
    timezone: session.timezone,
    title: session.title,
    type: session.type,
    version: session.version,
    weekNumber: session.weekNumber,
  };
}

function sessionSnapshot(session: SessionView): Prisma.InputJsonObject {
  return {
    checkpointMonth: session.checkpointMonth,
    endsAt: session.endsAt,
    enrollmentIds: session.participants.map((participant) => participant.enrollmentId),
    mentorUserId: session.mentor.id,
    oleadaId: session.oleada.id,
    phase: session.phase,
    startsAt: session.startsAt,
    status: session.status,
    timezone: session.timezone,
    type: session.type,
    version: session.version,
    weekNumber: session.weekNumber,
  };
}

function confirmationSnapshot(participant: SessionParticipantView): Prisma.InputJsonObject {
  return {
    confirmationStatus: participant.confirmationStatus,
    confirmedAt: participant.confirmedAt,
    enrollmentId: participant.enrollmentId,
    version: participant.version,
  };
}

function hasExclusionConstraintError(error: unknown): boolean {
  const visited = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === null || current === undefined || visited.has(current)) {
      continue;
    }

    if (
      typeof current === 'string' &&
      (current.includes('23P01') || current.includes('schedule_reservation_no_overlap'))
    ) {
      return true;
    }

    if (typeof current === 'object') {
      visited.add(current);

      for (const value of Object.values(current)) {
        queue.push(value);
      }
    }
  }

  return false;
}

async function findScheduleConflict(
  client: ReservationClient,
  input: ConflictLookupInput,
): Promise<ScheduleConflict | null> {
  const resources: Prisma.ScheduleReservationWhereInput[] = [
    {
      resourceId: input.mentorUserId,
      resourceType: 'USER',
    },
    ...input.enrollmentIds.map((enrollmentId) => ({
      resourceId: enrollmentId,
      resourceType: 'ENROLLMENT' as const,
    })),
  ];
  const reservation = await client.scheduleReservation.findFirst({
    include: {
      session: {
        include: {
          oleada: {
            select: {
              organizationId: true,
            },
          },
        },
      },
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    where: {
      endsAt: {
        gt: input.startsAt,
      },
      OR: resources,
      releasedAt: null,
      session: {
        oleada: {
          organizationId: input.organizationId,
        },
      },
      startsAt: {
        lt: input.endsAt,
      },
    },
  });

  if (reservation === null) {
    return null;
  }

  const canViewConflictingSession =
    input.actorIsAdmin || reservation.session.mentorUserId === input.actorUserId;

  return {
    canViewConflictingSession,
    conflictingSessionId: canViewConflictingSession ? reservation.sessionId : null,
    occupiedInterval: {
      endsAt: reservation.endsAt.toISOString(),
      startsAt: reservation.startsAt.toISOString(),
      timezone: reservation.session.timezone,
    },
    resourceId: reservation.resourceId,
    resourceType: reservation.resourceType,
  };
}

function toParticipantView(participant: {
  readonly attendanceStatus: SessionParticipantView['attendanceStatus'];
  readonly confirmationStatus: SessionParticipantView['confirmationStatus'];
  readonly confirmedAt: Date | null;
  readonly enrollment: {
    readonly user: {
      readonly fullName: string;
      readonly id: string;
    };
  };
  readonly enrollmentId: string;
  readonly version: number;
}): SessionParticipantView {
  return {
    attendanceStatus: participant.attendanceStatus,
    confirmationStatus: participant.confirmationStatus,
    confirmedAt: participant.confirmedAt?.toISOString() ?? null,
    enrollmentId: participant.enrollmentId,
    participant: participant.enrollment.user,
    version: participant.version,
  };
}

@Injectable()
export class SessionMutationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<CreateSessionResult> {
    const conflictInput: ConflictLookupInput = {
      actorIsAdmin: input.actorIsAdmin,
      actorUserId: input.actorUserId,
      endsAt: input.endsAt,
      enrollmentIds: input.enrollmentIds,
      mentorUserId: input.mentorUserId,
      organizationId: input.organizationId,
      startsAt: input.startsAt,
    };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservation = await reserveIdempotency(transaction, {
          expiresAt: input.expiresAt,
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_SESSION_OPERATION,
          organizationId: input.organizationId,
          requestHash: input.requestHash,
        });

        if (reservation.kind === 'reused') {
          return { kind: 'idempotency_key_reused' };
        }

        if (reservation.kind === 'replay') {
          const session = parseStoredSession(reservation.responseBody);

          if (reservation.responseStatus !== 201 || session === null) {
            throw new Error('The stored session response is incomplete or invalid.');
          }

          return {
            kind: 'replayed',
            session,
          };
        }

        const lockedOleada = await transaction.$queryRaw<readonly { status: string }[]>`
          SELECT "status"::text
          FROM "oleada"
          WHERE "id" = ${input.oleadaId}::uuid
            AND "organization_id" = ${input.organizationId}::uuid
          FOR SHARE
        `;

        if (lockedOleada.length === 0) {
          throw new CreateSessionAbort({ kind: 'invalid_target' });
        }

        if (lockedOleada[0]?.status === 'CLOSED') {
          throw new CreateSessionAbort({ kind: 'oleada_closed' });
        }

        if (
          (input.type === 'ONE_ON_ONE' && input.enrollmentIds.length !== 1) ||
          (input.type === 'GROUP' && input.enrollmentIds.length < 2)
        ) {
          throw new CreateSessionAbort({ kind: 'participant_count_invalid' });
        }

        const enrollments = await transaction.enrollment.findMany({
          select: {
            currentPhase: true,
            id: true,
          },
          where: {
            id: {
              in: [...input.enrollmentIds],
            },
            oleadaId: input.oleadaId,
            status: 'ACTIVE',
          },
        });

        if (enrollments.length !== input.enrollmentIds.length) {
          throw new CreateSessionAbort({ kind: 'invalid_target' });
        }

        if (enrollments.some((enrollment) => enrollment.currentPhase !== input.phase)) {
          throw new CreateSessionAbort({ kind: 'phase_mismatch' });
        }

        const mentor = await transaction.user.findFirst({
          include: {
            mentorProfile: {
              include: {
                capabilities: true,
              },
            },
            userRoles: {
              include: {
                role: true,
              },
            },
          },
          where: {
            id: input.mentorUserId,
            organizationId: input.organizationId,
          },
        });

        if (mentor === null) {
          throw new CreateSessionAbort({ kind: 'invalid_target' });
        }

        if (
          !mentor.isActive ||
          !mentor.userRoles.some((userRole) => userRole.role.key === 'MENTOR') ||
          mentor.mentorProfile === null ||
          !mentor.mentorProfile.capabilities.some((capability) => capability.kind === 'SPECIALIST')
        ) {
          throw new CreateSessionAbort({ kind: 'mentor_not_eligible' });
        }

        const assignments = await transaction.mentorAssignment.findMany({
          select: {
            enrollmentId: true,
          },
          where: {
            capability: 'SPECIALIST',
            mentorUserId: input.mentorUserId,
            oleadaId: input.oleadaId,
            startsAt: {
              lte: input.startsAt,
            },
            OR: [
              {
                endsAt: null,
              },
              {
                endsAt: {
                  gt: input.startsAt,
                },
              },
            ],
          },
        });
        const coversOleada = assignments.some((assignment) => assignment.enrollmentId === null);
        const coveredEnrollments = new Set(
          assignments
            .map((assignment) => assignment.enrollmentId)
            .filter((enrollmentId): enrollmentId is string => enrollmentId !== null),
        );

        if (
          !coversOleada &&
          input.enrollmentIds.some((enrollmentId) => !coveredEnrollments.has(enrollmentId))
        ) {
          throw new CreateSessionAbort({ kind: 'mentor_not_assigned' });
        }

        const existingConflict = await findScheduleConflict(transaction, conflictInput);

        if (existingConflict !== null) {
          throw new CreateSessionAbort({
            conflict: existingConflict,
            kind: 'schedule_conflict',
          });
        }

        const sessionId = randomUUID();
        await transaction.session.create({
          data: {
            checkpointMonth: input.checkpointMonth,
            confirmationClosesAt: input.startsAt,
            createdByUserId: input.actorUserId,
            description: input.description,
            endsAt: input.endsAt,
            id: sessionId,
            meetingUrl: input.meetingUrl,
            mentorUserId: input.mentorUserId,
            oleadaId: input.oleadaId,
            phase: input.phase,
            startsAt: input.startsAt,
            status: 'SCHEDULED',
            timezone: input.timezone,
            title: input.title,
            type: input.type,
            version: 1,
            weekNumber: input.weekNumber,
          },
        });
        await transaction.sessionParticipant.createMany({
          data: input.enrollmentIds.map((enrollmentId) => ({
            attendanceStatus: 'PENDING' as const,
            confirmationStatus: 'PENDING' as const,
            enrollmentId,
            sessionId,
            version: 1,
          })),
        });
        await transaction.scheduleReservation.createMany({
          data: [
            {
              endsAt: input.endsAt,
              id: randomUUID(),
              resourceId: input.mentorUserId,
              resourceType: 'USER',
              sessionId,
              startsAt: input.startsAt,
            },
            ...input.enrollmentIds.map((enrollmentId) => ({
              endsAt: input.endsAt,
              id: randomUUID(),
              resourceId: enrollmentId,
              resourceType: 'ENROLLMENT' as const,
              sessionId,
              startsAt: input.startsAt,
            })),
          ],
        });

        const stored = await transaction.session.findUnique({
          include: sessionViewInclude,
          where: {
            id: sessionId,
          },
        });

        if (stored === null) {
          throw new Error('The newly created session disappeared unexpectedly.');
        }

        const session = toSessionView(
          stored,
          {
            userId: input.actorUserId,
          },
          new Date(),
        );
        await transaction.auditLog.create({
          data: {
            action: 'session.created',
            actorUserId: input.actorUserId,
            afterData: sessionSnapshot(session),
            entityId: session.id,
            entityType: 'SESSION',
            organizationId: input.organizationId,
            traceId: input.traceId,
          },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: session.id,
            aggregateType: 'SESSION',
            eventType: 'session.created',
            idempotencyKey: `session:${session.id}:created:v1`,
            organizationId: input.organizationId,
            payload: sessionSnapshot(session),
          },
        });
        await completeIdempotency(transaction, {
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_SESSION_OPERATION,
          organizationId: input.organizationId,
          resourceId: session.id,
          responseBody: sessionJson(session),
          responseStatus: 201,
        });

        return {
          kind: 'created',
          session,
        };
      });
    } catch (error: unknown) {
      if (error instanceof CreateSessionAbort) {
        return error.result;
      }

      if (hasExclusionConstraintError(error)) {
        const conflict = await findScheduleConflict(this.prisma, conflictInput);

        if (conflict !== null) {
          return {
            conflict,
            kind: 'schedule_conflict',
          };
        }
      }

      throw error;
    }
  }

  setOwnConfirmation(input: SetOwnConfirmationInput): Promise<SetOwnConfirmationResult> {
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<readonly LockedConfirmation[]>`
        SELECT
          session_participant."enrollment_id",
          "session"."confirmation_closes_at",
          "session"."status"::text AS session_status
        FROM "session_participant"
        INNER JOIN "session"
          ON "session"."id" = session_participant."session_id"
        INNER JOIN "oleada"
          ON "oleada"."id" = "session"."oleada_id"
        INNER JOIN "enrollment"
          ON "enrollment"."id" = session_participant."enrollment_id"
        WHERE session_participant."session_id" = ${input.sessionId}::uuid
          AND "enrollment"."user_id" = ${input.actorUserId}::uuid
          AND "oleada"."organization_id" = ${input.organizationId}::uuid
        FOR SHARE OF "session"
        FOR UPDATE OF session_participant
      `;
      const currentLock = locked[0];

      if (currentLock === undefined) {
        return { kind: 'not_found' };
      }

      const currentRecord = await transaction.sessionParticipant.findUnique({
        include: {
          enrollment: {
            include: {
              user: {
                select: {
                  fullName: true,
                  id: true,
                },
              },
            },
          },
        },
        where: {
          sessionId_enrollmentId: {
            enrollmentId: currentLock.enrollment_id,
            sessionId: input.sessionId,
          },
        },
      });

      if (currentRecord === null) {
        return { kind: 'not_found' };
      }

      const current = toParticipantView(currentRecord);

      if (current.version !== input.expectedVersion) {
        return {
          currentVersion: current.version,
          kind: 'conflict',
        };
      }

      if (currentLock.session_status !== 'SCHEDULED') {
        return { kind: 'session_not_scheduled' };
      }

      const now = new Date();

      if (now.getTime() >= currentLock.confirmation_closes_at.getTime()) {
        return {
          confirmationClosesAt: currentLock.confirmation_closes_at.toISOString(),
          kind: 'confirmation_closed',
        };
      }

      if (current.confirmationStatus === input.status) {
        return {
          kind: 'unchanged',
          participant: current,
        };
      }

      const updatedRecord = await transaction.sessionParticipant.update({
        data: {
          confirmationStatus: input.status,
          confirmedAt: now,
          version: {
            increment: 1,
          },
        },
        include: {
          enrollment: {
            include: {
              user: {
                select: {
                  fullName: true,
                  id: true,
                },
              },
            },
          },
        },
        where: {
          sessionId_enrollmentId: {
            enrollmentId: current.enrollmentId,
            sessionId: input.sessionId,
          },
        },
      });
      const updated = toParticipantView(updatedRecord);
      await transaction.auditLog.create({
        data: {
          action: 'session.participant_confirmation_changed',
          actorUserId: input.actorUserId,
          afterData: confirmationSnapshot(updated),
          beforeData: confirmationSnapshot(current),
          entityId: input.sessionId,
          entityType: 'SESSION_PARTICIPANT',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });
      await transaction.outboxEvent.create({
        data: {
          aggregateId: input.sessionId,
          aggregateType: 'SESSION',
          eventType: 'session.participant_confirmation_changed',
          idempotencyKey: `session:${input.sessionId}:enrollment:${updated.enrollmentId}:confirmation:v${updated.version}`,
          organizationId: input.organizationId,
          payload: {
            confirmationStatus: updated.confirmationStatus,
            enrollmentId: updated.enrollmentId,
            sessionId: input.sessionId,
            version: updated.version,
          },
        },
      });

      return {
        kind: 'updated',
        participant: updated,
      };
    });
  }
}
