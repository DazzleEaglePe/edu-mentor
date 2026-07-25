import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { OleadaStatus } from '../../../generated/prisma/enums.js';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export class UpdateAdminOleadaDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sector?: string;

  @IsOptional()
  @IsEnum(OleadaStatus)
  status?: OleadaStatus;

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE)
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  capacity?: number;
}
