import type { ApiComponents } from '@edu-mentor/shared-types';
import { translateRole, type Role } from './labels';

type Schemas = ApiComponents['schemas'];

export type AdminUser = Schemas['AdminUser'];

/**
 * `GET /admin/users` devuelve un schema **inline**, no uno nombrado, así que
 * no hay `AdminUserPage` que importar. Se compone de las piezas que el
 * contrato sí publica; si Codex lo nombra más adelante, este alias se sustituye
 * por el generado.
 */
export interface AdminUserPage {
  readonly data: readonly AdminUser[];
  readonly meta: Schemas['PageMeta'];
}

/**
 * `AdminUser` tiene exactamente siete campos: `id`, `email`, `fullName`,
 * `roles`, `isActive`, `mustChangePassword` y `version`.
 *
 * **No existe "último acceso" ni "oleada del usuario"**, aunque el wireframe
 * original los dibujara. La pertenencia a una oleada vive en `Enrollment`, que
 * es otro recurso, y el último acceso no se expone en ningún endpoint. Mostrar
 * cualquiera de los dos obligaría a inventarlos.
 */

/**
 * Estado operativo de la cuenta, derivado de dos booleanos que significan
 * cosas distintas.
 *
 * `mustChangePassword` es el dato más útil de la primera semana del piloto:
 * distingue a quien todavía no logró entrar de quien ya está operando. Sin él,
 * "activo" incluiría a gente que nunca abrió la plataforma.
 */
export type AccountState = 'ACTIVE' | 'TEMPORARY_PASSWORD' | 'INACTIVE';

export function accountState(user: AdminUser): AccountState {
  if (!user.isActive) {
    return 'INACTIVE';
  }

  return user.mustChangePassword ? 'TEMPORARY_PASSWORD' : 'ACTIVE';
}

export interface AccountStateLabel {
  readonly label: string;
  readonly hint: string;
}

const accountStateLabels: Record<AccountState, AccountStateLabel> = {
  ACTIVE: { label: 'Activa', hint: 'Ya definió su contraseña.' },
  TEMPORARY_PASSWORD: {
    label: 'Contraseña temporal',
    hint: 'Aún no ha entrado por primera vez.',
  },
  INACTIVE: { label: 'Desactivada', hint: 'Conserva su historial.' },
};

export function describeAccountState(state: AccountState): AccountStateLabel {
  return accountStateLabels[state];
}

/** "Mentora · Admin" — una persona puede tener varios roles (DEC-002). */
export function describeRoles(roles: readonly Role[]): string {
  return roles.map((role) => translateRole(role)).join(' · ');
}

/**
 * Cuenta cuántas personas siguen sin entrar.
 *
 * Es el número que Proyectos necesita ver arriba durante el arranque: mientras
 * no sea cero, hay gente fuera del piloto.
 */
export function pendingFirstAccess(users: readonly AdminUser[]): number {
  return users.filter((user) => accountState(user) === 'TEMPORARY_PASSWORD').length;
}

/**
 * Orden de la lista: primero quien requiere intervención.
 *
 * Contraseña temporal arriba —hay que entregársela o restablecerla—, luego las
 * cuentas activas, y al final las desactivadas, que ya no participan. A igual
 * estado, alfabético para poder buscar con la vista.
 */
const stateOrder: Record<AccountState, number> = {
  TEMPORARY_PASSWORD: 0,
  ACTIVE: 1,
  INACTIVE: 2,
};

export function sortByAttention(users: readonly AdminUser[]): readonly AdminUser[] {
  return [...users].sort((left, right) => {
    const byState = stateOrder[accountState(left)] - stateOrder[accountState(right)];
    if (byState !== 0) {
      return byState;
    }

    return left.fullName.localeCompare(right.fullName, 'es');
  });
}
