import Link from 'next/link';
import type { ApiComponents } from '@edu-mentor/shared-types';
import { AppShell } from '@/components/shell/app-shell';
import { Card, Metric } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import { loadAuthMe, loadDeliverableDetail, loadSessionDetail } from '@/lib/api/fixtures';
import { formatDate, formatInterval } from '@/lib/format';
import { translateProgramPhase, translateSessionType } from '@/lib/domain/labels';

type SubmissionStatus = ApiComponents['schemas']['SubmissionStatus'];

/**
 * Qué dice la tarjeta del entregable según el estado **real** de la revisión.
 *
 * Sin este mapa, la pantalla decía "Pendiente de entregar" sobre una revisión
 * ya enviada: afirmaba una tarea que la persona ya había hecho. El texto se
 * deriva del estado, nunca se asume.
 */
const deliverableHeading: Record<SubmissionStatus, { title: string; needsAction: boolean }> = {
  DRAFT: { title: 'Pendiente de entregar', needsAction: true },
  RETURNED: { title: 'Tu mentora pide ajustes', needsAction: true },
  SUBMITTED: { title: 'Enviado, esperando evaluación', needsAction: false },
  UNDER_REVIEW: { title: 'Tu mentora lo está revisando', needsAction: false },
  EVALUATED: { title: 'Tienes retroalimentación', needsAction: false },
};

/**
 * P1 · Inicio del participante.
 *
 * Responde tres preguntas en este orden: cuándo es mi próxima sesión, qué debo
 * entregar y cuándo vence, y si tengo feedback nuevo. Nada más.
 *
 * Los conteos vendrán de `GET /dashboard/participant` cuando exista auth. Hoy
 * se derivan de los fixtures, y **no se muestran variaciones porcentuales**:
 * no hay serie histórica que las sostenga (CCR-004).
 */
export default async function InicioPage() {
  const [me, session, deliverable] = await Promise.all([
    loadAuthMe(),
    loadSessionDetail(),
    loadDeliverableDetail(),
  ]);

  const enrollment = me.activeEnrollment ?? null;
  const mine = session.participants.find(
    (participant) => participant.enrollmentId === enrollment?.id,
  );
  const currentSubmission = deliverable.submissions.find(
    (submission) => submission.id === deliverable.currentSubmissionId,
  );

  // Asistencia y envío se cuentan por su estado, no por la existencia del dato:
  // una sesión confirmada todavía no es una sesión asistida.
  const attendedSessions = session.participants.filter(
    (participant) =>
      participant.enrollmentId === enrollment?.id && participant.attendanceStatus === 'ATTENDED',
  ).length;
  const submittedRevisions = deliverable.submissions.filter(
    (submission) => submission.status !== 'DRAFT',
  ).length;

  const heading =
    currentSubmission === undefined ? null : deliverableHeading[currentSubmission.status];
  const dueDate = formatDate(deliverable.assignment.dueAt, session.timezone);

  return (
    <AppShell
      me={me}
      currentPath="/inicio"
      aside={
        enrollment === null ? undefined : (
          <Card title="Tu recorrido">
            <ol className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <StatusChip kind="sessionStatus" value="COMPLETED" />
                <span>Fase 0 · Selección</span>
              </li>
              <li className="flex items-center gap-2 font-semibold">
                <span aria-hidden="true">▸</span>
                <span>{translateProgramPhase(enrollment.currentPhase)}</span>
              </li>
              {typeof enrollment.currentWeek === 'number' ? (
                <li className="text-[var(--edu-text-secondary)]">
                  Semana {enrollment.currentWeek} de 6
                </li>
              ) : null}
            </ol>
            <p className="text-xs text-[var(--edu-text-secondary)]">
              Al completar la Fase 1 te gradúas y pasas al acompañamiento en tu búsqueda de empleo.
            </p>
          </Card>
        )
      }
    >
      <h1 className="text-2xl font-bold tracking-tight">Tu semana</h1>

      <Card title="Tu próxima sesión">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{session.title}</p>
            <p className="text-sm text-[var(--edu-text-secondary)]">
              {formatDate(session.startsAt, session.timezone)} ·{' '}
              {formatInterval(session.startsAt, session.endsAt, session.timezone).replace(
                /^de /,
                '',
              )}
            </p>
            <p className="text-sm text-[var(--edu-text-secondary)]">
              {translateSessionType(session.type)} · {session.mentor.fullName}
            </p>
          </div>
          {mine === undefined ? null : (
            <StatusChip
              kind="confirmationStatus"
              value={mine.confirmationStatus}
              prefix="Tu asistencia"
            />
          )}
        </div>
        <Link
          href={`/sesiones/${session.id}`}
          className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
        >
          Ver detalle y confirmar
        </Link>
      </Card>

      {currentSubmission === undefined || heading === null ? (
        <Card title="Tus entregables">
          <EmptyState
            title="Aún no hay consignas publicadas para tu semana"
            body="Cuando tu mentor publique la primera, aparecerá acá."
          />
        </Card>
      ) : (
        <Card title={heading.title} variant={heading.needsAction ? 'emphasis' : 'default'}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                Semana {deliverable.assignment.weekNumber} · {deliverable.assignment.title}
              </p>
              <p className="text-sm text-[var(--edu-text-secondary)]">
                {heading.needsAction
                  ? `Entrega hasta el ${dueDate}`
                  : `Revisión ${currentSubmission.revisionNumber}`}
              </p>
            </div>
            <StatusChip kind="submissionStatus" value={currentSubmission.status} />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric
          value={`${attendedSessions}/${session.participants.length}`}
          label="Sesiones asistidas"
        />
        <Metric
          value={`${submittedRevisions}/${deliverable.submissions.length}`}
          label="Revisiones enviadas"
        />
      </div>
    </AppShell>
  );
}
