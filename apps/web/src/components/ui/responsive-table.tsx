import type { ReactNode } from 'react';

/**
 * Tabla que se convierte en tarjetas por debajo de `md`.
 *
 * `docs/design/06-wireframes.md` §3 lo dice desde Fase 0 —"tablas → tarjetas"—
 * y las primeras tablas administrativas se implementaron sin ello. El resultado
 * fue el fallo que encontró la revisión: `/admin/usuarios` empujaba la página
 * entera en 390 px.
 *
 * `overflow-x-auto` por sí solo no bastaba. Una tabla con correos y botones
 * tiene un ancho mínimo que no baja de ~600 px, así que el contenedor scrollea
 * pero el contenido sigue siendo ilegible en un móvil: se lee una columna por
 * vez. La regla del diseño era mejor que el parche.
 *
 * Se renderizan ambas representaciones y se alterna por CSS en vez de por
 * JavaScript: así no hay salto de layout ni desajuste entre servidor y cliente.
 * El contenido está duplicado en el DOM, de modo que **solo una es accesible a
 * la vez** — la oculta lleva `aria-hidden`.
 */

export interface ResponsiveTableProps {
  /** Descripción para lectores de pantalla; no se muestra. */
  readonly caption: string;
  readonly headers: readonly string[];
  /** Una fila = celdas en el mismo orden que `headers`. */
  readonly rows: readonly TableRow[];
}

export interface TableRow {
  readonly key: string;
  readonly cells: readonly ReactNode[];
}

export function ResponsiveTable({ caption, headers, rows }: ResponsiveTableProps) {
  return (
    <>
      {/* Escritorio: tabla real, con semántica de tabla. */}
      <div
        className="hidden min-w-0 overflow-x-auto rounded-[var(--edu-radius-md)] border border-[var(--edu-border)] md:block"
        aria-hidden="false"
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[var(--edu-surface-sunken)] text-left">
              {headers.map((header) => (
                <th key={header} scope="col" className="px-3 py-2 font-semibold">
                  {header.length === 0 ? <span className="sr-only">Acciones</span> : header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-[var(--edu-border)] align-top">
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${headers[index] ?? index}`} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: una tarjeta por fila, con la cabecera como etiqueta de cada dato. */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex min-w-0 flex-col gap-2 rounded-[var(--edu-radius-md)] border border-[var(--edu-border)] bg-[var(--edu-surface)] p-3"
          >
            {row.cells.map((cell, index) => {
              const header = headers[index] ?? '';

              return (
                <div
                  key={`${row.key}-m-${header.length === 0 ? index : header}`}
                  className="flex min-w-0 flex-col gap-0.5"
                >
                  {header.length === 0 ? null : (
                    <span className="text-xs font-semibold text-[var(--edu-text-secondary)]">
                      {header}
                    </span>
                  )}
                  <div className="min-w-0 text-sm break-words">{cell}</div>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </>
  );
}
