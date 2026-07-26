import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import { Roles } from '../../common/auth/auth-metadata.js';
import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request.js';
import { getOrCreateTraceId } from '../../common/http/trace-id.js';
import { createValidationPipe } from '../../configure-http-app.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionCalendarQueryDto } from './dto/session-calendar-query.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';
import { SetSessionConfirmationDto } from './dto/set-session-confirmation.dto.js';
import { SetSessionAttendanceDto } from './dto/set-session-attendance.dto.js';
import type {
  SessionPage,
  SessionParticipantView,
  SessionSummaryView,
  SessionView,
} from './session-view.js';
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

  @Post()
  @HttpCode(201)
  @Roles('ADMIN', 'MENTOR')
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(createValidationPipe(CreateSessionDto)) body: CreateSessionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionView> {
    return this.sessions.create(requirePrincipal(request), {
      durationMinutes: body.durationMinutes,
      enrollmentIds: body.enrollmentIds,
      idempotencyKey,
      oleadaId: body.oleadaId,
      phase: body.phase,
      startsAt: body.startsAt,
      timezone: body.timezone,
      title: body.title,
      traceId: getOrCreateTraceId(request),
      type: body.type,
      ...(body.checkpointMonth === undefined ? {} : { checkpointMonth: body.checkpointMonth }),
      ...(body.description === undefined ? {} : { description: body.description }),
      ...(body.meetingUrl === undefined ? {} : { meetingUrl: body.meetingUrl }),
      ...(body.mentorUserId === undefined ? {} : { mentorUserId: body.mentorUserId }),
      ...(body.weekNumber === undefined ? {} : { weekNumber: body.weekNumber }),
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

  @Put(':sessionId/participants/me/confirmation')
  @Roles('PARTICIPANT')
  setOwnConfirmation(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body(createValidationPipe(SetSessionConfirmationDto))
    body: SetSessionConfirmationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionParticipantView> {
    return this.sessions.setOwnConfirmation(requirePrincipal(request), {
      expectedVersion: body.expectedVersion,
      sessionId,
      status: body.status,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Put(':sessionId/participants/:enrollmentId/attendance')
  @Roles('ADMIN', 'MENTOR')
  setParticipantAttendance(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('enrollmentId', new ParseUUIDPipe({ version: '4' })) enrollmentId: string,
    @Body(createValidationPipe(SetSessionAttendanceDto))
    body: SetSessionAttendanceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionParticipantView> {
    return this.sessions.setParticipantAttendance(requirePrincipal(request), {
      enrollmentId,
      expectedVersion: body.expectedVersion,
      sessionId,
      status: body.status,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post(':sessionId/complete')
  @HttpCode(200)
  @Roles('ADMIN', 'MENTOR')
  complete(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body(createValidationPipe(import('./dto/complete-session.dto.js').CompleteSessionDto))
    body: import('./dto/complete-session.dto.js').CompleteSessionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionView> {
    return this.sessions.complete(requirePrincipal(request), {
      expectedVersion: body.expectedVersion,
      sessionId,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post(':sessionId/cancel')
  @HttpCode(200)
  @Roles('ADMIN', 'MENTOR')
  cancel(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body(createValidationPipe(import('./dto/cancel-session.dto.js').CancelSessionDto))
    body: import('./dto/cancel-session.dto.js').CancelSessionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionView> {
    return this.sessions.cancel(requirePrincipal(request), {
      expectedVersion: body.expectedVersion,
      reason: body.reason,
      sessionId,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post(':sessionId/reschedule')
  @HttpCode(201)
  @Roles('ADMIN', 'MENTOR')
  reschedule(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body(createValidationPipe(import('./dto/reschedule-session.dto.js').RescheduleSessionDto))
    body: import('./dto/reschedule-session.dto.js').RescheduleSessionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionView> {
    return this.sessions.reschedule(requirePrincipal(request), {
      durationMinutes: body.durationMinutes,
      expectedVersion: body.expectedVersion,
      idempotencyKey,
      meetingUrl: body.meetingUrl,
      reason: body.reason,
      sessionId,
      startsAt: body.startsAt,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post(':sessionId/reschedule-requests')
  @HttpCode(201)
  @Roles('PARTICIPANT')
  createRescheduleRequest(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body(
      createValidationPipe(
        import('./dto/create-reschedule-request.dto.js').CreateRescheduleRequestDto,
      ),
    )
    body: import('./dto/create-reschedule-request.dto.js').CreateRescheduleRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<import('./session-view.js').RescheduleRequestView> {
    return this.sessions.createRescheduleRequest(requirePrincipal(request), {
      idempotencyKey,
      proposedStartsAt: body.proposedStartsAt,
      reason: body.reason,
      sessionId,
      traceId: getOrCreateTraceId(request),
    });
  }
}

