import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  completeIdempotency,
  reserveIdempotency,
} from '../../common/idempotency/idempotency-transaction.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  type AdminMentorAssignment,
  type AdminMentorAssignmentPage,
  type CloseAdminMentorAssignmentInput,
  type CloseAdminMentorAssignmentResult,
  type CreateAdminMentorAssignmentInput,
  type CreateAdminMentorAssignmentResult,
  type ListAdminMentorAssignmentFilters,
} from './admin-mentor-assignment.js';

const CREATE_ADMIN_MENTOR_ASSIGNMENT_OPERATION = 'admin.mentor-assignments.create';

const adminMentorAssignmentInclude = {
  mentor: {
    select: {
      fullName: true,
      id: true,
    },
  },
  oleada: {
    select: {
      id: true,
      name: true,
    },
  },
} as const satisfies Prisma.MentorAssignmentInclude;

const eligibleMentorInclude = {
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
} as const satisfies Prisma.UserInclude;

type MentorAssignmentWithRelations = Prisma.MentorAssignmentGetPayload<{
  include: typeof adminMentorAssignmentInclude;
}>;

class CreateMentorAssignmentAbort extends Error {
  constructor(readonly result: CreateAdminMentorAssignmentResult) {
    super(result.kind);
  }
}

function assignmentStatus(endsAt: Date | null, now = new Date()): AdminMentorAssignment['status'] {
  return endsAt !== null && endsAt.getTime() <= now.getTime() ? 'CLOSED' : 'ACTIVE';
}

function toAdminMentorAssignment(
  assignment: MentorAssignmentWithRelations,
  now = new Date(),
): AdminMentorAssignment {
  return {
    capability: assignment.capability,
    endsAt: assignment.endsAt?.toISOString() ?? null,
    enrollmentId: assignment.enrollmentId,
    id: assignment.id,
    mentor: assignment.mentor,
    oleada: assignment.oleada,
    startsAt: assignment.startsAt.toISOString(),
    status: assignmentStatus(assignment.endsAt, now),
    version: assignment.version,
  };
}

function assignmentJson(assignment: AdminMentorAssignment): Prisma.InputJsonObject {
  return {
    capability: assignment.capability,
    endsAt: assignment.endsAt,
    enrollmentId: assignment.enrollmentId,
    id: assignment.id,
    mentor: {
      fullName: assignment.mentor.fullName,
      id: assignment.mentor.id,
    },
    oleada: {
      id: assignment.oleada.id,
      name: assignment.oleada.name,
    },
    startsAt: assignment.startsAt,
    status: assignment.status,
    version: assignment.version,
  };
}

function parseStoredAssignment(value: Prisma.JsonValue): AdminMentorAssignment | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const { capability, endsAt, enrollmentId, id, mentor, oleada, startsAt, status, version } = value;

  if (
    (capability !== 'SPECIALIST' && capability !== 'PEER') ||
    (typeof endsAt !== 'string' && endsAt !== null) ||
    (typeof enrollmentId !== 'string' && enrollmentId !== null) ||
    typeof id !== 'string' ||
    typeof mentor !== 'object' ||
    mentor === null ||
    Array.isArray(mentor) ||
    typeof oleada !== 'object' ||
    oleada === null ||
    Array.isArray(oleada) ||
    typeof startsAt !== 'string' ||
    (status !== 'ACTIVE' && status !== 'CLOSED') ||
    typeof version !== 'number'
  ) {
    return null;
  }

  if (
    typeof mentor.fullName !== 'string' ||
    typeof mentor.id !== 'string' ||
    typeof oleada.id !== 'string' ||
    typeof oleada.name !== 'string'
  ) {
    return null;
  }

  return {
    capability,
    endsAt,
    enrollmentId,
    id,
    mentor: {
      fullName: mentor.fullName,
      id: mentor.id,
    },
    oleada: {
      id: oleada.id,
      name: oleada.name,
    },
    startsAt,
    status,
    version,
  };
}

