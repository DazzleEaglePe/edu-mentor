import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
}
