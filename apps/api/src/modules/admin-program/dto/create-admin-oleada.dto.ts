import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export class CreateAdminOleadaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sector!: string;

  @IsString()
  @Matches(CALENDAR_DATE)
  startDate!: string;

  @IsString()
  @Matches(CALENDAR_DATE)
  endDate!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  capacity!: number;
}
