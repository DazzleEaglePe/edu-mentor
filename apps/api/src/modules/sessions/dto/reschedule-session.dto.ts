import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RescheduleSessionDto {
  @IsString()
  startsAt!: string;

  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes!: number;

  @IsOptional()
  @IsUrl()
  meetingUrl?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1_000)
  reason!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
