import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReturnSubmissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1_000)
  reason!: string;
}
