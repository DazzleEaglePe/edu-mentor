import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ResponsiveTable, type TableRow } from '@/components/ui/responsive-table';
import { StatusChip } from '@/components/ui/status-chip';
import {
  loadGroupSession,
  loadMentorAuthMe,
  loadRescheduledSession,
  loadSessionDetail,
} from '@/lib/api/fixtures';
import {
  actionsFor,
  attendanceBreakdown,
  describeAttendance,
  describeConfirmations,
  describePeriod,
  isSuperseded,
  replacedAnother,
} from '@/lib/domain/agenda';
import { translateSessionType } from '@/lib/domain/labels';
import { formatDate, formatInterval } from '@/lib/format';

/**
 * M6 + M7 + M8 + M9 · Detalle de sesión para el mentor.
 *
 * Las cuatro acciones viven juntas porque operan sobre el mismo objeto y en el
 * mismo momento del día: reprogramar, cancelar, completar y registrar
 * asistencia. Separarlas en cuatro pantallas obligaría a navegar de ida y
 * vuelta para algo que el mentor hace de un tirón al terminar la sesión.
 *
 * Reglas del contrato que la pantalla respeta:
 *
 * - completar y registrar asistencia **solo aparecen una vez empezada**;
 * - reprogramar y cancelar exigen `SCHEDULED`, y ambas dicen su consecuencia
 *   antes de ejecutarse;
 * - `attendanceStatus: PENDING` es **sin registrar**, no ausente;
 * - una sesión `RESCHEDULED` es historial: se muestra su encadenamiento y no
 *   admite acciones.
 */
export default async function MentorSesionDetallePage({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  const [me, oneOnOne, group, rescheduled] = await Promise.all([
    loadMentorAuthMe(),
    loadSessionDetail(),
    loadGroupSession(),
    loadRescheduledSession(),
  ]);

  // Con fixtures solo existen estas sesiones; el resto se comporta como 404.
  const session = [group, oneOnOne, rescheduled].find((item) => item.id === sessionId);
  if (session === undefined) {
    notFound();
  }

  const now = new Date();
  const actions = actionsFor(session, now);
  const attendance = attendanceBreakdown(session);
  const period = describePeriod(session);
  const superseded = isSuperseded(session);

  const rows: readonly TableRow[] = session.participants.map((item) => ({
    key: item.enrollmentId,
    cells: [
      <span key="name" className="font-medium">
        {item.participant.fullName}
      </span>,
      <StatusChip key="confirmation" kind="confirmationStatus" value={item.confirmationStatus} />,
      <StatusChip key="attendance" kind="attendanceStatus" value={item.attendanceStatus} />,
      <span key="actions" className="flex flex-wrap gap-2">
        <Button
          id={`attended-${item.enrollmentId}`}
          variant="ghost"
          disabled
          disabledReason={
            actions.canRegisterAttendance
              ? 'Disponible cuando activemos el portal.'
              : 'Disponible cuando la sesión haya empezado.'
          }
        >
          Asistió
        </Button>
        <Button
          id={`absent-${item.enrollmentId}`}
          variant="ghost"
          disabled
          disabledReason={
            actions.canRegisterAttendance
              ? 'Disponible cuando activemos el portal.'
              : 'Disponible cuando la sesión haya empezado.'
          }
        >
          No asistió
        </Button>
      </span>,
    ],
  }));

  return (
    <AppShell
      me={me}
      currentPath="/agenda"
      aside={
        <Card variant="quiet" title="Acciones sobre la sesión">
          {superseded ? (
            <p className="text-sm text-[var(--edu-text-secondary)]">
              Esta sesión fue reemplazada por otra. Se conserva como historial y no admite
              cambios.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                id="reschedule-session"
                variant="ghost"
                disabled
                disabledReason={
                  actions.canReschedule
                    ? 'Disponible cuando activemos el portal.'
                    : 'Solo se reprograma una sesión programada.'
                }
              >
                Reprogramar
              </Button>
              <Button
                id="complete-session"
                variant="ghost"
                disabled
                disabledReason={
                  actions.canComplete
                    ? 'Disponible cuando activemos el portal.'
                    : 'Disponible cuando la sesión haya empezado.'
                }
              >
                Marcar como realizada
              </Button>
              <Button
                id="cancel-session"
                variant="danger"
                disabled
                disabledReason={
                  actions.canCancel
                    ? `Se notificará a ${session.participants.length} participante(s).`
                    : 'Solo se cancela una sesión programada.'
                }
              >
                Cancelar sesión
              </Button>
            </div>
          )}
        </Card>
      }
    >
      <Link
        href="/agenda"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a mi agenda
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[var(--edu-radius-sm)] bg-[var(--edu-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--edu-text-secondary)]">
          {translateSessionType(session.type)}
          {period === null ? '' : ` · ${period}`}
        </span>
        <StatusChip kind="sessionStatus" value={session.status} />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
      <p className="text-sm text-[var(--edu-text-secondary)]">
        {formatDate(session.startsAt, session.timezone)} ·{' '}
        {formatInterval(session.startsAt, session.endsAt, session.timezone).replace(/^de /, '')} (
        {session.timezone})
      </p>

      {replacedAnother(session) ? (
        <Card variant="quiet">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Esta sesión reemplazó a una anterior. El historial completo se conserva encadenado, así
            que nada se borra al reprogramar.
          </p>
        </Card>
      ) : null}

      <Card title="Confirmaciones">
        <p className="text-sm">{describeConfirmations(session.confirmationSummary)}</p>
        <p className="text-sm text-[var(--edu-text-secondary)]">
          {describeAttendance(attendance)}
        </p>
      </Card>

      <Card title={`Participantes · ${session.participants.length}`}>
        <ResponsiveTable
          caption="Participantes de la sesión, con su confirmación y su asistencia"
          headers={['Participante', 'Confirmación', 'Asistencia', '']}
          rows={rows}
        />
        <p className="text-xs text-[var(--edu-text-secondary)]">
          Confirmar no es asistir: quien declinó puede aparecer igual, y quien confirmó puede
          faltar. La confirmación se muestra como contexto, nunca como valor por defecto.
        </p>
      </Card>
    </AppShell>
  );
}
