import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  completeIdempotency,
  reserveIdempotency,
} from '../../common/idempotency/idempotency-transaction.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RoleKey } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  type AdminUser,
  type AdminUserPage,
  type CreateAdminUserInput,
  type CreateAdminUserResult,
  type ResetAdminUserPasswordInput,
  type ResetAdminUserPasswordResult,
  type UpdateAdminUserInput,
  type UpdateAdminUserResult,
} from './admin-user.js';
import { adminUserInclude, toAdminUser, userSnapshot } from './admin-user-mapper.js';

const CREATE_ADMIN_USER_OPERATION = 'admin.users.create';
const ROLE_KEYS = new Set<RoleKey>(['ADMIN', 'MENTOR', 'PARTICIPANT']);

function userResponse(user: AdminUser): Prisma.InputJsonObject {
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

function parseStoredUser(value: Prisma.JsonValue | null): AdminUser | null {
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

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class AdminUsersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(organizationId: string, page: number, limit: number): Promise<AdminUserPage> {
    const skip = (page - 1) * limit;
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: adminUserInclude,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
        where: {
          organizationId,
        },
      }),
      this.prisma.user.count({
        where: {
          organizationId,
        },
      }),
    ]);

    return {
      data: users.map(toAdminUser),
      meta: {
        hasNextPage: skip + users.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async findOrganizationId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      select: {
        organizationId: true,
      },
      where: {
        id: userId,
      },
    });

    return user?.organizationId ?? null;
  }

  async create(input: CreateAdminUserInput): Promise<CreateAdminUserResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservation = await reserveIdempotency(transaction, {
          expiresAt: input.expiresAt,
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_ADMIN_USER_OPERATION,
          organizationId: input.organizationId,
          requestHash: input.requestHash,
        });

        if (reservation.kind === 'reused') {
          return { kind: 'idempotency_key_reused' };
        }

        if (reservation.kind === 'replay') {
          const user = parseStoredUser(reservation.responseBody);

          if (reservation.responseStatus !== 201 || user === null) {
            throw new Error('The stored idempotency response is incomplete or invalid.');
          }

          return {
            kind: 'replayed',
            user,
          };
        }

        const createdRecord = await transaction.user.create({
          data: {
            email: input.email,
            fullName: input.fullName,
            id: randomUUID(),
            isActive: true,
            mustChangePassword: true,
            normalizedEmail: input.email,
            organizationId: input.organizationId,
            passwordHash: input.passwordHash,
            version: 1,
          },
          include: adminUserInclude,
        });
        await this.replaceRoles(transaction, input.actorUserId, createdRecord.id, input.roles);

        const storedRecord = await transaction.user.findUnique({
          include: adminUserInclude,
          where: {
            id: createdRecord.id,
          },
        });

        if (storedRecord === null) {
          throw new Error('The newly created user disappeared unexpectedly.');
        }

        const user = toAdminUser(storedRecord);
        await transaction.auditLog.create({
          data: {
            action: 'admin.user_created',
            actorUserId: input.actorUserId,
            afterData: userSnapshot(user),
            entityId: user.id,
            entityType: 'USER',
            organizationId: input.organizationId,
            traceId: input.traceId,
          },
        });
        await completeIdempotency(transaction, {
          keyHash: input.idempotencyKeyHash,
          operation: CREATE_ADMIN_USER_OPERATION,
          organizationId: input.organizationId,
          resourceId: user.id,
          responseBody: userResponse(user),
          responseStatus: 201,
        });

        return {
          kind: 'created',
          user,
        };
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return { kind: 'email_conflict' };
      }

      throw error;
    }
  }

  async update(input: UpdateAdminUserInput): Promise<UpdateAdminUserResult> {
    return this.prisma.$transaction(async (transaction) => {
      const currentRecord = await transaction.user.findFirst({
        include: adminUserInclude,
        where: {
          id: input.userId,
          organizationId: input.organizationId,
        },
      });

      if (currentRecord === null) {
        return { kind: 'not_found' };
      }

      const current = toAdminUser(currentRecord);
      const updateData: Prisma.UserUpdateManyMutationInput = {
        version: {
          increment: 1,
        },
        ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      };
      const updated = await transaction.user.updateMany({
        data: updateData,
        where: {
          id: input.userId,
          organizationId: input.organizationId,
          version: input.expectedVersion,
        },
      });

      if (updated.count !== 1) {
        const latest = await transaction.user.findFirst({
          select: {
            version: true,
          },
          where: {
            id: input.userId,
            organizationId: input.organizationId,
          },
        });

        return latest === null
          ? { kind: 'not_found' }
          : { currentVersion: latest.version, kind: 'conflict' };
      }

      if (input.roles !== undefined) {
        await this.replaceRoles(transaction, input.actorUserId, input.userId, input.roles);
      }

      if (input.isActive === false) {
        await transaction.authSession.updateMany({
          data: {
            revokedAt: new Date(),
          },
          where: {
            revokedAt: null,
            userId: input.userId,
          },
        });
      }

      const updatedRecord = await transaction.user.findFirst({
        include: adminUserInclude,
        where: {
          id: input.userId,
          organizationId: input.organizationId,
        },
      });

      if (updatedRecord === null) {
        return { kind: 'not_found' };
      }

      const user = toAdminUser(updatedRecord);
      await transaction.auditLog.create({
        data: {
          action: 'admin.user_updated',
          actorUserId: input.actorUserId,
          afterData: userSnapshot(user),
          beforeData: userSnapshot(current),
          entityId: input.userId,
          entityType: 'USER',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return {
        kind: 'updated',
        user,
      };
    });
  }

  async resetPassword(input: ResetAdminUserPasswordInput): Promise<ResetAdminUserPasswordResult> {
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<readonly { id: string }[]>`
        SELECT "id"
        FROM "user"
        WHERE "id" = ${input.userId}::uuid
          AND "organization_id" = ${input.organizationId}::uuid
        FOR UPDATE
      `;

      if (locked.length === 0) {
        return { kind: 'not_found' };
      }

      const current = await transaction.user.findUnique({
        select: {
          mustChangePassword: true,
          version: true,
        },
        where: {
          id: input.userId,
        },
      });

      if (current === null) {
        return { kind: 'not_found' };
      }

      const updated = await transaction.user.update({
        data: {
          mustChangePassword: true,
          passwordHash: input.passwordHash,
          version: {
            increment: 1,
          },
        },
        select: {
          mustChangePassword: true,
          version: true,
        },
        where: {
          id: input.userId,
        },
      });
      const sessions = await transaction.authSession.updateMany({
        data: {
          revokedAt: new Date(),
        },
        where: {
          revokedAt: null,
          userId: input.userId,
        },
      });
      await transaction.auditLog.create({
        data: {
          action: 'admin.user_password_reset',
          actorUserId: input.actorUserId,
          afterData: {
            mustChangePassword: updated.mustChangePassword,
            sessionsRevoked: sessions.count,
            version: updated.version,
          },
          beforeData: {
            mustChangePassword: current.mustChangePassword,
            version: current.version,
          },
          entityId: input.userId,
          entityType: 'USER',
          organizationId: input.organizationId,
          traceId: input.traceId,
        },
      });

      return {
        kind: 'reset',
        sessionsRevoked: sessions.count,
      };
    });
  }

  private async replaceRoles(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    userId: string,
    roleKeys: readonly RoleKey[],
  ): Promise<void> {
    const roles = await transaction.role.findMany({
      select: {
        id: true,
        key: true,
      },
      where: {
        key: {
          in: [...roleKeys],
        },
      },
    });

    if (roles.length !== roleKeys.length) {
      throw new Error('The role reference data is incomplete.');
    }

    await transaction.userRole.deleteMany({
      where: {
        userId,
      },
    });
    await transaction.userRole.createMany({
      data: roles.map((role) => ({
        assignedByUserId: actorUserId,
        roleId: role.id,
        userId,
      })),
    });

    if (roleKeys.includes('MENTOR')) {
      await transaction.mentorProfile.upsert({
        create: {
          userId,
        },
        update: {},
        where: {
          userId,
        },
      });
    }
  }
}
