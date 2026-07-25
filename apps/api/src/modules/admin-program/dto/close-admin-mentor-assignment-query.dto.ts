import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CloseAdminMentorAssignmentQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
