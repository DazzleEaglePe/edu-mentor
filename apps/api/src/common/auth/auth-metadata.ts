import { SetMetadata } from '@nestjs/common';
import type { RoleKey } from '../../generated/prisma/enums.js';

export const IS_PUBLIC_ROUTE = Symbol('IS_PUBLIC_ROUTE');
export const ALLOW_PASSWORD_CHANGE_REQUIRED = Symbol('ALLOW_PASSWORD_CHANGE_REQUIRED');
export const REQUIRED_ROLES = Symbol('REQUIRED_ROLES');

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_ROUTE, true);

export const AllowPasswordChangeRequired = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_REQUIRED, true);

export const Roles = (...roles: readonly RoleKey[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES, roles);
