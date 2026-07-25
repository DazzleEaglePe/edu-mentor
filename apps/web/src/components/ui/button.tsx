import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Botón.
 *
 * Regla de `docs/design/07-componentes.md` §8: **un `disabled` siempre va
 * acompañado del motivo**. Por eso `disabledReason` es obligatorio cuando el
 * botón está deshabilitado — el tipo lo exige, no la revisión de código.
 * Un botón gris sin explicación es el peor patrón de este producto.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-[var(--edu-action-primary-bg)] text-[var(--edu-action-primary-text)] hover:bg-[var(--edu-action-primary-bg-hover)]',
  secondary:
    'bg-[var(--edu-action-secondary-bg)] text-[var(--edu-action-secondary-text)] border border-[var(--edu-action-secondary-border)] hover:bg-[var(--edu-surface-sunken)]',
  ghost:
    'bg-transparent text-[var(--edu-text-primary)] border border-[var(--edu-border)] hover:bg-[var(--edu-surface-sunken)]',
  danger:
    'bg-[var(--edu-action-danger-bg)] text-[var(--edu-action-danger-text)] hover:bg-[var(--edu-action-danger-bg-hover)]',
};

type NativeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'disabled' | 'id'>;

interface BaseProps extends NativeProps {
  readonly children: ReactNode;
  readonly variant?: Variant;
  readonly fullWidth?: boolean;
  /** Texto mientras la acción está en curso, p. ej. "Confirmando…". */
  readonly loadingLabel?: string;
  readonly isLoading?: boolean;
}

type ButtonProps =
  | (BaseProps & {
      readonly disabled?: false;
      readonly disabledReason?: never;
      readonly id?: string;
    })
  | (BaseProps & {
      readonly disabled: true;
      readonly disabledReason: string;
      /** Garantiza una relación `aria-describedby` única y estable. */
      readonly id: string;
    });

export function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  isLoading = false,
  loadingLabel,
  disabled,
  disabledReason,
  id,
  ...rest
}: ButtonProps) {
  const isBlocked = disabled === true || isLoading;
  const disabledReasonId = disabled === true ? `${id}-reason` : undefined;

  return (
    <span className={fullWidth ? 'flex w-full flex-col gap-1' : 'inline-flex flex-col gap-1'}>
      <button
        id={id}
        type="button"
        {...rest}
        disabled={isBlocked}
        aria-busy={isLoading || undefined}
        aria-describedby={disabledReasonId}
        className={`inline-flex min-h-[2.5rem] items-center justify-center gap-2 rounded-[var(--edu-radius-sm)] px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClass[variant]} ${fullWidth ? 'w-full' : ''}`}
      >
        {isLoading && loadingLabel !== undefined ? loadingLabel : children}
      </button>
      {disabled === true ? (
        <span id={disabledReasonId} className="text-xs text-[var(--edu-text-secondary)]">
          {disabledReason}
        </span>
      ) : null}
    </span>
  );
}
