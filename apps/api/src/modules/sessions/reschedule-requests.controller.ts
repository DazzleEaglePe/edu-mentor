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
  Query,
  Req,
} from '@nestjs/common';

import { Roles } from '../../common/auth/auth-metadata.js';
import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request.js';
import { getOrCreateTraceId } from '../../common/http/trace-id.js';
import { createValidationPipe } from '../../configure-http-app.js';
import { ApproveRescheduleRequestDto } from './dto/approve-reschedule-request.dto.js';
import { ReasonedTransitionDto } from './dto/reasoned-transition.dto.js';
import { RescheduleRequestListQueryDto } from './dto/reschedule-request-list-query.dto.js';
import { VersionedRequestDto } from './dto/versioned-request.dto.js';
import type { RescheduleRequestPage, RescheduleRequestView, SessionView } from './session-view.js';
import { SessionsService } from './sessions.service.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Controller('reschedule-requests')
export class RescheduleRequestsController {
  constructor(@Inject(SessionsService) private readonly sessions: SessionsService) {}

  @Get()
  list(
    @Query(createValidationPipe(RescheduleRequestListQueryDto))
    query: RescheduleRequestListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RescheduleRequestPage> {
    return this.sessions.listRescheduleRequests(requirePrincipal(request), {
      limit: query.limit,
      page: query.page,
      ...(query.status === undefined ? {} : { status: query.status }),
    });
  }

  @Post(':requestId/approve')
  @HttpCode(201)
  @Roles('ADMIN', 'MENTOR')
  approve(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body(createValidationPipe(ApproveRescheduleRequestDto))
    body: ApproveRescheduleRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{
    readonly replacementSession: SessionView;
    readonly request: RescheduleRequestView;
  }> {
    return this.sessions.approveRescheduleRequest(requirePrincipal(request), {
      durationMinutes: body.durationMinutes,
      expectedRequestVersion: body.expectedRequestVersion,
      expectedSessionVersion: body.expectedSessionVersion,
      idempotencyKey,
      meetingUrl: body.meetingUrl,
      requestId,
      startsAt: body.startsAt,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post(':requestId/reject')
  @HttpCode(200)
  @Roles('ADMIN', 'MENTOR')
  reject(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body(createValidationPipe(ReasonedTransitionDto))
    body: ReasonedTransitionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RescheduleRequestView> {
    return this.sessions.rejectRescheduleRequest(requirePrincipal(request), {
      reason: body.reason,
      requestId,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Post(':requestId/cancel')
  @HttpCode(200)
  @Roles('PARTICIPANT')
  cancel(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body(createValidationPipe(VersionedRequestDto))
    body: VersionedRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RescheduleRequestView> {
    return this.sessions.cancelOwnRescheduleRequest(requirePrincipal(request), {
      expectedVersion: body.expectedVersion,
      requestId,
      traceId: getOrCreateTraceId(request),
    });
  }
}
