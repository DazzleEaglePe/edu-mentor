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
import type { AdminUser, AdminUserPage } from './admin-user.js';
import { AdminUsersService } from './admin-users.service.js';
// Runtime imports are required so Nest can reflect DTO classes for ValidationPipe.
import { AdminUserQueryDto } from './dto/admin-user-query.dto.js';
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js';
import { ResetAdminUserPasswordDto } from './dto/reset-admin-user-password.dto.js';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query(createValidationPipe(AdminUserQueryDto)) query: AdminUserQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminUserPage> {
    return this.users.list(requirePrincipal(request), query.page, query.limit);
  }

  @Post()
  @HttpCode(201)
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(createValidationPipe(CreateAdminUserDto)) body: CreateAdminUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminUser> {
    return this.users.create(requirePrincipal(request), {
      email: body.email,
      fullName: body.fullName,
      idempotencyKey,
      roles: body.roles,
      temporaryPassword: body.temporaryPassword,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Patch(':userId')
  update(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body(createValidationPipe(UpdateAdminUserDto)) body: UpdateAdminUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminUser> {
    return this.users.update(requirePrincipal(request), {
      expectedVersion: body.expectedVersion,
      traceId: getOrCreateTraceId(request),
      userId,
      ...(body.fullName === undefined ? {} : { fullName: body.fullName }),
      ...(body.isActive === undefined ? {} : { isActive: body.isActive }),
      ...(body.roles === undefined ? {} : { roles: body.roles }),
    });
  }

  @Post(':userId/password-reset')
  @HttpCode(204)
  resetPassword(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body(createValidationPipe(ResetAdminUserPasswordDto))
    body: ResetAdminUserPasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.users.resetPassword(requirePrincipal(request), {
      temporaryPassword: body.temporaryPassword,
      traceId: getOrCreateTraceId(request),
      userId,
    });
  }
}
