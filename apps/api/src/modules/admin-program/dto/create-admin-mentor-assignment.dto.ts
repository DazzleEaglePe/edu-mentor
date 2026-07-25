import { Equals, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CreateAdminMentorAssignmentDto {
  @IsUUID('4')
  mentorUserId!: string;

  @IsUUID('4')
  oleadaId!: string;

  @IsOptional()
  @IsUUID('4')
  enrollmentId?: string | null;

  @Equals('SPECIALIST')
  capability!: 'SPECIALIST';

  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt!: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  endsAt?: string | null;
}
