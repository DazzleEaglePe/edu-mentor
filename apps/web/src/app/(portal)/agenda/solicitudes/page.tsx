import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import { loadMentorAuthMe, loadRescheduleRequest, loadSessionDetail } from '@/lib/api/fixtures';
import { canDecideRequest, sessionStillStands } from '@/lib/domain/agenda';
import { formatDate, formatDateTime, formatInterval, formatRelative } from '@/lib/format';

/**
 * M15 · Decidir solicitudes de reprogramación.
 *
 * La pantalla que nació de CCR-001 y la última del contrato en existir.
 *
 * Su regla más delicada: **mientras la solicitud está `PENDING`, la sesión
 * sigue `SCHEDULED`**. Si la UI insinúa que ya se movió, alguien falta a una
 * sesión que sigue en pie. Por eso el estado de la sesión se muestra al lado de
 * la solicitud, no en su lugar.
 *
 * Dos cosas que el contrato impone y aquí se respetan:
 *
 * - el participante **propone**, el mentor **decide** el horario final: es su
 *   agenda la que tiene restricciones de traslape;
 * - aprobar exige `expectedSessionVersion` **y** `expectedRequestVersion`, y un
 *   traslape deja la solicitud pendiente — no hay aprobación a medias.
 */
export default async function SolicitudesPage() {
  const [me, request, session] = await Promise.all([
    loadMentorAuthMe(),
    loadRescheduleRequest(),
    loadSessionDetail(),
  ]);

  const requests = [request];
  const pending = requests.filter(canDecideRequest);

  return (
    <AppShell
      me={me}
      currentPath="/agenda"
      aside={
        <Card variant="quiet" title="Cómo funciona">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            El participante propone una fecha; tú decides la definitiva, porque es tu agenda la que
            tiene restricciones de horario.
          </p>
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Si el horario que elijas choca con otra sesión, la solicitud sigue pendiente y no se
            aprueba a medias.
          </p>
        </Card>
      }
    >
      <Link
        href="/agenda"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a mi agenda
      </Link>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Solicitudes de reprogramación</h1>
        <p className="text-sm text-[var(--edu-text-secondary)]">
          {pending.length === 0 ? 'Ninguna pendiente' : `${pending.length} por decidir`}
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No hay solicitudes pendientes"
          body="Cuando alguien pida mover una sesión, aparecerá acá."
        />
      ) : (
        requests.map((item) => (
          <Card key={item.id} variant={canDecideRequest(item) ? 'emphasis' : 'default'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{item.requestedBy.fullName}</p>
                <p className="text-sm text-[var(--edu-text-secondary)]">
                  Solicitó {formatRelative(item.requestedAt)}
                </p>
              </div>
              <StatusChip kind="rescheduleRequestStatus" value={item.status} />
            </div>

            <div className="rounded-[var(--edu-radius-sm)] border-l-[3px] border-[var(--edu-border-strong)] bg-[var(--edu-surface-sunken)] px-3 py-2">
              <p className="text-sm italic">“{item.reason}”</p>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <p>
                <span className="font-semibold">Sesión actual:</span> {session.title} ·{' '}
                {formatInterval(session.startsAt, session.endsAt, session.timezone).replace(
                  /^de /,
                  '',
                )}{' '}
                del {formatDate(session.startsAt, session.timezone)}
              </p>
              {typeof item.proposedStartsAt === 'string' ? (
                <p>
                  <span className="font-semibold">Fecha propuesta:</span>{' '}
                  {formatDateTime(item.proposedStartsAt, session.timezone)}
                </p>
              ) : (
                <p className="text-[var(--edu-text-secondary)]">
                  No propuso fecha: la eliges tú.
                </p>
              )}
            </div>

            {sessionStillStands(item) ? (
              <p className="text-xs text-[var(--edu-text-secondary)]">
                Mientras decides, <strong>la sesión sigue programada</strong> y{' '}
                {item.requestedBy.fullName} debe confirmar su asistencia igual.
              </p>
            ) : null}

            <div className="flex flex-wrap items-start gap-3">
              <Button
                id={`approve-${item.id}`}
                disabled
                disabledReason={
                  canDecideRequest(item)
                    ? 'Disponible cuando activemos el portal.'
                    : 'Esta solicitud ya fue decidida.'
                }
              >
                Aprobar y reprogramar
              </Button>
              <Button
                id={`reject-${item.id}`}
                variant="ghost"
                disabled
                disabledReason={
                  canDecideRequest(item)
                    ? 'Disponible cuando activemos el portal.'
                    : 'Esta solicitud ya fue decidida.'
                }
              >
                Rechazar
              </Button>
            </div>
          </Card>
        ))
      )}
    </AppShell>
  );
}
