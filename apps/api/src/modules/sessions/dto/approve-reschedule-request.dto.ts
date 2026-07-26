import { IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class ApproveRescheduleRequestDto {
  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number;

  @IsOptional()
  @IsUrl()
  meetingUrl?: string;

  @IsInt()
  @Min(1)
  expectedSessionVersion!: number;

  @IsInt()
  @Min(1)
  expectedRequestVersion!: number;
}
