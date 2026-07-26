import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type {
  OutboxEventPage,
  OutboxEventView,
  SessionReminderPage,
  SessionReminderView,
} from './notifications-view.js';

export function toReminderView(r: Prisma.SessionReminderGetPayload<object>): SessionReminderView {
  return {
    attemptCount: r.attemptCount,
    channel: r.channel,
    id: r.id,
    lastError: r.lastError,
    recipientUserId: r.recipientUserId,
    scheduledFor: r.scheduledFor.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
    sessionId: r.sessionId,
    status: r.status,
  };
}

export function toOutboxView(e: Prisma.OutboxEventGetPayload<object>): OutboxEventView {
  return {
    aggregateId: e.aggregateId,
    aggregateType: e.aggregateType,
    attemptCount: e.attemptCount,
    eventType: e.eventType,
    id: e.id,
    idempotencyKey: e.idempotencyKey,
    occurredAt: e.occurredAt.toISOString(),
    publishedAt: e.publishedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listReminders(
    principal: AuthPrincipal,
    page: number,
    limit: number,
    status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED',
  ): Promise<SessionReminderPage> {
    const skip = (page - 1) * limit;
    const where: Prisma.SessionReminderWhereInput = {
      session: {
        oleada: {
          organizationId: principal.organization.id,
        },
      },
      ...(status === undefined ? {} : { status }),
    };

    const [reminders, total] = await this.prisma.$transaction([
      this.prisma.sessionReminder.findMany({
        orderBy: [{ scheduledFor: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.sessionReminder.count({ where }),
    ]);

    return {
      data: reminders.map(toReminderView),
      meta: {
        hasNextPage: skip + reminders.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async listOutboxEvents(
    principal: AuthPrincipal,
    page: number,
    limit: number,
  ): Promise<OutboxEventPage> {
    const skip = (page - 1) * limit;
    const where: Prisma.OutboxEventWhereInput = {
      organizationId: principal.organization.id,
    };

    const [events, total] = await this.prisma.$transaction([
      this.prisma.outboxEvent.findMany({
        orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        where,
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);

    return {
      data: events.map(toOutboxView),
      meta: {
        hasNextPage: skip + events.length < total,
        limit,
        page,
        total,
      },
    };
  }

  async claimPendingReminders(
    limit: number,
    lockDurationMs = 300_000,
    now = new Date(),
  ): Promise<readonly SessionReminderView[]> {
    return this.prisma.$transaction(async (transaction) => {
      const lockExpiresAt = new Date(now.getTime() + lockDurationMs);

      const eligible = await transaction.sessionReminder.findMany({
        select: { id: true },
        take: limit,
        where: {
          OR: [
            {
              scheduledFor: { lte: now },
              status: 'PENDING',
            },
            {
              lockExpiresAt: { lte: now },
              status: 'PROCESSING',
            },
          ],
        },
      });

      if (eligible.length === 0) {
        return [];
      }

      const ids = eligible.map((e) => e.id);

      await transaction.sessionReminder.updateMany({
        data: {
          lockExpiresAt,
          status: 'PROCESSING',
        },
        where: { id: { in: ids } },
      });

      const claimed = await transaction.sessionReminder.findMany({
        where: { id: { in: ids } },
      });

      return claimed.map(toReminderView);
    });
  }

  async markReminderSent(reminderId: string, now = new Date()): Promise<SessionReminderView | null> {
    const updated = await this.prisma.sessionReminder.update({
      data: {
        lockExpiresAt: null,
        sentAt: now,
        status: 'SENT',
      },
      where: { id: reminderId },
    });

    return toReminderView(updated);
  }

  async markReminderFailed(
    reminderId: string,
    error: string,
    maxAttempts = 3,
  ): Promise<SessionReminderView | null> {
    const current = await this.prisma.sessionReminder.findUnique({
      where: { id: reminderId },
    });

    if (current === null) {
      return null;
    }

    const nextAttemptCount = current.attemptCount + 1;
    const isFinalFailure = nextAttemptCount >= maxAttempts;

    const updated = await this.prisma.sessionReminder.update({
      data: {
        attemptCount: nextAttemptCount,
        lastError: error.slice(0, 1000),
        lockExpiresAt: null,
        status: isFinalFailure ? 'FAILED' : 'PENDING',
      },
      where: { id: reminderId },
    });

    return toReminderView(updated);
  }

  async retryFailedReminder(
    principal: AuthPrincipal,
    reminderId: string,
  ): Promise<SessionReminderView | null> {
    const reminder = await this.prisma.sessionReminder.findFirst({
      where: {
        id: reminderId,
        session: { oleada: { organizationId: principal.organization.id } },
      },
    });

    if (reminder === null || reminder.status !== 'FAILED') {
      return null;
    }

    const updated = await this.prisma.sessionReminder.update({
      data: {
        attemptCount: 0,
        lastError: null,
        status: 'PENDING',
      },
      where: { id: reminderId },
    });

    return toReminderView(updated);
  }

  async claimUnpublishedOutboxEvents(
    limit: number,
  ): Promise<readonly OutboxEventView[]> {
    const events = await this.prisma.outboxEvent.findMany({
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: limit,
      where: { publishedAt: null },
    });

    return events.map(toOutboxView);
  }

  async markOutboxPublished(eventId: string, now = new Date()): Promise<OutboxEventView | null> {
    const updated = await this.prisma.outboxEvent.update({
      data: { publishedAt: now },
      where: { id: eventId },
    });

    return toOutboxView(updated);
  }
}
