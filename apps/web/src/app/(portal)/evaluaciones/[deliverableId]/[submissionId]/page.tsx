import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { loadDeliverableDetail, loadMentorAuthMe } from '@/lib/api/fixtures';
import { formatFileSize } from '@/lib/domain/deliverables';
import { feedbackMaxLength, reviewActionsFor, rubricMaximum } from '@/lib/domain/evaluation';
import { formatDate } from '@/lib/format';

/**
 * M12 + M13 + M14 · Tomar, evaluar y devolver una revisión.
 *
 * Dos columnas porque evaluar exige mirar el trabajo y escribir a la vez. Es
 * donde el mentor pasa más tiempo de todo el programa.
 *
 * Tres reglas del contrato viven aquí:
 *
 * 1. **`start-review` es explícito.** Una revisión `SUBMITTED` se toma antes de
 *    poder evaluarla, y el botón lo dice.
 * 2. **La rúbrica viene de la consigna**, con el `maxScore` de cada criterio.
 *    Un 50 es válido en un criterio de 60 e imposible en uno de 40, así que la
 *    validación es por criterio y no contra el rango global.
 * 3. **Devolver exige motivo.** El contrato lo permitiría vacío; el diseño no:
 *    sin motivo, el participante recibe un "corrige" sin saber qué.
 *
 * El puntaje total **no se autocompleta** con la suma de la rúbrica: el
 * contrato tiene `score` y `rubricScores` como campos independientes y no dice
 * que uno derive del otro. La suma se muestra como referencia.
 */
export default async function EvaluarRevisionPage({
  params,
}: {
  readonly params: Promise<{ readonly deliverableId: string; readonly submissionId: string }>;
}) {
  const { deliverableId, submissionId } = await params;
  const [me, deliverable] = await Promise.all([loadMentorAuthMe(), loadDeliverableDetail()]);

  if (deliverableId !== deliverable.id) {
    notFound();
  }

  const submission = deliverable.submissions.find((item) => item.id === submissionId);
  if (submission === undefined) {
    notFound();
  }

  const actions = reviewActionsFor(submission);
  const { assignment } = deliverable;
  const maximum = rubricMaximum(assignment.rubric);
  const blockedReason = actions.canEvaluate
    ? 'Disponible cuando activemos el portal.'
    : actions.canStartReview
      ? 'Toma la revisión antes de evaluarla.'
      : 'Esta revisión ya no admite cambios.';

  return (
    <AppShell
      me={me}
      currentPath="/evaluaciones"
      aside={
        <Card variant="quiet" title="Cómo se puntúa">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Cada criterio tiene su propio máximo. La suma de la rúbrica llega a {maximum}, pero el
            puntaje final lo decides tú: son campos independientes en el contrato.
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
        href="/evaluaciones"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a la cola
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[var(--edu-radius-sm)] bg-[var(--edu-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--edu-text-secondary)]">
          Semana {assignment.weekNumber} · revisión {submission.revisionNumber}
        </span>
        <StatusChip kind="submissionStatus" value={submission.status} />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
      <p className="text-sm text-[var(--edu-text-secondary)]">
        Entrega hasta el {formatDate(assignment.dueAt, 'America/Lima')}
      </p>

      {actions.canStartReview ? (
        <Card variant="emphasis">
          <p className="text-sm">
            Al tomar esta revisión quedará marcada como <em>en evaluación</em> y el resto del equipo
            verá que la estás revisando.
          </p>
          <Button
            id="start-review"
            disabled
            disabledReason="Disponible cuando activemos el portal."
          >
            Tomar y evaluar
          </Button>
        </Card>
      ) : null}

      <Card title="Lo que envió">
        {submission.files.length === 0 ? (
          <p className="text-sm text-[var(--edu-text-secondary)]">Sin archivos adjuntos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {submission.files.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--edu-radius-sm)] border border-[var(--edu-border)] px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-all">{file.originalName}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular font-mono text-xs text-[var(--edu-text-secondary)]">
                    {formatFileSize(file.sizeBytes)}
                  </span>
                  <Button
                    id={`download-${file.id}`}
                    variant="ghost"
                    disabled
                    disabledReason="Disponible cuando activemos el portal."
                  >
                    Descargar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {typeof submission.notes === 'string' && submission.notes.length > 0 ? (
          <div className="border-t border-[var(--edu-border)] pt-3">
            <p className="text-xs font-semibold text-[var(--edu-text-secondary)]">
              Notas del participante
            </p>
            <p className="text-sm">{submission.notes}</p>
          </div>
        ) : null}

        <p className="text-xs text-[var(--edu-text-secondary)]">
          Cada descarga queda auditada y se valida que la entrega sea de alguien a tu cargo.
        </p>
      </Card>

      <Card title="Tu evaluación">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Retroalimentación</span>
          <span className="min-h-24 rounded-[var(--edu-radius-sm)] border border-[var(--edu-border-strong)] px-3 py-2 text-[var(--edu-text-secondary)]">
            Qué hizo bien · qué mejorar · siguiente paso concreto
          </span>
          <span className="text-xs text-[var(--edu-text-secondary)]">
            Entre 10 y {feedbackMaxLength} caracteres.
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Criterios de esta consigna</span>
          {assignment.rubric.map((criterion) => (
            <div
              key={criterion.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--edu-radius-sm)] border border-[var(--edu-border)] px-3 py-2 text-sm"
            >
              <span>{criterion.label}</span>
              <span className="tabular font-mono text-xs text-[var(--edu-text-secondary)]">
                — / {criterion.maxScore}
              </span>
            </div>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Puntaje final (0–100)</span>
          <span className="rounded-[var(--edu-radius-sm)] border border-[var(--edu-border-strong)] px-3 py-2 text-[var(--edu-text-secondary)]">
            —
          </span>
          <span className="text-xs text-[var(--edu-text-secondary)]">
            No se calcula solo: la suma de la rúbrica es una referencia, no el total.
          </span>
        </label>

        <div className="flex flex-wrap items-start gap-3">
          <Button id="save-evaluation" disabled disabledReason={blockedReason}>
            Guardar evaluación
          </Button>
          <Button
            id="return-submission"
            variant="ghost"
            disabled
            disabledReason={
              actions.canReturn
                ? 'Escribe qué debe corregir antes de devolver.'
                : 'Esta revisión no se puede devolver ahora.'
            }
          >
            Devolver para corrección
          </Button>
        </div>

        <p className="text-xs text-[var(--edu-text-secondary)]">
          Al devolver, el participante recibe tu retroalimentación y podrá crear una revisión nueva.
          El historial se conserva completo.
        </p>
      </Card>
    </AppShell>
  );
}
