import { IsISO8601 } from 'class-validator';

export class SessionCalendarQueryDto {
  @IsISO8601({ strict: true, strictSeparator: true })
  from!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  to!: string;
}
