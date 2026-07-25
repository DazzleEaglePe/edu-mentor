import type { ReactNode } from 'react';
import type { ApiError } from '@edu-mentor/shared-types';
import { errorCopy } from '@/lib/api/errors';

/**
 * Los cuatro estados obligatorios de `docs/design/03-estados-ux.md`.
 * Toda pantalla del MVP los define; ninguna puede quedarse en blanco.
 */

export function Skeleton({
  lines = 3,
  label,
}: {
  readonly lines?: number;
  readonly label: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="block h-3 rounded-[var(--edu-radius-sm)] bg-[var(--edu-surface-sunken)]"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  readonly title: string;
  /** Explica *por qué* está vacío. Cada caso se redacta distinto. */
  readonly body: string;
  /** Se omite cuando quien mira no puede hacer nada al respecto. */
  readonly action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--edu-radius-md)] border border-dashed border-[var(--edu-border-strong)] px-6 py-10 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-prose text-sm text-[var(--edu-text-secondary)]">{body}</p>
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  readonly error: ApiError['error'];
  readonly onRetry?: ReactNode;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const copy = errorCopy(error);

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-[var(--edu-radius-md)] border border-[var(--edu-coral-200)] bg-[var(--edu-coral-100)] px-6 py-10 text-center"
    >
      <p className="text-base font-semibold text-[var(--edu-coral-800)]">{copy.title}</p>
      <p className="max-w-prose text-sm text-[var(--edu-text-primary)]">{copy.body}</p>
      {onRetry}
      {copy.showTraceId ? (
        <p className="font-mono text-xs text-[var(--edu-text-secondary)]">
          Código de soporte: <span className="select-all">{error.traceId}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * `403` y `404` comparten pantalla a propósito: el backend oculta lo ajeno
 * devolviendo `404`, así que la UI dice "no está disponible" y **nunca**
 * revela si el recurso existe.
 */
export function ForbiddenState({ action }: { readonly action?: ReactNode }) {
  return (
    <EmptyState
      title="Este contenido no está disponible"
      body="Si crees que es un error, escribe a tu coordinación."
      {...(action === undefined ? {} : { action })}
    />
  );
}
