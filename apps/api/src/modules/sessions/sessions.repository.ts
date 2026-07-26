import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type {
  ConfirmationSummary,
  SessionListFilters,
  SessionPage,
  SessionSummaryView,
  SessionView,
} from './session-view.js';

export const sessionViewInclude = {
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
  participants: {
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
    orderBy: {
      enrollmentId: 'asc',
    },
  },
} as const satisfies Prisma.SessionInclude;

export type SessionWithRelations = Prisma.SessionGetPayload<{
  include: typeof sessionViewInclude;
}>;

interface SessionViewer {
  readonly userId: string;
}

function accessFilter(principal: AuthPrincipal): Prisma.SessionWhereInput {
  if (principal.roles.includes('ADMIN')) {
    return {
      oleada: {
        organizationId: principal.organization.id,
      },
    };
  }

  const scopes: Prisma.SessionWhereInput[] = [];

  if (principal.roles.includes('MENTOR')) {
    scopes.push({
      mentorUserId: principal.userId,
    });
  }

  if (principal.roles.includes('PARTICIPANT')) {
    scopes.push({
      participants: {
        some: {
          enrollment: {
            userId: principal.userId,
          },
        },
      },
    });
  }

  return {
    oleada: {
      organizationId: principal.organization.id,
    },
    ...(scopes.length === 0
      ? {
          id: {
            equals: '00000000-0000-4000-8000-000000000000',
          },
        }
      : {
          OR: scopes,
        }),
  };
}

function confirmationSummary(session: SessionWithRelations): ConfirmationSummary {
  let confirmed = 0;
  let declined = 0;
  let pending = 0;

  for (const participant of session.participants) {
    if (participant.confirmationStatus === 'CONFIRMED') {
      confirmed += 1;
    } else if (participant.confirmationStatus === 'DECLINED') {
      declined += 1;
    } else {
      pending += 1;
    }
  }

  return {
    confirmed,
    declined,
    pending,
    total: session.participants.length,
  };
}

function canConfirm(session: SessionWithRelations, principal: SessionViewer, now: Date): boolean {
  return (
    session.status === 'SCHEDULED' &&
    now.getTime() < session.confirmationClosesAt.getTime() &&
    session.participants.some((participant) => participant.enrollment.userId === principal.userId)
  );
}

function toSessionSummary(
  session: SessionWithRelations,
  principal: SessionViewer,
  now: Date,
): SessionSummaryView {
  return {
    canConfirm: canConfirm(session, principal, now),
    confirmationClosesAt: session.confirmationClosesAt.toISOString(),
    confirmationSummary: confirmationSummary(session),
    endsAt: session.endsAt.toISOString(),
    id: session.id,
    phase: session.phase,
    startsAt: session.startsAt.toISOString(),
    status: session.status,
    timezone: session.timezone,
    title: session.title,
    type: session.type,
  };
}

export function toSessionView(
  session: SessionWithRelations,
  principal: SessionViewer,
  now: Date,
): SessionView {
  return {
    ...toSessionSummary(session, principal, now),
    checkpointMonth: session.checkpointMonth,
    description: session.description,
    meetingUrl: session.meetingUrl,
    mentor: session.mentor,
    oleada: session.oleada,
    participants: session.participants.map((participant) => ({
      attendanceStatus: participant.attendanceStatus,
      confirmationStatus: participant.confirmationStatus,
      confirmedAt: participant.confirmedAt?.toISOString() ?? null,
      enrollmentId: participant.enrollmentId,
      participant: participant.enrollment.user,
      version: participant.version,
    })),
    rescheduledFromId: session.rescheduledFromId,
    version: session.version,
    weekNumber: session.weekNumber,
  };
}

function filterWhere(
  principal: AuthPrincipal,
  filters: SessionListFilters,
): Prisma.SessionWhereInput {
  const startsAt: Prisma.DateTimeFilter | undefined =
    filters.from === undefined && filters.to === undefined
      ? undefined
      : {
          ...(filters.from === undefined ? {} : { gte: filters.from }),
          ...(filters.to === undefined ? {} : { lt: filters.to }),
        };

  return {
    AND: [
      accessFilter(principal),
      {
        ...(filters.oleadaId === undefined ? {} : { oleadaId: filters.oleadaId }),
        ...(filters.phase === undefined ? {} : { phase: filters.phase }),
        ...(startsAt === undefined ? {} : { startsAt }),
        ...(filters.status === undefined ? {} : { status: filters.status }),
      },
    ],
  };
}

