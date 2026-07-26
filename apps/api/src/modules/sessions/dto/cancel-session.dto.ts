import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CancelSessionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1_000)
  reason!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
