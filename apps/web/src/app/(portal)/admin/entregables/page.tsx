import { AppShell } from '@/components/shell/app-shell';
import { Card, Metric } from '@/components/ui/card';
import { ResponsiveTable, type TableRow } from '@/components/ui/responsive-table';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import {
  loadAdminAuthMe,
  loadDeliverableDetail,
  loadEvaluatedDeliverable,
} from '@/lib/api/fixtures';
import { currentSubmission, sortByRequiredAction } from '@/lib/domain/deliverables';
import { formatDate } from '@/lib/format';

/**
 * A4 · Supervisión de entregables.
 *
 * Vista de **cumplimiento**, no de contenido. Proyectos no evalúa: comprueba
 * que el ciclo ocurra. Por eso no hay enlace para abrir archivos desde aquí —
 * el contenido es asunto del mentor y cada descarga se audita.
 *
 * La métrica que importa es cuántas entregas siguen esperando a alguien, no el
 * total acumulado.
 */
export default async function AdminEntregablesPage() {
  const [me, pendiente, evaluado] = await Promise.all([
    loadAdminAuthMe(),
    loadDeliverableDetail(),
    loadEvaluatedDeliverable(),
  ]);

  const deliverables = sortByRequiredAction([pendiente, evaluado]);

  const awaitingMentor = deliverables.filter((item) => {
    const submission = currentSubmission(item);
    return submission?.status === 'SUBMITTED' || submission?.status === 'UNDER_REVIEW';
  }).length;

  const awaitingParticipant = deliverables.filter((item) => {
    const submission = currentSubmission(item);
    return submission?.status === 'DRAFT' || submission?.status === 'RETURNED';
  }).length;

  const rows: readonly TableRow[] = deliverables.flatMap((item) => {
    const submission = currentSubmission(item);
    if (submission === null) return [];

    const evaluation = submission.evaluation ?? null;

    return [
      {
        key: item.id,
        cells: [
          <span key="assignment">
            <span className="font-medium">{item.assignment.title}</span>
            <span className="block text-xs text-[var(--edu-text-secondary)]">
              Semana {item.assignment.weekNumber}
            </span>
          </span>,
          <span key="revision" className="tabular">
            {submission.revisionNumber}
          </span>,
          <span key="due" className="tabular text-[var(--edu-text-secondary)]">
            {formatDate(item.assignment.dueAt, 'America/Lima')}
          </span>,
          <StatusChip key="status" kind="submissionStatus" value={submission.status} />,
          <span key="score" className="tabular font-mono">
            {evaluation === null ? '—' : `${evaluation.score} / ${item.assignment.maxScore}`}
          </span>,
        ],
      },
    ];
  });

  return (
    <AppShell
      me={me}
      currentPath="/admin/entregables"
      aside={
        <Card variant="quiet" title="Supervisar no es evaluar">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Desde aquí se comprueba que el ciclo avance, no se abre el trabajo de nadie. El
            contenido es del mentor y cada descarga queda auditada.
          </p>
        </Card>
      }
    >
      <h1 className="text-2xl font-bold tracking-tight">Entregables</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric value={`${awaitingParticipant}`} label="Esperando al participante" />
        <Metric value={`${awaitingMentor}`} label="Esperando al mentor" />
        <Metric value={`${deliverables.length}`} label="En la oleada" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Ningún resultado con estos filtros"
          body="Prueba quitando algún filtro o cambiando de semana."
        />
      ) : (
        <ResponsiveTable
          caption="Entregables de la oleada y su estado de cumplimiento"
          headers={['Consigna', 'Rev.', 'Vence', 'Estado', 'Puntaje']}
          rows={rows}
        />
      )}
    </AppShell>
  );
}
