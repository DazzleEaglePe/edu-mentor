import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

const userContextInclude = {
  enrollments: {
    include: {
      oleada: true,
    },
    orderBy: {
      enrolledAt: 'desc',
    },
    take: 1,
    where: {
      status: 'ACTIVE',
    },
  },
  mentorProfile: {
    include: {
      capabilities: true,
    },
  },
  organization: true,
  userRoles: {
    include: {
      role: true,
    },
  },
} as const satisfies Prisma.UserInclude;

const sessionContextInclude = {
  user: {
    include: userContextInclude,
  },
} as const satisfies Prisma.AuthSessionInclude;

type UserWithContext = Prisma.UserGetPayload<{ include: typeof userContextInclude }>;
type SessionWithContext = Prisma.AuthSessionGetPayload<{
  include: typeof sessionContextInclude;
}>;

interface AuditInput {
  readonly action: string;
  readonly actorUserId: string | null;
  readonly after?: Prisma.InputJsonValue;
  readonly before?: Prisma.InputJsonValue;
  readonly entityId: string;
  readonly entityType: string;
  readonly organizationId: string;
  readonly traceId: string;
}

export interface LoginCandidate {
  readonly passwordHash: string;
  readonly userId: string;
}

export interface CreateSessionInput {
  readonly expiresAt: Date;
  readonly id: string;
  readonly ipHash: string;
  readonly refreshTokenHash: string;
  readonly tokenFamilyId: string;
  readonly traceId: string;
  readonly userAgent: string | null;
  readonly userId: string;
}

export interface RotateSessionInput {
  readonly newExpiresAt: Date;
  readonly newRefreshTokenHash: string;
  readonly newSessionId: string;
  readonly now: Date;
  readonly presentedRefreshTokenHash: string;
  readonly traceId: string;
  readonly userAgent: string | null;
}

export type RotateSessionResult =
  | {
      readonly kind: 'rotated';
      readonly principal: AuthPrincipal;
    }
  | {
      readonly kind: 'invalid';
    }
  | {
      readonly kind: 'reused';
    };

export interface ChangePasswordInput {
  readonly currentSessionId: string;
  readonly newPasswordHash: string;
  readonly now: Date;
  readonly traceId: string;
  readonly userId: string;
}

function toPrincipal(user: UserWithContext, sessionId: string): AuthPrincipal {
  const enrollment = user.enrollments[0];

  return {
    activeEnrollment:
      enrollment === undefined
        ? null
        : {
            currentPhase: enrollment.currentPhase,
            currentWeek: enrollment.currentWeek,
            id: enrollment.id,
            oleada: {
              id: enrollment.oleada.id,
              name: enrollment.oleada.name,
            },
          },
    email: user.email,
    fullName: user.fullName,
    mentorCapabilities:
      user.mentorProfile?.capabilities.map((capability) => capability.kind).sort() ?? [],
    mustChangePassword: user.mustChangePassword,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
    },
    roles: user.userRoles.map((userRole) => userRole.role.key).sort(),
    sessionId,
    userId: user.id,
  };
}

