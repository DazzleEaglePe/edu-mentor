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
import type { AdminOleada, AdminOleadaPage } from './admin-oleada.js';
import { AdminOleadasService } from './admin-oleadas.service.js';
import { AdminOleadaQueryDto } from './dto/admin-oleada-query.dto.js';
import { CreateAdminOleadaDto } from './dto/create-admin-oleada.dto.js';
import { UpdateAdminOleadaDto } from './dto/update-admin-oleada.dto.js';

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }

  return request.auth;
}

@Roles('ADMIN')
@Controller('admin/oleadas')
export class AdminOleadasController {
  constructor(@Inject(AdminOleadasService) private readonly oleadas: AdminOleadasService) {}

  @Get()
  list(
    @Query(createValidationPipe(AdminOleadaQueryDto)) query: AdminOleadaQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminOleadaPage> {
    return this.oleadas.list(requirePrincipal(request), query.page, query.limit, query.status);
  }

  @Post()
  @HttpCode(201)
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(createValidationPipe(CreateAdminOleadaDto)) body: CreateAdminOleadaDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminOleada> {
    return this.oleadas.create(requirePrincipal(request), {
      capacity: body.capacity,
      endDate: body.endDate,
      idempotencyKey,
      name: body.name,
      sector: body.sector,
      startDate: body.startDate,
      traceId: getOrCreateTraceId(request),
    });
  }

  @Patch(':oleadaId')
  update(
    @Param('oleadaId', new ParseUUIDPipe({ version: '4' })) oleadaId: string,
    @Body(createValidationPipe(UpdateAdminOleadaDto)) body: UpdateAdminOleadaDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminOleada> {
    return this.oleadas.update(requirePrincipal(request), {
      expectedVersion: body.expectedVersion,
      oleadaId,
      traceId: getOrCreateTraceId(request),
      ...(body.capacity === undefined ? {} : { capacity: body.capacity }),
      ...(body.endDate === undefined ? {} : { endDate: body.endDate }),
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.sector === undefined ? {} : { sector: body.sector }),
      ...(body.startDate === undefined ? {} : { startDate: body.startDate }),
      ...(body.status === undefined ? {} : { status: body.status }),
    });
  }
}
