import type { ReactNode } from 'react';

type Variant = 'default' | 'quiet' | 'emphasis';

const variantClass: Record<Variant, string> = {
  default: 'border-[var(--edu-border)] bg-[var(--edu-surface)]',
  quiet: 'border-[var(--edu-border)] bg-[var(--edu-surface-sunken)]',
  /** Borde izquierdo de 3px para lo que requiere acción de quien mira. */
  emphasis:
    'border-[var(--edu-border)] border-l-[3px] border-l-[var(--edu-border-strong)] bg-[var(--edu-surface)]',
};

export interface CardProps {
  readonly children: ReactNode;
  readonly variant?: Variant;
  readonly title?: string;
}

export function Card({ children, variant = 'default', title }: CardProps) {
  return (
    <section
      className={`flex min-w-0 flex-col gap-3 rounded-[var(--edu-radius-md)] border p-4 ${variantClass[variant]}`}
    >
      {title === undefined ? null : <h2 className="text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

/** Conteo del dashboard. No acepta variaciones porcentuales: no hay serie histórica. */
export function Metric({ value, label }: { readonly value: string; readonly label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--edu-radius-md)] border border-[var(--edu-border)] p-3">
      <span className="tabular font-mono text-xl font-bold">{value}</span>
      <span className="text-xs text-[var(--edu-text-secondary)]">{label}</span>
    </div>
  );
}
