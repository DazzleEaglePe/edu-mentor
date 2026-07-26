import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, Metric } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import { loadGroupSession, loadMentorAuthMe, loadSessionDetail } from '@/lib/api/fixtures';
import {
  actionsFor,
  awaitingResponse,
  describeConfirmations,
  describePeriod,
  groupByDay,
  sortForAgenda,
} from '@/lib/domain/agenda';
import { translateSessionType } from '@/lib/domain/labels';
import { formatDate, formatInterval } from '@/lib/format';

/**
 * M2 + M3 · Mi agenda.
 *
 * Lista agrupada por día, no grilla horaria. El roadmap es explícito: primero
 * funciona el ciclo de negocio, después el calendario visual — y una lista
 * agrupada ya resuelve "qué tengo y qué me falta" sin inventar una grilla que
 * todavía no puede arrastrar ni redimensionar nada.
 *
 * El desglose de confirmaciones sale de `confirmationSummary`, no de contar
 * participantes: así no depende de cuántos venga la página.
 */
export default async function AgendaPage() {
  const [me, oneOnOne, groupSession] = await Promise.all([
    loadMentorAuthMe(),
    loadSessionDetail(),
    loadGroupSession(),
  ]);

  const now = new Date();
  const sessions = sortForAgenda([oneOnOne, groupSession]);
  const days = groupByDay(sessions);
  const pendingResponses = sessions.reduce(
    (total, session) => total + session.confirmationSummary.pending,
    0,
  );

  return (
    <AppShell
      me={me}
      currentPath="/agenda"
      aside={
        <Card variant="quiet" title="Sin responder">
          {pendingResponses === 0 ? (
            <p className="text-sm text-[var(--edu-text-secondary)]">
              Todo el mundo respondió. No hay a quién recordarle.
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--edu-text-secondary)]">
                Quien declinó ya respondió: recordarle sería molestar. Estas son las personas que
                aún no dicen nada.
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {sessions.flatMap((session) =>
                  awaitingResponse(session).map((participant) => (
                    <li key={`${session.id}-${participant.enrollmentId}`}>
                      {participant.participant.fullName}
                      <span className="block text-xs text-[var(--edu-text-secondary)]">
                        {session.title}
                      </span>
                    </li>
                  )),
                )}
              </ul>
            </>
          )}
        </Card>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Mi agenda</h1>
        <Link
          href="/agenda/nueva"
          className="inline-flex min-h-[2.5rem] items-center rounded-[var(--edu-radius-sm)] bg-[var(--edu-action-primary-bg)] px-4 text-sm font-semibold text-[var(--edu-action-primary-text)]"
        >
          Agendar sesión
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric value={`${sessions.length}`} label="Sesiones en la agenda" />
        <Metric value={`${pendingResponses}`} label="Sin responder" />
      </div>

      {days.length === 0 ? (
        <EmptyState
          title="No tienes sesiones esta semana"
          body="Agenda la sesión grupal y las 1:1 de la semana."
        />
      ) : (
        days.map((day) => (
          <section key={day.day} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[var(--edu-text-secondary)]">
              {formatDate(`${day.day}T12:00:00Z`, 'America/Lima')}
            </h2>

            {day.sessions.map((session) => {
              const actions = actionsFor(session, now);
              const period = describePeriod(session);

              return (
                <Card key={session.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{session.title}</p>
                      <p className="text-sm text-[var(--edu-text-secondary)]">
                        {formatInterval(session.startsAt, session.endsAt, session.timezone).replace(
                          /^de /,
                          '',
                        )}{' '}
                        ({session.timezone})
                      </p>
                      <p className="text-sm text-[var(--edu-text-secondary)]">
                        {translateSessionType(session.type)}
                        {period === null ? '' : ` · ${period}`} ·{' '}
                        {describeConfirmations(session.confirmationSummary)}
                      </p>
                    </div>
                    <StatusChip kind="sessionStatus" value={session.status} />
                  </div>

                  <div className="flex flex-wrap items-start gap-3">
                    <Button
                      id={`reschedule-${session.id}`}
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
                      id={`complete-${session.id}`}
                      variant="ghost"
                      disabled
                      disabledReason={
                        actions.canComplete
                          ? 'Disponible cuando activemos el portal.'
                          : 'Disponible cuando la sesión haya empezado.'
                      }
                    >
                      Completar y registrar asistencia
                    </Button>
                  </div>
                </Card>
              );
            })}
          </section>
        ))
      )}
    </AppShell>
  );
}
