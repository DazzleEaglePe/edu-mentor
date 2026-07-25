import { Inject, Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { RoleKey } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  type AdminUser,
  type AdminUserPage,
  type UpdateAdminUserInput,
  type UpdateAdminUserResult,
} from './admin-user.js';

const adminUserInclude = {
  userRoles: {
    include: {
      role: true,
    },
  },
} as const satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof adminUserInclude }>;

function toAdminUser(user: UserWithRoles): AdminUser {
  return {
    email: user.email,
    fullName: user.fullName,
    id: user.id,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    roles: user.userRoles.map((userRole) => userRole.role.key).sort(),
    version: user.version,
  };
}

function userSnapshot(user: AdminUser): Prisma.InputJsonValue {
  return {
    fullName: user.fullName,
    isActive: user.isActive,
    roles: [...user.roles],
    version: user.version,
  };
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
