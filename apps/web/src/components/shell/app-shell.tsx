import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AuthMe } from '@edu-mentor/shared-types';
import { navigationForRoles } from '@/lib/domain/navigation';
import { primaryRole, translateProgramPhase, translateRole } from '@/lib/domain/labels';

/**
 * Shell del portal: navegación · contenido · contexto.
 *
 * En `sm` la navegación lateral pasa a barra inferior (máx. 4 destinos
 * visibles), según `docs/design/06-wireframes.md` §3.
 *
 * Ocultar entradas aquí es cortesía, no seguridad: el backend valida el
 * acceso de todas formas.
 */

export interface AppShellProps {
  readonly me: AuthMe;
  readonly currentPath: string;
  readonly children: ReactNode;
  readonly aside?: ReactNode;
}

export function AppShell({ me, currentPath, children, aside }: AppShellProps) {
  const items = navigationForRoles(me.roles);
  const role = primaryRole(me.roles);
  const enrollment = me.activeEnrollment;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around overflow-x-auto border-t border-[var(--edu-navy-700)] bg-[var(--edu-navy-900)] px-2 py-2 md:static md:h-dvh md:flex-col md:justify-start md:gap-1 md:overflow-x-visible md:border-t-0 md:border-r md:px-3 md:py-5"
      >
        <p className="hidden px-3 pb-4 text-sm font-bold tracking-wide text-white md:block">
          EDU-MENTOR
        </p>
        {items.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`shrink-0 rounded-[var(--edu-radius-sm)] px-3 py-2 text-center text-xs whitespace-nowrap md:text-left md:text-sm ${
                isActive
                  ? 'bg-[var(--edu-teal-700)] font-semibold text-white'
                  : 'text-[var(--edu-teal-100)] hover:bg-[var(--edu-navy-700)]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--edu-border)] bg-[var(--edu-surface)] px-4 py-3 md:px-6">
          <div>
            <p className="text-lg font-bold">Hola, {me.fullName.split(' ')[0]}</p>
            {enrollment === null || enrollment === undefined ? null : (
              <p className="text-xs text-[var(--edu-text-secondary)]">
                {enrollment.oleada.name} · {translateProgramPhase(enrollment.currentPhase)}
                {typeof enrollment.currentWeek === 'number'
                  ? ` · Semana ${enrollment.currentWeek}`
                  : ''}
              </p>
            )}
          </div>
          <span className="rounded-[var(--edu-radius-sm)] bg-[var(--edu-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--edu-text-secondary)]">
            {translateRole(role)}
          </span>
        </header>

        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6 xl:flex-row">
          <main id="contenido" className="flex min-w-0 flex-1 flex-col gap-6">
            {children}
          </main>
          {aside === undefined ? null : (
            <aside className="flex w-full flex-col gap-4 xl:w-[320px] xl:shrink-0">{aside}</aside>
          )}
        </div>
      </div>
    </div>
  );
}
