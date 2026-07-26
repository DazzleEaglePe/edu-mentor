import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { Roles } from '../../common/auth/auth-metadata.js';
import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request.js';
import type { OutboxEventPage, SessionReminderPage, SessionReminderView } from './notifications-view.js';
import { NotificationsService, type ProcessOutboxResult, type ProcessRemindersResult } from './notifications.service.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Controller('admin')
@Roles('ADMIN')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get('reminders')
  listReminders(
    @Query('page') pageRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('status') status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED' | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionReminderPage> {
    const page = pageRaw === undefined ? 1 : Number.parseInt(pageRaw, 10) || 1;
    const limit = limitRaw === undefined ? 20 : Number.parseInt(limitRaw, 10) || 20;

    return this.notifications.listReminders(requirePrincipal(request), { limit, page, status });
  }

  @Get('outbox')
  listOutboxEvents(
    @Query('page') pageRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<OutboxEventPage> {
    const page = pageRaw === undefined ? 1 : Number.parseInt(pageRaw, 10) || 1;
    const limit = limitRaw === undefined ? 20 : Number.parseInt(limitRaw, 10) || 20;

    return this.notifications.listOutboxEvents(requirePrincipal(request), { limit, page });
  }

  @Post('reminders/:reminderId/retry')
  @HttpCode(200)
  retryFailedReminder(
    @Param('reminderId', new ParseUUIDPipe({ version: '4' })) reminderId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionReminderView> {
    return this.notifications.retryFailedReminder(requirePrincipal(request), reminderId);
  }

  @Post('notifications/process-reminders')
  @HttpCode(200)
  processReminders(
    @Query('limit') limitRaw: string | undefined,
  ): Promise<ProcessRemindersResult> {
    const limit = limitRaw === undefined ? 50 : Number.parseInt(limitRaw, 10) || 50;

    return this.notifications.processPendingReminders(limit);
  }

  @Post('notifications/publish-outbox')
  @HttpCode(200)
  publishOutbox(
    @Query('limit') limitRaw: string | undefined,
  ): Promise<ProcessOutboxResult> {
    const limit = limitRaw === undefined ? 50 : Number.parseInt(limitRaw, 10) || 50;

    return this.notifications.publishOutboxEvents(limit);
  }
}
