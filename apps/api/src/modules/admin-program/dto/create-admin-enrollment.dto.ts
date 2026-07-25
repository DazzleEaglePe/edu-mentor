import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateAdminEnrollmentDto {
  @IsUUID('4')
  userId!: string;

  @IsUUID('4')
  oleadaId!: string;

  @IsOptional()
  @IsIn(['FASE_0', 'FASE_1'])
  currentPhase: 'FASE_0' | 'FASE_1' = 'FASE_0';
}