@Injectable()
export class SessionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    principal: AuthPrincipal,
    page: number,
    limit: number,
    filters: SessionListFilters,
    now = new Date(),
  ): Promise<SessionPage> {
    const skip = (page - 1) * limit;
    const where = filterWhere(principal, filters);
    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.session.findMany({
        include: sessionViewInclude,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.session.count({ where }),
    ]);

    return {
      data: sessions.map((session) => toSessionView(session, principal, now)),
      meta: {
        hasNextPage: skip + sessions.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async calendar(
    principal: AuthPrincipal,
    from: Date,
    to: Date,
    now = new Date(),
  ): Promise<readonly SessionSummaryView[]> {
    const sessions = await this.prisma.session.findMany({
      include: sessionViewInclude,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      where: filterWhere(principal, { from, to }),
    });

    return sessions.map((session) => toSessionSummary(session, principal, now));
  }

  async findById(
    principal: AuthPrincipal,
    sessionId: string,
    now = new Date(),
  ): Promise<SessionView | null> {
    const session = await this.prisma.session.findFirst({
      include: sessionViewInclude,
      where: {
        AND: [
          accessFilter(principal),
          {
            id: sessionId,
          },
        ],
      },
    });

    return session === null ? null : toSessionView(session, principal, now);
  }

  async listRescheduleRequests(
    principal: AuthPrincipal,
    page: number,
    limit: number,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
  ): Promise<import('./session-view.js').RescheduleRequestPage> {
    const skip = (page - 1) * limit;
    const where: Prisma.SessionRescheduleRequestWhereInput = {
      AND: [
        rescheduleRequestAccessFilter(principal),
        ...(status === undefined ? [] : [{ status }]),
      ],
    };

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.sessionRescheduleRequest.findMany({
        include: rescheduleRequestInclude,
        orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.sessionRescheduleRequest.count({ where }),
    ]);

    return {
      data: requests.map(toRescheduleRequestView),
      meta: {
        hasNextPage: skip + requests.length < total,
        limit,
        page,
        total,
      },
    };
  }
}

export const rescheduleRequestInclude = {
  requestedBy: {
    select: {
      fullName: true,
      id: true,
    },
  },
} as const satisfies Prisma.SessionRescheduleRequestInclude;

export type RescheduleRequestWithRelations = Prisma.SessionRescheduleRequestGetPayload<{
  include: typeof rescheduleRequestInclude;
}>;

export function toRescheduleRequestView(
  request: RescheduleRequestWithRelations,
): import('./session-view.js').RescheduleRequestView {
  return {
    decisionReason: request.decisionReason,
    id: request.id,
    proposedStartsAt: request.proposedStartsAt?.toISOString() ?? null,
    reason: request.reason,
    replacementSessionId: request.replacementSessionId,
    requestedAt: request.requestedAt.toISOString(),
    requestedBy: request.requestedBy,
    sessionId: request.sessionId,
    status: request.status,
    version: request.version,
  };
}

function rescheduleRequestAccessFilter(
  principal: AuthPrincipal,
): Prisma.SessionRescheduleRequestWhereInput {
  if (principal.roles.includes('ADMIN')) {
    return {
      session: {
        oleada: {
          organizationId: principal.organization.id,
        },
      },
    };
  }

  const scopes: Prisma.SessionRescheduleRequestWhereInput[] = [];

  if (principal.roles.includes('MENTOR')) {
    scopes.push({
      session: {
        mentorUserId: principal.userId,
      },
    });
  }

  if (principal.roles.includes('PARTICIPANT')) {
    scopes.push({
      requestedByUserId: principal.userId,
    });
  }

  return {
    session: {
      oleada: {
        organizationId: principal.organization.id,
      },
    },
    ...(scopes.length === 0
      ? {
          id: {
            equals: '00000000-0000-4000-8000-000000000000',
          },
        }
      : {
          OR: scopes,
        }),
  };
}

