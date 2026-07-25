import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { Roles } from '../../common/auth/auth-metadata.js';
import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request.js';
import { getOrCreateTraceId } from '../../common/http/trace-id.js';
import { createValidationPipe } from '../../configure-http-app.js';
import type { AdminEnrollment, AdminEnrollmentPage } from './admin-enrollment.js';
import { AdminEnrollmentsService } from './admin-enrollments.service.js';
import { AdminEnrollmentQueryDto } from './dto/admin-enrollment-query.dto.js';
import { CreateAdminEnrollmentDto } from './dto/create-admin-enrollment.dto.js';
import { UpdateAdminEnrollmentDto } from './dto/update-admin-enrollment.dto.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Roles('ADMIN')
@Controller('admin/enrollments')
export class AdminEnrollmentsController {
  constructor(
    @Inject(AdminEnrollmentsService)
    private readonly enrollments: AdminEnrollmentsService,
  ) {}

  @Get()
  list(
    @Query(createValidationPipe(AdminEnrollmentQueryDto))
    query: AdminEnrollmentQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminEnrollmentPage> {
    return this.enrollments.list(requirePrincipal(request), query.page, query.limit, {
      ...(query.oleadaId === undefined ? {} : { oleadaId: query.oleadaId }),
      ...(query.phase === undefined ? {} : { phase: query.phase }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
  }

  @Post()
  @HttpCode(201)
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(createValidationPipe(CreateAdminEnrollmentDto))
    body: CreateAdminEnrollmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminEnrollment> {
    return this.enrollments.create(requirePrincipal(request), {
      currentPhase: body.currentPhase,
      idempotencyKey,
      oleadaId: body.oleadaId,
      traceId: getOrCreateTraceId(request),
      userId: body.userId,
    });
  }

  @Patch(':enrollmentId')
  update(
    @Param('enrollmentId', new ParseUUIDPipe({ version: '4' }))
    enrollmentId: string,
    @Body(createValidationPipe(UpdateAdminEnrollmentDto))
    body: UpdateAdminEnrollmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminEnrollment> {
    return this.enrollments.update(requirePrincipal(request), {
      enrollmentId,
      expectedVersion: body.expectedVersion,
      traceId: getOrCreateTraceId(request),
      ...(body.currentPhase === undefined ? {} : { currentPhase: body.currentPhase }),
      ...(body.currentWeek === undefined ? {} : { currentWeek: body.currentWeek }),
      ...(body.status === undefined ? {} : { status: body.status }),
    });
  }
}