function assignmentSnapshot(assignment: AdminMentorAssignment): Prisma.InputJsonObject {
  return {
    capability: assignment.capability,
    endsAt: assignment.endsAt,
    enrollmentId: assignment.enrollmentId,
    mentorUserId: assignment.mentor.id,
    oleadaId: assignment.oleada.id,
    startsAt: assignment.startsAt,
    status: assignment.status,
    version: assignment.version,
  };
}

@Injectable()
export class AdminMentorAssignmentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    page: number,
    limit: number,
    filters: ListAdminMentorAssignmentFilters,
  ): Promise<AdminMentorAssignmentPage> {
    const now = new Date();
    const skip = (page - 1) * limit;
    const where: Prisma.MentorAssignmentWhereInput = {
      oleada: {
        organizationId,
      },
      ...(filters.active === undefined
        ? {}
        : filters.active
          ? {
              OR: [
                {
                  endsAt: null,
                },
                {
                  endsAt: {
                    gt: now,
                  },
                },
              ],
            }
          : {
              endsAt: {
                lte: now,
              },
            }),
      ...(filters.mentorUserId === undefined ? {} : { mentorUserId: filters.mentorUserId }),
      ...(filters.oleadaId === undefined ? {} : { oleadaId: filters.oleadaId }),
    };
    const [assignments, total] = await this.prisma.$transaction([
      this.prisma.mentorAssignment.findMany({
        include: adminMentorAssignmentInclude,
        orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.mentorAssignment.count({ where }),
    ]);

    return {
      data: assignments.map((assignment) => toAdminMentorAssignment(assignment, now)),
      meta: {
        hasNextPage: skip + assignments.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async create(
    input: CreateAdminMentorAssignmentInput,
  ): Promise<CreateAdminMentorAssignmentResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservation = await reserveIdempotency(transaction, {
          expiresAt: input.expiresAt,
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_ADMIN_MENTOR_ASSIGNMENT_OPERATION,
          organizationId: input.organizationId,
          requestHash: input.requestHash,
        });

        if (reservation.kind === 'reused') {
          return { kind: 'idempotency_key_reused' };
        }

        if (reservation.kind === 'replay') {
          const assignment = parseStoredAssignment(reservation.responseBody);

          if (reservation.responseStatus !== 201 || assignment === null) {
            throw new Error('The stored mentor assignment response is incomplete or invalid.');
          }

          return {
            assignment,
            kind: 'replayed',
          };
        }

        const lockedOleada = await transaction.$queryRaw<readonly { status: string }[]>`
          SELECT "status"::text
          FROM "oleada"
          WHERE "id" = ${input.oleadaId}::uuid
            AND "organization_id" = ${input.organizationId}::uuid
          FOR UPDATE
        `;

        if (lockedOleada.length === 0) {
          throw new CreateMentorAssignmentAbort({ kind: 'invalid_target' });
        }

        if (lockedOleada[0]?.status === 'CLOSED') {
          throw new CreateMentorAssignmentAbort({ kind: 'oleada_closed' });
        }

        const mentor = await transaction.user.findFirst({
          include: eligibleMentorInclude,
          where: {
            id: input.mentorUserId,
            organizationId: input.organizationId,
          },
        });

        if (mentor === null) {
          throw new CreateMentorAssignmentAbort({ kind: 'invalid_target' });
        }

        if (
          !mentor.isActive ||
          !mentor.userRoles.some((userRole) => userRole.role.key === 'MENTOR') ||
          mentor.mentorProfile === null ||
          !mentor.mentorProfile.capabilities.some(
            (capability) => capability.kind === input.capability,
          )
        ) {
          throw new CreateMentorAssignmentAbort({ kind: 'mentor_not_eligible' });
        }

        if (input.enrollmentId !== null) {
          const enrollment = await transaction.enrollment.findFirst({
            select: {
              id: true,
            },
            where: {
              id: input.enrollmentId,
              oleadaId: input.oleadaId,
              status: 'ACTIVE',
            },
          });

          if (enrollment === null) {
            throw new CreateMentorAssignmentAbort({ kind: 'invalid_target' });
          }
        }

        const now = new Date();
        const activeScope = await transaction.mentorAssignment.findFirst({
          select: {
            id: true,
          },
          where: {
            capability: input.capability,
            enrollmentId: input.enrollmentId,
            oleadaId: input.oleadaId,
            OR: [
              {
                endsAt: null,
              },
              {
                endsAt: {
                  gt: now,
                },
              },
            ],
          },
        });

        if (activeScope !== null) {
          throw new CreateMentorAssignmentAbort({ kind: 'active_scope_conflict' });
        }

        const stored = await transaction.mentorAssignment.create({
          data: {
            capability: input.capability,
            endsAt: input.endsAt,
            enrollmentId: input.enrollmentId,
            id: randomUUID(),
            mentorUserId: input.mentorUserId,
            oleadaId: input.oleadaId,
            startsAt: input.startsAt,
            version: 1,
          },
          include: adminMentorAssignmentInclude,
        });
        const assignment = toAdminMentorAssignment(stored, now);
        await transaction.auditLog.create({
          data: {
            action: 'admin.mentor_assignment_created',
            actorUserId: input.actorUserId,
            afterData: assignmentSnapshot(assignment),
            entityId: assignment.id,
            entityType: 'MENTOR_ASSIGNMENT',
            organizationId: input.organizationId,
            traceId: input.traceId,
          },
        });
        await completeIdempotency(transaction, {
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_ADMIN_MENTOR_ASSIGNMENT_OPERATION,
          organizationId: input.organizationId,
          resourceId: assignment.id,
          responseBody: assignmentJson(assignment),
          responseStatus: 201,
        });

        return {
          assignment,
          kind: 'created',
        };
      });
    } catch (error: unknown) {
      if (error instanceof CreateMentorAssignmentAbort) {
        return error.result;
      }

      throw error;
    }
  }

  close(input: CloseAdminMentorAssignmentInput): Promise<CloseAdminMentorAssignmentResult> {
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<readonly { id: string }[]>`
        SELECT mentor_assignment."id"
        FROM "mentor_assignment"
        INNER JOIN "oleada" ON "oleada"."id" = mentor_assignment."oleada_id"
        WHERE mentor_assignment."id" = ${input.mentorAssignmentId}::uuid
          AND "oleada"."organization_id" = ${input.organizationId}::uuid
        FOR UPDATE OF mentor_assignment
      `;

      if (locked.length === 0) {
        return { kind: 'not_found' };
      }

      const currentRecord = await transaction.mentorAssignment.findUnique({
        include: adminMentorAssignmentInclude,
        where: {
          id: input.mentorAssignmentId,
        },
      });

      if (currentRecord === null) {
        return { kind: 'not_found' };
      }

      if (currentRecord.version !== input.expectedVersion) {
        return {
          currentVersion: currentRecord.version,
          kind: 'conflict',
        };
      }

      const now = new Date();

      if (assignmentStatus(currentRecord.endsAt, now) === 'CLOSED') {
        return { kind: 'already_closed' };
      }

      if (currentRecord.startsAt.getTime() >= now.getTime()) {
        return { kind: 'not_started' };
      }

      const current = toAdminMentorAssignment(currentRecord, now);
      const updatedRecord = await transaction.mentorAssignment.update({
        data: {
          endsAt: now,
          version: {
            increment: 1,
          },
        },
        include: adminMentorAssignmentInclude,
        where: {
          id: input.mentorAssignmentId,
        },
      });
      const closed = toAdminMentorAssignment(updatedRecord, now);
      await transaction.auditLog.create({
        data: {
          action: 'admin.mentor_assignment_closed',
          actorUserId: input.actorUserId,
          afterData: assignmentSnapshot(closed),
          beforeData: assignmentSnapshot(current),
          entityId: closed.id,
          entityType: 'MENTOR_ASSIGNMENT',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return { kind: 'closed' };
    });
  }
}
