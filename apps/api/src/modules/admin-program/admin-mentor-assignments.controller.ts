import {
  Body,
  Controller,
  Delete,
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
import type {
  AdminMentorAssignment,
  AdminMentorAssignmentPage,
} from './admin-mentor-assignment.js';
import { AdminMentorAssignmentsService } from './admin-mentor-assignments.service.js';
import { AdminMentorAssignmentQueryDto } from './dto/admin-mentor-assignment-query.dto.js';
import { CloseAdminMentorAssignmentQueryDto } from './dto/close-admin-mentor-assignment-query.dto.js';
import { CreateAdminMentorAssignmentDto } from './dto/create-admin-mentor-assignment.dto.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Roles('ADMIN')
@Controller('admin/mentor-assignments')
export class AdminMentorAssignmentsController {
  constructor(
    @Inject(AdminMentorAssignmentsService)
    private readonly assignments: AdminMentorAssignmentsService,
  ) {}

  @Get()
  list(
    @Query(createValidationPipe(AdminMentorAssignmentQueryDto))
    query: AdminMentorAssignmentQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminMentorAssignmentPage> {
    return this.assignments.list(requirePrincipal(request), query.page, query.limit, {
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.mentorUserId === undefined ? {} : { mentorUserId: query.mentorUserId }),
      ...(query.oleadaId === undefined ? {} : { oleadaId: query.oleadaId }),
    });
  }

  @Post()
  @HttpCode(201)
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(createValidationPipe(CreateAdminMentorAssignmentDto))
    body: CreateAdminMentorAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminMentorAssignment> {
    return this.assignments.create(requirePrincipal(request), {
      capability: body.capability,
      endsAt: body.endsAt ?? null,
      enrollmentId: body.enrollmentId ?? null,
      idempotencyKey,
      mentorUserId: body.mentorUserId,
      oleadaId: body.oleadaId,
      startsAt: body.startsAt,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Delete(':mentorAssignmentId')
  @HttpCode(204)
  close(
    @Param('mentorAssignmentId', new ParseUUIDPipe({ version: '4' }))
    mentorAssignmentId: string,
    @Query(createValidationPipe(CloseAdminMentorAssignmentQueryDto))
    query: CloseAdminMentorAssignmentQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.assignments.close(requirePrincipal(request), {
      expectedVersion: query.expectedVersion,
      mentorAssignmentId,
      traceId: getOrCreateTraceId(request),
    });
  }
}
