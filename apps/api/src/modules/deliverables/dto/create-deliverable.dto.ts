import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDeliverableDto {
  @IsString()
  assignmentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  notes!: string;
}
