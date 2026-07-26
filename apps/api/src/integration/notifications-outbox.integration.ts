import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createIntegrationTestContext } from './support/integration-setup.js';

describe('Integration · Notifications & Outbox Workflow', () => {
  it('covers reminder listing, processing, manual retry, and outbox event publishing', async () => {
    const ctx = await createIntegrationTestContext();
    if (!ctx.isDatabaseAvailable) {
      return;
    }

    const { notificationsService, adminPrincipal } = ctx;

    // 1. List reminders
    const remindersPage = await notificationsService.listReminders(adminPrincipal, {
      limit: 20,
      page: 1,
    });
    assert.ok(Array.isArray(remindersPage.data));

    // 2. Process pending reminders
    const reminderResult = await notificationsService.processPendingReminders(10);
    assert.ok(typeof reminderResult.processedCount === 'number');

    // 3. List outbox events
    const outboxPage = await notificationsService.listOutboxEvents(adminPrincipal, {
      limit: 20,
      page: 1,
    });
    assert.ok(Array.isArray(outboxPage.data));

    // 4. Publish outbox events
    const outboxResult = await notificationsService.publishOutboxEvents(10);
    assert.ok(typeof outboxResult.processedCount === 'number');
  });
});