function sessionIsActive(session: SessionWithContext, now: Date): boolean {
  return (
    session.revokedAt === null &&
    session.expiresAt.getTime() > now.getTime() &&
    session.user.isActive &&
    session.user.organization.status === 'ACTIVE'
  );
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findLoginCandidate(normalizedEmail: string): Promise<LoginCandidate | null> {
    const candidates = await this.prisma.user.findMany({
      select: {
        id: true,
        passwordHash: true,
      },
      take: 2,
      where: {
        isActive: true,
        normalizedEmail,
        organization: {
          status: 'ACTIVE',
        },
      },
    });

    if (candidates.length !== 1 || candidates[0] === undefined) {
      return null;
    }

    return {
      passwordHash: candidates[0].passwordHash,
      userId: candidates[0].id,
    };
  }

  async createSession(input: CreateSessionInput): Promise<AuthPrincipal | null> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findFirst({
        include: userContextInclude,
        where: {
          id: input.userId,
          isActive: true,
          organization: {
            status: 'ACTIVE',
          },
        },
      });

      if (user === null) {
        return null;
      }

      await transaction.authSession.create({
        data: {
          expiresAt: input.expiresAt,
          id: input.id,
          ipHash: input.ipHash,
          refreshTokenHash: input.refreshTokenHash,
          tokenFamilyId: input.tokenFamilyId,
          userAgent: input.userAgent,
          userId: input.userId,
        },
      });
      await this.writeAudit(transaction, {
        action: 'auth.login_succeeded',
        actorUserId: input.userId,
        after: {
          sessionId: input.id,
        },
        entityId: input.id,
        entityType: 'AUTH_SESSION',
        organizationId: user.organizationId,
        traceId: input.traceId,
      });

      return toPrincipal(user, input.id);
    });
  }

  async findActivePrincipal(
    userId: string,
    sessionId: string,
    now = new Date(),
  ): Promise<AuthPrincipal | null> {
    const session = await this.prisma.authSession.findFirst({
      include: sessionContextInclude,
      where: {
        id: sessionId,
        userId,
      },
    });

    return session !== null && sessionIsActive(session, now)
      ? toPrincipal(session.user, session.id)
      : null;
  }

  async rotateSession(input: RotateSessionInput): Promise<RotateSessionResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT id
          FROM auth_session
          WHERE refresh_token_hash = ${input.presentedRefreshTokenHash}
          FOR UPDATE
        `;

        const current = await transaction.authSession.findUnique({
          include: sessionContextInclude,
          where: {
            refreshTokenHash: input.presentedRefreshTokenHash,
          },
        });

        if (current === null) {
          return { kind: 'invalid' };
        }

        if (
          current.revokedAt !== null ||
          current.replacedById !== null ||
          current.expiresAt.getTime() <= input.now.getTime()
        ) {
          if (current.replacedById !== null) {
            await transaction.authSession.updateMany({
              data: {
                revokedAt: input.now,
              },
              where: {
                revokedAt: null,
                tokenFamilyId: current.tokenFamilyId,
              },
            });
            await this.writeAudit(transaction, {
              action: 'auth.refresh_reuse_detected',
              actorUserId: current.userId,
              after: {
                tokenFamilyRevoked: true,
              },
              entityId: current.id,
              entityType: 'AUTH_SESSION',
              organizationId: current.user.organizationId,
              traceId: input.traceId,
            });

            return { kind: 'reused' };
          }

          return { kind: 'invalid' };
        }

        if (!current.user.isActive || current.user.organization.status !== 'ACTIVE') {
          await transaction.authSession.updateMany({
            data: {
              revokedAt: input.now,
            },
            where: {
              revokedAt: null,
              tokenFamilyId: current.tokenFamilyId,
            },
          });
          return { kind: 'invalid' };
        }

        await transaction.authSession.create({
          data: {
            expiresAt: input.newExpiresAt,
            id: input.newSessionId,
            ipHash: current.ipHash,
            refreshTokenHash: input.newRefreshTokenHash,
            tokenFamilyId: current.tokenFamilyId,
            userAgent: input.userAgent,
            userId: current.userId,
          },
        });
        await transaction.authSession.update({
          data: {
            lastUsedAt: input.now,
            replacedById: input.newSessionId,
            revokedAt: input.now,
          },
          where: {
            id: current.id,
          },
        });
        await this.writeAudit(transaction, {
          action: 'auth.session_rotated',
          actorUserId: current.userId,
          after: {
            replacedBySessionId: input.newSessionId,
          },
          before: {
            sessionId: current.id,
          },
          entityId: input.newSessionId,
          entityType: 'AUTH_SESSION',
          organizationId: current.user.organizationId,
          traceId: input.traceId,
        });

        return {
          kind: 'rotated',
          principal: toPrincipal(current.user, input.newSessionId),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async revokeCurrentSession(
    userId: string,
    sessionId: string,
    traceId: string,
    now = new Date(),
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const session = await transaction.authSession.findFirst({
        include: {
          user: true,
        },
        where: {
          id: sessionId,
          userId,
        },
      });

      if (session === null) {
        return;
      }

      await transaction.authSession.updateMany({
        data: {
          revokedAt: now,
        },
        where: {
          id: sessionId,
          revokedAt: null,
          userId,
        },
      });
      await this.writeAudit(transaction, {
        action: 'auth.logout',
        actorUserId: userId,
        after: {
          revoked: true,
        },
        entityId: sessionId,
        entityType: 'AUTH_SESSION',
        organizationId: session.user.organizationId,
        traceId,
      });
    });
  }

  async revokeAllSessions(userId: string, traceId: string, now = new Date()): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        select: {
          organizationId: true,
        },
        where: {
          id: userId,
        },
      });

      if (user === null) {
        return;
      }

      const result = await transaction.authSession.updateMany({
        data: {
          revokedAt: now,
        },
        where: {
          revokedAt: null,
          userId,
        },
      });
      await this.writeAudit(transaction, {
        action: 'auth.logout_all',
        actorUserId: userId,
        after: {
          revokedSessionCount: result.count,
        },
        entityId: userId,
        entityType: 'USER',
        organizationId: user.organizationId,
        traceId,
      });
    });
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      select: {
        passwordHash: true,
      },
      where: {
        id: userId,
      },
    });

    return user?.passwordHash ?? null;
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const previousUser = await transaction.user.findUniqueOrThrow({
        select: {
          mustChangePassword: true,
          organizationId: true,
        },
        where: {
          id: input.userId,
        },
      });

      await transaction.user.update({
        data: {
          mustChangePassword: false,
          passwordHash: input.newPasswordHash,
          version: {
            increment: 1,
          },
        },
        where: {
          id: input.userId,
        },
      });

      const revoked = await transaction.authSession.updateMany({
        data: {
          revokedAt: input.now,
        },
        where: {
          id: {
            not: input.currentSessionId,
          },
          revokedAt: null,
          userId: input.userId,
        },
      });
      await this.writeAudit(transaction, {
        action: 'auth.password_changed',
        actorUserId: input.userId,
        after: {
          mustChangePassword: false,
          revokedOtherSessionCount: revoked.count,
        },
        before: {
          mustChangePassword: previousUser.mustChangePassword,
        },
        entityId: input.userId,
        entityType: 'USER',
        organizationId: previousUser.organizationId,
        traceId: input.traceId,
      });
    });
  }

  private writeAudit(transaction: Prisma.TransactionClient, input: AuditInput): Promise<unknown> {
    return transaction.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        entityId: input.entityId,
        entityType: input.entityType,
        organizationId: input.organizationId,
        traceId: input.traceId,
        ...(input.after === undefined ? {} : { afterData: input.after }),
        ...(input.before === undefined ? {} : { beforeData: input.before }),
      },
    });
  }
}
