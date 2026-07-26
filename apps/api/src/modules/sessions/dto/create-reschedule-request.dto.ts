import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRescheduleRequestDto {
  @IsOptional()
  @IsString()
  proposedStartsAt?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1_000)
  reason!: string;
}
