import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  completeIdempotency,
  reserveIdempotency,
} from '../../common/idempotency/idempotency-transaction.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ProgramPhase, RoleKey } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { adminUserInclude, toAdminUser } from '../admin-users/admin-user-mapper.js';
import type { AdminUser } from '../admin-users/admin-user.js';
import {
  type AdminEnrollment,
  type AdminEnrollmentPage,
  type CreateAdminEnrollmentInput,
  type CreateAdminEnrollmentResult,
  type ListAdminEnrollmentFilters,
  type UpdateAdminEnrollmentInput,
  type UpdateAdminEnrollmentResult,
} from './admin-enrollment.js';

const CREATE_ADMIN_ENROLLMENT_OPERATION = 'admin.enrollments.create';
const ROLE_KEYS = new Set<RoleKey>(['ADMIN', 'MENTOR', 'PARTICIPANT']);

const adminEnrollmentInclude = {
  oleada: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    include: adminUserInclude,
  },
} as const satisfies Prisma.EnrollmentInclude;

type EnrollmentWithRelations = Prisma.EnrollmentGetPayload<{
  include: typeof adminEnrollmentInclude;
}>;

const nextPhase: Readonly<Record<ProgramPhase, ProgramPhase | null>> = {
  FASE_0: 'FASE_1',
  FASE_1: 'FASE_2',
  FASE_2: 'FINISHED',
  FINISHED: null,
};

class CreateEnrollmentAbort extends Error {
  constructor(readonly result: CreateAdminEnrollmentResult) {
    super(result.kind);
  }
}

function toAdminEnrollment(enrollment: EnrollmentWithRelations): AdminEnrollment {
  return {
    currentPhase: enrollment.currentPhase,
    currentWeek: enrollment.currentWeek,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    id: enrollment.id,
    oleada: enrollment.oleada,
    phase1GraduatedAt: enrollment.phase1GraduatedAt?.toISOString() ?? null,
    status: enrollment.status,
    user: toAdminUser(enrollment.user),
    version: enrollment.version,
  };
}

function adminUserJson(user: AdminUser): Prisma.InputJsonObject {
  return {
    email: user.email,
    fullName: user.fullName,
    id: user.id,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    roles: [...user.roles],
    version: user.version,
  };
}

function enrollmentJson(enrollment: AdminEnrollment): Prisma.InputJsonObject {
  return {
    currentPhase: enrollment.currentPhase,
    currentWeek: enrollment.currentWeek,
    enrolledAt: enrollment.enrolledAt,
    id: enrollment.id,
    oleada: {
      id: enrollment.oleada.id,
      name: enrollment.oleada.name,
    },
    phase1GraduatedAt: enrollment.phase1GraduatedAt,
    status: enrollment.status,
    user: adminUserJson(enrollment.user),
    version: enrollment.version,
  };
}

function parseStoredAdminUser(value: Prisma.JsonValue | undefined): AdminUser | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const { email, fullName, id, isActive, mustChangePassword, roles, version } = value;

  if (
    typeof email !== 'string' ||
    typeof fullName !== 'string' ||
    typeof id !== 'string' ||
    typeof isActive !== 'boolean' ||
    typeof mustChangePassword !== 'boolean' ||
    !Array.isArray(roles) ||
    !roles.every(
      (role): role is RoleKey => typeof role === 'string' && ROLE_KEYS.has(role as RoleKey),
    ) ||
    typeof version !== 'number'
  ) {
    return null;
  }

  return {
    email,
    fullName,
    id,
    isActive,
    mustChangePassword,
    roles,
    version,
  };
}

function parseStoredEnrollment(value: Prisma.JsonValue): AdminEnrollment | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const {
    currentPhase,
    currentWeek,
    enrolledAt,
    id,
    oleada,
    phase1GraduatedAt,
    status,
    user,
    version,
  } = value;

  if (
    (currentPhase !== 'FASE_0' &&
      currentPhase !== 'FASE_1' &&
      currentPhase !== 'FASE_2' &&
      currentPhase !== 'FINISHED') ||
    (typeof currentWeek !== 'number' && currentWeek !== null) ||
    typeof enrolledAt !== 'string' ||
    typeof id !== 'string' ||
    typeof oleada !== 'object' ||
    oleada === null ||
    Array.isArray(oleada) ||
    (typeof phase1GraduatedAt !== 'string' && phase1GraduatedAt !== null) ||
    (status !== 'ACTIVE' && status !== 'WITHDRAWN' && status !== 'COMPLETED') ||
    typeof version !== 'number'
  ) {
    return null;
  }

  const storedUser = parseStoredAdminUser(user);

  if (typeof oleada.id !== 'string' || typeof oleada.name !== 'string' || storedUser === null) {
    return null;
  }

  return {
    currentPhase,
    currentWeek,
    enrolledAt,
    id,
    oleada: {
      id: oleada.id,
      name: oleada.name,
    },
    phase1GraduatedAt,
    status,
    user: storedUser,
    version,
  };
}

