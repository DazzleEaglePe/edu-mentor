import { IsIn, IsInt, Min } from 'class-validator';

export class SetSessionConfirmationDto {
  @IsIn(['CONFIRMED', 'DECLINED'])
  status!: 'CONFIRMED' | 'DECLINED';

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
