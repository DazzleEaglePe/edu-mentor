import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { StatusChip } from '@/components/ui/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { loadAuthMe, loadSessionDetail } from '@/lib/api/fixtures';
import { formatDate, formatInterval } from '@/lib/format';
import { translateSessionType } from '@/lib/domain/labels';

/**
 * P2 · Mis sesiones.
 *
 * Lista antes que calendario: el participante tiene ~12 sesiones en todo el
 * programa y una lista agrupada se lee mejor que una grilla horaria.
 *
 * El chip muestra **su confirmación**, no el estado de la sesión: son ejes
 * distintos y mezclarlos contradice DEC-007.
 */
export default async function SesionesPage() {
  const [me, session] = await Promise.all([loadAuthMe(), loadSessionDetail()]);
  const sessions = [session];

  return (
    <AppShell me={me} currentPath="/sesiones">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Mis sesiones</h1>
        <p className="text-xs text-[var(--edu-text-secondary)]">Zona horaria: {session.timezone}</p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="Todavía no tienes sesiones agendadas"
          body="Tu mentor las programará al iniciar la semana. Te avisaremos cuando estén listas."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((item) => {
            const mine = item.participants.find(
              (participant) => participant.enrollmentId === me.activeEnrollment?.id,
            );

            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-[var(--edu-radius-md)] border border-[var(--edu-border)] bg-[var(--edu-surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-[var(--edu-text-secondary)]">
                      {formatDate(item.startsAt, item.timezone)} ·{' '}
                      {formatInterval(item.startsAt, item.endsAt, item.timezone).replace(
                        /^de /,
                        '',
                      )}
                    </p>
                    <p className="text-sm text-[var(--edu-text-secondary)]">
                      {translateSessionType(item.type)} · {item.mentor.fullName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {mine === undefined ? null : (
                      <StatusChip
                        kind="confirmationStatus"
                        value={mine.confirmationStatus}
                        prefix="Tu asistencia"
                      />
                    )}
                    <StatusChip kind="sessionStatus" value={item.status} />
                  </div>
                </div>

                <div className="flex flex-wrap items-start gap-3">
                  {item.canConfirm ? (
                    <Button
                      id={`confirm-attendance-${item.id}`}
                      disabled
                      disabledReason="Disponible cuando activemos el portal."
                    >
                      Confirmar asistencia
                    </Button>
                  ) : (
                    <Button
                      id={`confirm-attendance-${item.id}`}
                      disabled
                      disabledReason={`La confirmación cerró el ${formatDate(item.confirmationClosesAt, item.timezone)}.`}
                    >
                      Confirmar asistencia
                    </Button>
                  )}
                  <Link
                    href={`/sesiones/${item.id}`}
                    className="self-center text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
                  >
                    Ver detalle
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
