import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Card, Metric } from '@/components/ui/card';
import { loadAdminAuthMe, loadAdminDashboard } from '@/lib/api/fixtures';
import { evaluationProgress, risks, unaccountedSubmissions } from '@/lib/domain/dashboard';

/**
 * A1 · Dashboard operativo.
 *
 * Responde **una sola pregunta**: ¿qué está en riesgo?
 *
 * El contrato entrega once cifras. Presentarlas como una rejilla uniforme
 * obligaría a leerlas todas para descubrir cuál importa, que es lo contrario de
 * un panel operativo. Por eso van en tres bloques con propósitos distintos:
 * primero lo que requiere intervención, luego el pulso del programa, y al final
 * el volumen acumulado.
 *
 * Lo que está en cero **no aparece** en el bloque de riesgo: un panel que
 * anuncia "0 fallidos" entrena a la gente a ignorarlo.
 */
export default async function AdminDashboardPage() {
  const [me, dashboard] = await Promise.all([loadAdminAuthMe(), loadAdminDashboard()]);

  const riskItems = risks(dashboard);
  const progress = evaluationProgress(dashboard);
  const unaccounted = unaccountedSubmissions(dashboard);
  const { evaluated, total: totalSubmissions } = dashboard.submissionsSummary;

  return (
    <AppShell
      me={me}
      currentPath="/admin"
      aside={
        <Card variant="quiet" title="Cómo leer este panel">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Arriba está lo que necesita que alguien haga algo. Si ese bloque está vacío, el programa
            avanza solo y el resto es contexto.
          </p>
          <p className="text-sm text-[var(--edu-text-secondary)]">
            No hay comparativos contra semanas anteriores: no existe serie histórica que los
            sostenga, y un porcentaje inventado es peor que ningún porcentaje.
          </p>
        </Card>
      }
    >
      <h1 className="text-2xl font-bold tracking-tight">Panel de coordinación</h1>

      {riskItems.length === 0 ? (
        <Card>
          <p className="text-sm">
            <strong>Nada requiere intervención ahora mismo.</strong> Ninguna notificación falló y no
            hay entregas esperando a nadie.
          </p>
        </Card>
      ) : (
        <Card title="En riesgo esta semana" icon="⚠️" variant="emphasis">
          <ul className="flex flex-col gap-3">
            {riskItems.map((item) => (
              <li key={item.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tabular font-mono text-xl font-bold">{item.value}</span>
                <span className="font-medium">{item.label}</span>
                <span className="w-full text-xs text-[var(--edu-text-secondary)]">{item.hint}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Pulso del programa" icon="📊">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            value={`${dashboard.activeOleadas}/${dashboard.totalOleadas}`}
            label="Oleadas activas"
          />
          <Metric value={`${dashboard.totalParticipants}`} label="Participantes" />
          <Metric value={`${dashboard.activeMentors}`} label="Mentores activos" />
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--edu-border)] pt-3">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">Entregas evaluadas</span>
            <span className="tabular font-mono text-xs">
              {evaluated} de {totalSubmissions} · {progress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--edu-surface-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--edu-teal-700)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          {unaccounted > 0 ? (
            <p className="text-xs text-[var(--edu-text-secondary)]">
              {unaccounted} entrega(s) siguen en borrador y no aparecen en el desglose.
            </p>
          ) : null}
        </div>
      </Card>

      <Card title="Sesiones" icon="📅">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Metric value={`${dashboard.upcomingSessions}`} label="Próximas" />
          <Metric value={`${dashboard.completedSessions}`} label="Realizadas" />
        </div>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/admin/sesiones"
          className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
        >
          Ver sesiones
        </Link>
        <Link
          href="/admin/entregables"
          className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
        >
          Ver entregables
        </Link>
        <Link
          href="/admin/oleadas"
          className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
        >
          Ver oleadas
        </Link>
      </div>
    </AppShell>
  );
}
