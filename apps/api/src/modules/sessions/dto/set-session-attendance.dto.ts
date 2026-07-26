import { IsIn, IsInt, Min } from 'class-validator';

export class SetSessionAttendanceDto {
  @IsIn(['ATTENDED', 'ABSENT'])
  status!: 'ATTENDED' | 'ABSENT';

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
