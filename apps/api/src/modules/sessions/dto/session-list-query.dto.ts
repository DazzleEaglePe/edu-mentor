import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { SessionPhase, SessionStatus } from '../../../generated/prisma/enums.js';

export class SessionListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsUUID('4')
  oleadaId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsEnum(SessionPhase)
  phase?: SessionPhase;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  to?: string;
}
