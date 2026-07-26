import type { ReminderStatus } from '../../generated/prisma/enums.js';

export interface SessionReminderView {
  readonly attemptCount: number;
  readonly channel: string;
  readonly id: string;
  readonly lastError: string | null;
  readonly recipientUserId: string;
  readonly scheduledFor: string;
  readonly sentAt: string | null;
  readonly sessionId: string;
  readonly status: ReminderStatus;
}

export interface SessionReminderPage {
  readonly data: readonly SessionReminderView[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}

export interface OutboxEventView {
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly attemptCount: number;
  readonly eventType: string;
  readonly id: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly publishedAt: string | null;
}

export interface OutboxEventPage {
  readonly data: readonly OutboxEventView[];
  readonly meta: {
    readonly hasNextPage: boolean;
    readonly limit: number;
    readonly page: number;
    readonly total: number;
  };
}
