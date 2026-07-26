import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { loadAuthMe } from '@/lib/api/fixtures';
import { periodFieldFor, periodOptionsFor, type SessionPhase } from '@/lib/domain/agenda';

/**
 * M4 · Agendar sesión.
 *
 * Cuatro reglas del contrato viven en este formulario:
 *
 * 1. **El campo de periodo depende de la fase.** `FASE_1` pide semana (1–6),
 *    `FASE_2` pide mes de checkpoint (1, 2, 3 o 6). Nunca ambos, nunca
 *    ninguno. La UI impide el estado imposible, pero el `CHECK` en DB sigue
 *    haciendo falta: esto ayuda al formulario, no valida el dominio.
 * 2. **`timezone` es obligatorio**, así que se muestra en vez de asumirse.
 * 3. **`Idempotency-Key` en la creación**, para que un doble clic no cree dos
 *    sesiones.
 * 4. **El `409 SCHEDULE_CONFLICT` tiene dos redacciones** según
 *    `canViewConflictingSession`, y en ninguna se promete el siguiente horario
 *    libre: el backend no lo calcula.
 *
 * Es un formulario de solo lectura hasta que exista el cliente HTTP. Los
 * selects se renderizan sin estado porque simular una interacción que no
 * guarda nada sería peor que mostrarla inerte.
 */
const phase: SessionPhase = 'FASE_1';

export default async function AgendarSesionPage() {
  const me = await loadAuthMe();
  const periodField = periodFieldFor(phase);
  const periodOptions = periodOptionsFor(phase);

  return (
    <AppShell
      me={me}
      currentPath="/agenda"
      aside={
        <Card variant="quiet" title="Si hay cruce de horario">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            El backend rechaza el traslape y devuelve el intervalo ocupado. Si puedes ver la sesión
            en conflicto, se te ofrece abrirla; si no, solo se te dice que esa persona no está
            disponible.
          </p>
          <p className="text-sm text-[var(--edu-text-secondary)]">
            No sugerimos “el siguiente horario libre”: el backend no lo calcula y proponer un hueco
            sin validar solo produce un segundo conflicto.
          </p>
        </Card>
      }
    >
      <Link
        href="/agenda"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a mi agenda
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Agendar sesión</h1>

      <Card title="Tipo y fase">
        <div className="flex flex-wrap gap-2">
          {(['ONE_ON_ONE', 'GROUP', 'CHECKPOINT'] as const).map((type) => (
            <span
              key={type}
              className="rounded-[var(--edu-radius-sm)] border border-[var(--edu-border)] px-3 py-1.5 text-sm"
            >
              {type === 'ONE_ON_ONE' ? '1:1' : type === 'GROUP' ? 'Grupal' : 'Checkpoint'}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Fase</span>
            <span className="rounded-[var(--edu-radius-sm)] border border-[var(--edu-border-strong)] px-3 py-2">
              Fase 1 · Hub de Empleabilidad
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">
              {periodField === 'weekNumber' ? 'Semana del programa' : 'Mes del checkpoint'}
            </span>
            <span className="rounded-[var(--edu-radius-sm)] border border-[var(--edu-border-strong)] px-3 py-2">
              {periodOptions.join(' · ')}
            </span>
            <span className="text-xs text-[var(--edu-text-secondary)]">
              Este campo cambia con la fase. Una sesión pertenece a una sola.
            </span>
          </label>
        </div>
      </Card>

      <Card title="Cuándo">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {['Fecha', 'Hora', 'Duración', 'Zona horaria'].map((label) => (
            <label key={label} className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">{label}</span>
              <span className="rounded-[var(--edu-radius-sm)] border border-[var(--edu-border-strong)] px-3 py-2 text-[var(--edu-text-secondary)]">
                {label === 'Zona horaria' ? 'America/Lima' : '—'}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-[var(--edu-text-secondary)]">
          La zona horaria se muestra porque el contrato la exige por sesión: no se asume la del
          navegador.
        </p>
      </Card>

      <Card title="Al guardar">
        <p className="text-sm text-[var(--edu-text-secondary)]">
          Se notifica a los participantes y sus confirmaciones quedan pendientes. La creación viaja
          con una clave de idempotencia, así que un doble clic no crea dos sesiones.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            id="create-session"
            disabled
            disabledReason="Disponible cuando activemos el portal."
          >
            Guardar y notificar
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
