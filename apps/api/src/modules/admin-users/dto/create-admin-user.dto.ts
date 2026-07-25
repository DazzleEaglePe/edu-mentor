import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { RoleKey } from '../../../generated/prisma/enums.js';

export class CreateAdminUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(RoleKey, { each: true })
  roles!: RoleKey[];

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword!: string;
}