function enrollmentSnapshot(enrollment: AdminEnrollment): Prisma.InputJsonObject {
  return {
    currentPhase: enrollment.currentPhase,
    currentWeek: enrollment.currentWeek,
    oleadaId: enrollment.oleada.id,
    phase1GraduatedAt: enrollment.phase1GraduatedAt,
    status: enrollment.status,
    userId: enrollment.user.id,
    version: enrollment.version,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class AdminEnrollmentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    page: number,
    limit: number,
    filters: ListAdminEnrollmentFilters,
  ): Promise<AdminEnrollmentPage> {
    const skip = (page - 1) * limit;
    const where: Prisma.EnrollmentWhereInput = {
      oleada: {
        organizationId,
      },
      ...(filters.oleadaId === undefined ? {} : { oleadaId: filters.oleadaId }),
      ...(filters.phase === undefined ? {} : { currentPhase: filters.phase }),
      ...(filters.status === undefined ? {} : { status: filters.status }),
    };
    const [enrollments, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        include: adminEnrollmentInclude,
        orderBy: [{ enrolledAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return {
      data: enrollments.map(toAdminEnrollment),
      meta: {
        hasNextPage: skip + enrollments.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async create(input: CreateAdminEnrollmentInput): Promise<CreateAdminEnrollmentResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservation = await reserveIdempotency(transaction, {
          expiresAt: input.expiresAt,
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_ADMIN_ENROLLMENT_OPERATION,
          organizationId: input.organizationId,
          requestHash: input.requestHash,
        });

        if (reservation.kind === 'reused') {
          return { kind: 'idempotency_key_reused' };
        }

        if (reservation.kind === 'replay') {
          const enrollment = parseStoredEnrollment(reservation.responseBody);

          if (reservation.responseStatus !== 201 || enrollment === null) {
            throw new Error('The stored enrollment response is incomplete or invalid.');
          }

          return {
            enrollment,
            kind: 'replayed',
          };
        }

        const lockedOleada = await transaction.$queryRaw<
          readonly { capacity: number; status: string }[]
        >`
          SELECT "capacity", "status"::text
          FROM "oleada"
          WHERE "id" = ${input.oleadaId}::uuid
            AND "organization_id" = ${input.organizationId}::uuid
          FOR UPDATE
        `;

        if (lockedOleada.length === 0) {
          throw new CreateEnrollmentAbort({ kind: 'invalid_target' });
        }

        if (lockedOleada[0]?.status === 'CLOSED') {
          throw new CreateEnrollmentAbort({ kind: 'oleada_closed' });
        }

        const user = await transaction.user.findFirst({
          include: adminUserInclude,
          where: {
            id: input.userId,
            organizationId: input.organizationId,
          },
        });

        if (user === null) {
          throw new CreateEnrollmentAbort({ kind: 'invalid_target' });
        }

        if (
          !user.isActive ||
          !user.userRoles.some((userRole) => userRole.role.key === 'PARTICIPANT')
        ) {
          throw new CreateEnrollmentAbort({ kind: 'user_not_eligible' });
        }

        const existing = await transaction.enrollment.findUnique({
          where: {
            userId_oleadaId: {
              oleadaId: input.oleadaId,
              userId: input.userId,
            },
          },
        });

        if (existing !== null) {
          throw new CreateEnrollmentAbort({ kind: 'already_exists' });
        }

        const activeCount = await transaction.enrollment.count({
          where: {
            oleadaId: input.oleadaId,
            status: 'ACTIVE',
          },
        });
        const capacity = lockedOleada[0]?.capacity;

        if (capacity === undefined) {
          throw new Error('The locked oleada disappeared unexpectedly.');
        }

        if (activeCount >= capacity) {
          throw new CreateEnrollmentAbort({
            capacity,
            kind: 'capacity_reached',
          });
        }

        const stored = await transaction.enrollment.create({
          data: {
            currentPhase: input.currentPhase,
            id: randomUUID(),
            oleadaId: input.oleadaId,
            status: 'ACTIVE',
            userId: input.userId,
            version: 1,
          },
          include: adminEnrollmentInclude,
        });
        const enrollment = toAdminEnrollment(stored);
        await transaction.auditLog.create({
          data: {
            action: 'admin.enrollment_created',
            actorUserId: input.actorUserId,
            afterData: enrollmentSnapshot(enrollment),
            entityId: enrollment.id,
            entityType: 'ENROLLMENT',
            organizationId: input.organizationId,
            traceId: input.traceId,
          },
        });
        await completeIdempotency(transaction, {
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_ADMIN_ENROLLMENT_OPERATION,
          organizationId: input.organizationId,
          resourceId: enrollment.id,
          responseBody: enrollmentJson(enrollment),
          responseStatus: 201,
        });

        return {
          enrollment,
          kind: 'created',
        };
      });
    } catch (error: unknown) {
      if (error instanceof CreateEnrollmentAbort) {
        return error.result;
      }

      if (isUniqueConstraintError(error)) {
        return { kind: 'already_exists' };
      }

      throw error;
    }
  }

  update(input: UpdateAdminEnrollmentInput): Promise<UpdateAdminEnrollmentResult> {
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<readonly { id: string }[]>`
        SELECT enrollment."id"
        FROM "enrollment"
        INNER JOIN "oleada" ON "oleada"."id" = enrollment."oleada_id"
        WHERE enrollment."id" = ${input.enrollmentId}::uuid
          AND "oleada"."organization_id" = ${input.organizationId}::uuid
        FOR UPDATE OF enrollment
      `;

      if (locked.length === 0) {
        return { kind: 'not_found' };
      }

      const currentRecord = await transaction.enrollment.findUnique({
        include: adminEnrollmentInclude,
        where: {
          id: input.enrollmentId,
        },
      });

      if (currentRecord === null) {
        return { kind: 'not_found' };
      }

      const current = toAdminEnrollment(currentRecord);

      if (current.version !== input.expectedVersion) {
        return {
          currentVersion: current.version,
          kind: 'conflict',
        };
      }

      if (current.status !== 'ACTIVE') {
        return { kind: 'terminal' };
      }

      if (
        input.status !== undefined &&
        input.status !== current.status &&
        input.status !== 'WITHDRAWN' &&
        input.status !== 'COMPLETED'
      ) {
        return {
          currentStatus: current.status,
          kind: 'invalid_status_transition',
          requestedStatus: input.status,
        };
      }

      const resultingPhase = input.currentPhase ?? current.currentPhase;

      if (
        resultingPhase !== current.currentPhase &&
        nextPhase[current.currentPhase] !== resultingPhase
      ) {
        return {
          currentPhase: current.currentPhase,
          kind: 'invalid_phase_transition',
          requestedPhase: resultingPhase,
        };
      }

      const resultingWeek =
        resultingPhase === 'FASE_1'
          ? input.currentWeek === undefined
            ? current.currentWeek
            : input.currentWeek
          : input.currentWeek === undefined
            ? null
            : input.currentWeek;

      if (resultingPhase !== 'FASE_1' && resultingWeek !== null) {
        return {
          kind: 'phase_week_mismatch',
          phase: resultingPhase,
        };
      }

      const updatedRecord = await transaction.enrollment.update({
        data: {
          currentPhase: resultingPhase,
          currentWeek: resultingWeek,
          phase1GraduatedAt:
            current.currentPhase === 'FASE_1' && resultingPhase === 'FASE_2'
              ? new Date()
              : currentRecord.phase1GraduatedAt,
          status: input.status ?? current.status,
          version: {
            increment: 1,
          },
        },
        include: adminEnrollmentInclude,
        where: {
          id: input.enrollmentId,
        },
      });
      const enrollment = toAdminEnrollment(updatedRecord);
      await transaction.auditLog.create({
        data: {
          action: 'admin.enrollment_updated',
          actorUserId: input.actorUserId,
          afterData: enrollmentSnapshot(enrollment),
          beforeData: enrollmentSnapshot(current),
          entityId: enrollment.id,
          entityType: 'ENROLLMENT',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return {
        enrollment,
        kind: 'updated',
      };
    });
  }
}
