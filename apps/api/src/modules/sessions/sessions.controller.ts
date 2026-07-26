import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';

import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request.js';
import { createValidationPipe } from '../../configure-http-app.js';
import { SessionCalendarQueryDto } from './dto/session-calendar-query.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';
import type { SessionPage, SessionSummaryView, SessionView } from './session-view.js';
import { SessionsService } from './sessions.service.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Controller('sessions')
export class SessionsController {
  constructor(@Inject(SessionsService) private readonly sessions: SessionsService) {}

  @Get()
  list(
    @Query(createValidationPipe(SessionListQueryDto))
    query: SessionListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionPage> {
    return this.sessions.list(requirePrincipal(request), {
      limit: query.limit,
      page: query.page,
      ...(query.from === undefined ? {} : { from: query.from }),
      ...(query.oleadaId === undefined ? {} : { oleadaId: query.oleadaId }),
      ...(query.phase === undefined ? {} : { phase: query.phase }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.to === undefined ? {} : { to: query.to }),
    });
  }

  @Get('calendar')
  calendar(
    @Query(createValidationPipe(SessionCalendarQueryDto))
    query: SessionCalendarQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<readonly SessionSummaryView[]> {
    return this.sessions.calendar(requirePrincipal(request), query.from, query.to);
  }

  @Get(':sessionId')
  get(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionView> {
    return this.sessions.get(requirePrincipal(request), sessionId);
  }
}
