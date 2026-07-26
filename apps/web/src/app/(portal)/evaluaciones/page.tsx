import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Card, Metric } from '@/components/ui/card';
import { ResponsiveTable, type TableRow } from '@/components/ui/responsive-table';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import { loadDeliverableDetail, loadMentorAuthMe } from '@/lib/api/fixtures';
import { currentSubmission } from '@/lib/domain/deliverables';
import { reviewActionsFor, sortQueue } from '@/lib/domain/evaluation';
import { formatRelative } from '@/lib/format';

/**
 * M11 · Cola de evaluación.
 *
 * Es una **cola de trabajo**, no un listado: se ordena por antigüedad de envío,
 * porque lo que importa es cuánto lleva alguien esperando. Un orden alfabético
 * dejaría siempre a la misma persona al final.
 *
 * Por eso también el tiempo es relativo —"hace 3 días"— y no una fecha
 * absoluta: nadie calcula mentalmente cuánto lleva esperando un 12 de agosto.
 */
export default async function EvaluacionesPage() {
  const [me, deliverable] = await Promise.all([loadMentorAuthMe(), loadDeliverableDetail()]);
  const queue = sortQueue([deliverable]);

  const pending = queue.filter((item) => {
    const submission = currentSubmission(item);
    if (submission === null) return false;
    const actions = reviewActionsFor(submission);
    return actions.canStartReview || actions.canEvaluate;
  });

  const rows: readonly TableRow[] = queue.flatMap((item) => {
    const submission = currentSubmission(item);
    if (submission === null) return [];

    const actions = reviewActionsFor(submission);
    const submittedAt = submission.submittedAt;

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
          <span key="when" className="text-[var(--edu-text-secondary)]">
            {typeof submittedAt === 'string' ? formatRelative(submittedAt) : 'Sin enviar'}
          </span>,
          <StatusChip key="status" kind="submissionStatus" value={submission.status} />,
          <Link
            key="action"
            href={`/evaluaciones/${item.id}/${submission.id}`}
            className="inline-flex min-h-[2.5rem] items-center rounded-[var(--edu-radius-sm)] border border-[var(--edu-border-strong)] px-3 text-sm font-semibold"
          >
            {actions.canStartReview ? 'Tomar y evaluar' : 'Ver'}
          </Link>,
        ],
      },
    ];
  });

  return (
    <AppShell
      me={me}
      currentPath="/evaluaciones"
      aside={
        <Card variant="quiet" title="Tomar antes de evaluar">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Al abrir una entrega, esta queda marcada como <em>en evaluación</em> y el resto del
            equipo ve que alguien la está revisando. Por eso el botón dice “tomar y evaluar”: nombra
            lo que de verdad ocurre.
          </p>
        </Card>
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Entregas por evaluar</h1>
        <p className="text-sm text-[var(--edu-text-secondary)]">
          Ordenadas por antigüedad de envío
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric value={`${pending.length}`} label="Esperando tu revisión" />
        <Metric value={`${queue.length}`} label="En tu cola" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No tienes entregas pendientes"
          body="Vuelve cuando tus participantes envíen sus trabajos."
        />
      ) : (
        <ResponsiveTable
          caption="Entregas pendientes de evaluación, ordenadas por antigüedad"
          headers={['Consigna', 'Rev.', 'Enviada', 'Estado', '']}
          rows={rows}
        />
      )}
    </AppShell>
  );
}
