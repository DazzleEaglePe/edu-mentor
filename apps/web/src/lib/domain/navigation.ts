import type { Role } from './labels';

/**
 * Navegación del piloto — **lista blanca cerrada**.
 *
 * `docs/design/00-inventario-pantallas.md` §5 y DEC-015: ninguna pantalla
 * `FUTURE` puede aparecer en la navegación del piloto. Job Tracking, mentor
 * par, Demo Day, certificados, IA de CV, postulaciones, matching, apoyo
 * emocional y mensajería **no existen aquí**, ni siquiera con un badge de
 * "próximamente".
 *
 * Agregar una entrada a este archivo es una decisión de alcance, no de diseño.
 */

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

const participantNav: readonly NavItem[] = [
  { href: '/inicio', label: 'Inicio' },
  { href: '/sesiones', label: 'Mis sesiones' },
  { href: '/entregables', label: 'Mis entregables' },
  { href: '/perfil', label: 'Mi perfil' },
];

const mentorNav: readonly NavItem[] = [
  { href: '/inicio', label: 'Inicio' },
  { href: '/agenda', label: 'Mi agenda' },
  { href: '/evaluaciones', label: 'Evaluaciones' },
  { href: '/participantes', label: 'Participantes' },
  { href: '/perfil', label: 'Mi perfil' },
];

const adminNav: readonly NavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/sesiones', label: 'Sesiones' },
  { href: '/admin/entregables', label: 'Entregables' },
  { href: '/admin/oleadas', label: 'Oleadas' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  // `Operación` (A10 · A11) se diseñó pero se activa en Fase 4.
];

const navByRole: Record<Role, readonly NavItem[]> = {
  PARTICIPANT: participantNav,
  MENTOR: mentorNav,
  ADMIN: adminNav,
};

export function navigationFor(role: Role): readonly NavItem[] {
  return navByRole[role];
}

/**
 * Una persona con varios roles ve la unión de sus destinos, sin duplicados y
 * en el orden de la lista blanca. Ocultar en el frontend es cortesía: el
 * backend valida el acceso igual.
 */
export function navigationForRoles(roles: readonly Role[]): readonly NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];

  for (const role of ['PARTICIPANT', 'MENTOR', 'ADMIN'] as const) {
    if (!roles.includes(role)) continue;
    for (const item of navByRole[role]) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push(item);
    }
  }

  return items;
}
