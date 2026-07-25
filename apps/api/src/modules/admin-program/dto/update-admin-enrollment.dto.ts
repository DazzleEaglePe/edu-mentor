import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { EnrollmentStatus, ProgramPhase } from '../../../generated/prisma/enums.js';

export class UpdateAdminEnrollmentDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsEnum(ProgramPhase)
  currentPhase?: ProgramPhase;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  currentWeek?: number | null;
}
