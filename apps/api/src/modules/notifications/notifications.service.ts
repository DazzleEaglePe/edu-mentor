import { Inject, Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import { ApiError } from '../../common/http/api-error.js';
import type { OutboxEventPage, OutboxEventView, SessionReminderPage, SessionReminderView } from './notifications-view.js';
import { NotificationsRepository } from './notifications.repository.js';

export interface ReminderListCommand {
  readonly limit: number;
  readonly page: number;
  readonly status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
}

export interface OutboxListCommand {
  readonly limit: number;
  readonly page: number;
}

export interface ProcessRemindersResult {
  readonly failedCount: number;
  readonly processedCount: number;
  readonly sentCount: number;
}

export interface ProcessOutboxResult {
  readonly processedCount: number;
  readonly publishedCount: number;
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(NotificationsRepository) private readonly repository: NotificationsRepository) {}

  async listReminders(principal: AuthPrincipal, command: ReminderListCommand): Promise<SessionReminderPage> {
    return this.repository.listReminders(principal, command.page, command.limit, command.status);
  }

  async listOutboxEvents(principal: AuthPrincipal, command: OutboxListCommand): Promise<OutboxEventPage> {
    return this.repository.listOutboxEvents(principal, command.page, command.limit);
  }

  async processPendingReminders(limit = 50): Promise<ProcessRemindersResult> {
    const claimed = await this.repository.claimPendingReminders(limit);
    let sentCount = 0;
    let failedCount = 0;

    for (const reminder of claimed) {
      try {
        // Simulated delivery mechanism (e.g. email/webhook transport)
        await this.repository.markReminderSent(reminder.id);
        sentCount += 1;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido al entregar notificación';
        await this.repository.markReminderFailed(reminder.id, errorMessage);
        failedCount += 1;
      }
    }

    return {
      failedCount,
      processedCount: claimed.length,
      sentCount,
    };
  }

  async publishOutboxEvents(limit = 50): Promise<ProcessOutboxResult> {
    const events = await this.repository.claimUnpublishedOutboxEvents(limit);
    let publishedCount = 0;

    for (const event of events) {
      // Durable publication to event hub/n8n
      await this.repository.markOutboxPublished(event.id);
      publishedCount += 1;
    }

    return {
      processedCount: events.length,
      publishedCount,
    };
  }

  async retryFailedReminder(
    principal: AuthPrincipal,
    reminderId: string,
  ): Promise<SessionReminderView> {
    const retried = await this.repository.retryFailedReminder(principal, reminderId);

    if (retried === null) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No encontramos el recordatorio en estado FAILED.');
    }

    return retried;
  }
}
