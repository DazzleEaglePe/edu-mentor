import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { loadAuthMe, loadSessionDetail } from '@/lib/api/fixtures';
import { formatDate, formatDateTime, formatInterval } from '@/lib/format';
import { translateSessionType } from '@/lib/domain/labels';

/**
 * P3 + P4 + P5 · Detalle de sesión, confirmación y solicitud de cambio.
 *
 * El journey más frecuente del programa: ~12 confirmaciones por participante,
 * casi siempre desde el celular.
 *
 * Tres reglas del contrato viven en esta pantalla:
 *
 * 1. `canConfirm` decide si los controles están activos, y cuando no lo están
 *    **el motivo se escribe al lado** — el tipo de `Button` lo exige.
 * 2. Confirmar y declinar son el mismo endpoint con distinto `status`; declinar
 *    es reversible mientras la ventana siga abierta.
 * 3. Solicitar reprogramación es otra cosa: mientras se decide, la sesión sigue
 *    `SCHEDULED` y hay que confirmar igual.
 *
 * Las mutaciones esperan al vertical slice de auth: sin cliente HTTP no se
 * simula un éxito que el backend no confirmó.
 */
export default async function SesionDetallePage({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  const [me, session] = await Promise.all([loadAuthMe(), loadSessionDetail()]);

  // Con fixtures solo existe una sesión; el resto se comporta como 404.
  if (sessionId !== session.id) {
    notFound();
  }

  const enrollment = me.activeEnrollment ?? null;
  const mine = session.participants.find(
    (participant) => participant.enrollmentId === enrollment?.id,
  );

  const closesAt = formatDateTime(session.confirmationClosesAt, session.timezone);
  const isOpen = session.canConfirm;

  return (
    <AppShell
      me={me}
      currentPath="/sesiones"
      aside={
        <Card variant="quiet" title="Si necesitas otra fecha">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Puedes pedirle a tu mentor que mueva la sesión. Mientras lo decide,{' '}
            <strong>la sesión sigue en pie</strong> y debes confirmar igual.
          </p>
          <Button
            id="request-reschedule"
            variant="ghost"
            disabled
            disabledReason="Disponible cuando activemos el portal."
          >
            Solicitar reprogramación
          </Button>
        </Card>
      }
    >
      <Link
        href="/sesiones"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a mis sesiones
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[var(--edu-radius-sm)] bg-[var(--edu-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--edu-text-secondary)]">
          {translateSessionType(session.type)}
          {typeof session.weekNumber === 'number' ? ` · Semana ${session.weekNumber}` : ''}
        </span>
        <StatusChip kind="sessionStatus" value={session.status} />
        {mine === undefined ? null : (
          <StatusChip
            kind="confirmationStatus"
            value={mine.confirmationStatus}
            prefix="Tu asistencia"
          />
        )}
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>

      <Card>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">Cuándo:</dt>
            <dd>
              {formatDate(session.startsAt, session.timezone)},{' '}
              {formatInterval(session.startsAt, session.endsAt, session.timezone).replace(
                /^de /,
                '',
              )}{' '}
              ({session.timezone})
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">Con:</dt>
            <dd>{session.mentor.fullName}</dd>
          </div>
        </dl>

        {typeof session.description === 'string' && session.description.length > 0 ? (
          <p className="text-sm text-[var(--edu-text-secondary)]">{session.description}</p>
        ) : null}

        <div className="flex flex-wrap items-start gap-3 border-t border-[var(--edu-border)] pt-3">
          {isOpen ? (
            <>
              <Button
                id="confirm-attendance"
                disabled
                disabledReason="Disponible cuando activemos el portal."
              >
                Confirmar asistencia
              </Button>
              <Button
                id="decline-attendance"
                variant="ghost"
                disabled
                disabledReason="Disponible cuando activemos el portal."
              >
                No podré asistir
              </Button>
            </>
          ) : (
            <Button
              id="confirm-attendance"
              disabled
              disabledReason={`La confirmación cerró el ${closesAt}.`}
            >
              Confirmar asistencia
            </Button>
          )}
        </div>

        {isOpen ? (
          <p className="text-xs text-[var(--edu-text-secondary)]">
            Puedes cambiar tu respuesta hasta el {closesAt}.
          </p>
        ) : null}
      </Card>

      {typeof session.meetingUrl === 'string' ? (
        <Card variant="quiet" title="Enlace de la reunión">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Estará disponible poco antes de que empiece la sesión.
          </p>
        </Card>
      ) : null}
    </AppShell>
  );
}
