import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { SessionPhase, SessionType } from '../../../generated/prisma/enums.js';

export class CreateSessionDto {
  @IsUUID('4')
  oleadaId!: string;

  @IsOptional()
  @IsUUID('4')
  mentorUserId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  description?: string;

  @IsEnum(SessionType)
  type!: SessionType;

  @IsEnum(SessionPhase)
  phase!: SessionPhase;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  weekNumber?: number;

  @IsOptional()
  @IsInt()
  checkpointMonth?: number;

  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt!: string;

  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone!: string;

  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(2_048)
  meetingUrl?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  enrollmentIds!: string[];
}
