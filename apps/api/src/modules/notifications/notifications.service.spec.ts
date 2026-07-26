import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { OutboxEventView, SessionReminderView } from './notifications-view.js';
import type { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';

const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const adminPrincipal: AuthPrincipal = {
  activeEnrollment: null,
  email: 'admin@example.test',
  fullName: 'Admin User',
  mentorCapabilities: [],
  mustChangePassword: false,
  organization: {
    id: ORGANIZATION_ID,
    name: 'Organization',
  },
  roles: ['ADMIN'],
  sessionId: '77777777-7777-4777-8777-777777777777',
  userId: USER_ID,
};

const reminder: SessionReminderView = {
  attemptCount: 0,
  channel: 'EMAIL',
  id: '11111111-2222-3333-4444-555555555555',
  lastError: null,
  recipientUserId: USER_ID,
  scheduledFor: '2026-08-12T19:00:00.000Z',
  sentAt: null,
  sessionId: '33333333-3333-4333-8333-333333333333',
  status: 'PENDING',
};

const outboxEvent: OutboxEventView = {
  aggregateId: '33333333-3333-4333-8333-333333333333',
  aggregateType: 'SESSION',
  attemptCount: 0,
  eventType: 'session.completed',
  id: '66666666-7777-8888-9999-000000000000',
  idempotencyKey: 'session:33333333:completed:v2',
  occurredAt: '2026-08-12T20:45:00.000Z',
  publishedAt: null,
};

function createService(repositoryOverridden?: Partial<NotificationsRepository>) {
  const repository = {
    claimPendingReminders: async () => [reminder],
    claimUnpublishedOutboxEvents: async () => [outboxEvent],
    listOutboxEvents: async () => ({
      data: [outboxEvent],
      meta: { hasNextPage: false, limit: 20, page: 1, total: 1 },
    }),
    listReminders: async () => ({
      data: [reminder],
      meta: { hasNextPage: false, limit: 20, page: 1, total: 1 },
    }),
    markOutboxPublished: async () => ({ ...outboxEvent, publishedAt: '2026-08-12T20:46:00.000Z' }),
    markReminderFailed: async () => ({ ...reminder, status: 'FAILED' }),
    markReminderSent: async () => ({ ...reminder, sentAt: '2026-08-12T19:01:00.000Z', status: 'SENT' }),
    retryFailedReminder: async () => ({ ...reminder, status: 'PENDING' }),
    ...repositoryOverridden,
  };

  return new NotificationsService(repository as unknown as NotificationsRepository);
}

describe('NotificationsService', () => {
  it('lists reminders and outbox events', async () => {
    const service = createService();

    const reminders = await service.listReminders(adminPrincipal, { limit: 20, page: 1 });
    assert.equal(reminders.data.length, 1);

    const outbox = await service.listOutboxEvents(adminPrincipal, { limit: 20, page: 1 });
    assert.equal(outbox.data.length, 1);
  });

  it('processes pending reminders and marks sent', async () => {
    const service = createService();

    const result = await service.processPendingReminders(10);
    assert.equal(result.processedCount, 1);
    assert.equal(result.sentCount, 1);
    assert.equal(result.failedCount, 0);
  });

  it('publishes outbox events', async () => {
    const service = createService();

    const result = await service.publishOutboxEvents(10);
    assert.equal(result.processedCount, 1);
    assert.equal(result.publishedCount, 1);
  });

  it('retries failed reminders and throws 404 if not found', async () => {
    const service = createService();

    const retried = await service.retryFailedReminder(adminPrincipal, reminder.id);
    assert.equal(retried.status, 'PENDING');

    const notFoundService = createService({
      retryFailedReminder: async () => null,
    });

    const error = await notFoundService.retryFailedReminder(adminPrincipal, reminder.id).then(
      () => null,
      (err: unknown) => err,
    );

    assert.ok(error instanceof ApiError);
    assert.equal(error.getStatus(), 404);
  });
});
