import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { loadAuthMe, loadDeliverableDetail } from '@/lib/api/fixtures';
import {
  canSubmitRevision,
  currentSubmission,
  formatFileSize,
  summarizeSubmission,
} from '@/lib/domain/deliverables';
import { formatDate } from '@/lib/format';

/**
 * P7 · Detalle de la consigna y mi entrega.
 *
 * Dos decisiones de diseño que el contrato hizo posibles:
 *
 * 1. **La rúbrica se muestra antes de entregar**, no solo al recibir la nota.
 *    Los criterios vienen de `assignment.rubric[]`, así que son los reales de
 *    esta consigna y no una lista escrita a mano.
 * 2. **El botón de enviar dice qué falta.** `canSubmitRevision` devuelve el
 *    motivo del bloqueo, no un booleano, y `Button` exige ese motivo por tipo.
 *
 * El envío real espera al vertical slice de auth: sin cliente HTTP no se
 * simula un éxito que el backend no confirmó.
 */
export default async function EntregableDetallePage({
  params,
}: {
  readonly params: Promise<{ readonly deliverableId: string }>;
}) {
  const { deliverableId } = await params;
  const [me, deliverable] = await Promise.all([loadAuthMe(), loadDeliverableDetail()]);

  if (deliverableId !== deliverable.id) {
    notFound();
  }

  const submission = currentSubmission(deliverable);
  if (submission === null) {
    notFound();
  }

  const summary = summarizeSubmission(submission.status);
  const submitBlock = canSubmitRevision(submission);
  const { assignment } = deliverable;
  const dueDate = formatDate(assignment.dueAt, 'America/Lima');

  return (
    <AppShell
      me={me}
      currentPath="/entregables"
      aside={
        <Card variant="quiet" title="Cómo se evalúa">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Estos son los criterios de esta consigna. Los ves antes de entregar, no después.
          </p>
          <ul className="flex flex-col gap-2">
            {assignment.rubric.map((criterion) => (
              <li key={criterion.id} className="border-t border-[var(--edu-border)] pt-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{criterion.label}</span>
                  <span className="tabular font-mono text-xs text-[var(--edu-text-secondary)]">
                    hasta {criterion.maxScore}
                  </span>
                </div>
                {typeof criterion.description === 'string' ? (
                  <p className="text-xs text-[var(--edu-text-secondary)]">
                    {criterion.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      }
    >
      <Link
        href="/entregables"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a mis entregables
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[var(--edu-radius-sm)] bg-[var(--edu-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--edu-text-secondary)]">
          Semana {assignment.weekNumber}
        </span>
        <StatusChip kind="submissionStatus" value={submission.status} />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
      <p className="text-sm text-[var(--edu-text-secondary)]">
        {summary.title} · entrega hasta el {dueDate} (America/Lima)
      </p>

      <Card title="Qué tienes que hacer">
        <p className="text-sm whitespace-pre-line">{assignment.instructions}</p>
      </Card>

      <Card title={`Tu entrega · revisión ${submission.revisionNumber}`}>
        {submission.files.length === 0 ? (
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Todavía no has adjuntado archivos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {submission.files.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--edu-radius-sm)] border border-[var(--edu-border)] px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{file.originalName}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular font-mono text-xs text-[var(--edu-text-secondary)]">
                    {formatFileSize(file.sizeBytes)}
                  </span>
                  {/* `CLEAN` no muestra chip: es lo normal y no merece ruido. */}
                  {file.scanStatus === 'CLEAN' ? null : (
                    <StatusChip kind="scanStatus" value={file.scanStatus} />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {typeof submission.notes === 'string' && submission.notes.length > 0 ? (
          <div className="border-t border-[var(--edu-border)] pt-3">
            <p className="text-xs font-semibold text-[var(--edu-text-secondary)]">
              Notas para tu mentora
            </p>
            <p className="text-sm">{submission.notes}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-3 border-t border-[var(--edu-border)] pt-3">
          <Button
            id="submit-revision"
            disabled
            disabledReason={
              submitBlock.canSubmit ? 'Disponible cuando activemos el portal.' : submitBlock.reason
            }
          >
            Enviar entregable
          </Button>
        </div>

        {submission.status === 'DRAFT' ? (
          <p className="text-xs text-[var(--edu-text-secondary)]">
            Al enviar se congela esta versión y tu mentora la recibe para evaluar.{' '}
            <strong>Si te pide ajustes, podrás reenviar sin perder lo anterior.</strong>
          </p>
        ) : null}
      </Card>

      {submission.evaluation === null || submission.evaluation === undefined ? null : (
        <Card title="Retroalimentación">
          <p className="tabular font-mono text-lg font-bold">
            {submission.evaluation.score} / {assignment.maxScore}
          </p>
          <p className="text-sm whitespace-pre-line">{submission.evaluation.feedback}</p>
        </Card>
      )}
    </AppShell>
  );
}
