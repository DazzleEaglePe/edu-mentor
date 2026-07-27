import type { ReactNode } from 'react';

type Variant = 'default' | 'quiet' | 'emphasis';

/**
 * Tarjeta del portal.
 *
 * La estética sigue las maquetas de referencia: esquinas redondeadas, sombra
 * suave y aire generoso. La sombra es deliberadamente tenue —`shadow-sm`— para
 * que separe la tarjeta del fondo sin competir con el contenido; en un panel
 * con ocho tarjetas, una sombra marcada convierte la pantalla en ruido.
 */
const variantClass: Record<Variant, string> = {
  default: 'border-[var(--edu-border)] bg-[var(--edu-surface)] shadow-[var(--edu-shadow-sm)]',
  quiet: 'border-[var(--edu-border)] bg-[var(--edu-surface-sunken)]',
  /** Borde izquierdo de 3px para lo que requiere acción de quien mira. */
  emphasis:
    'border-[var(--edu-border)] border-l-[3px] border-l-[var(--edu-border-strong)] bg-[var(--edu-surface)] shadow-[var(--edu-shadow-sm)]',
};

export interface CardProps {
  readonly children: ReactNode;
  readonly variant?: Variant;
  readonly title?: string;
  /**
   * Glifo decorativo junto al título, como en las maquetas. Va con
   * `aria-hidden`: el título ya nombra la sección y repetirlo en el lector de
   * pantalla sería ruido.
   */
  readonly icon?: string;
  /** Acción secundaria alineada a la derecha del título. */
  readonly action?: ReactNode;
}

export function Card({ children, variant = 'default', title, icon, action }: CardProps) {
  const hasHeader = title !== undefined || action !== undefined;

  return (
    <section
      className={`flex min-w-0 flex-col gap-3 rounded-[var(--edu-radius-lg)] border p-4 ${variantClass[variant]}`}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title === undefined ? null : (
            <h2 className="flex items-center gap-2 text-base font-semibold">
              {icon === undefined ? null : (
                <span aria-hidden="true" className="text-[var(--edu-teal-700)]">
                  {icon}
                </span>
              )}
              {title}
            </h2>
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Conteo del dashboard. No acepta variaciones porcentuales: no hay serie
 * histórica que las sostenga, y un porcentaje inventado es peor que ninguno.
 *
 * El icono es decorativo y va detrás de `aria-hidden`, igual que en `Card`.
 */
export function Metric({
  value,
  label,
  icon,
}: {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--edu-radius-lg)] border border-[var(--edu-border)] bg-[var(--edu-surface)] p-3 shadow-[var(--edu-shadow-sm)]">
      {icon === undefined ? null : (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--edu-radius-md)] bg-[var(--edu-teal-50)] text-[var(--edu-teal-700)]"
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="tabular font-mono text-xl font-bold">{value}</span>
        <span className="text-xs text-[var(--edu-text-secondary)]">{label}</span>
      </span>
    </div>
  );
}
