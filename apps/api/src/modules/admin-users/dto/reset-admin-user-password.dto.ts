import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetAdminUserPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword!: string;
}
