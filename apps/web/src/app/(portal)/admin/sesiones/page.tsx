import { AppShell } from '@/components/shell/app-shell';
import { Card, Metric } from '@/components/ui/card';
import { ResponsiveTable, type TableRow } from '@/components/ui/responsive-table';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import {
  loadAdminAuthMe,
  loadGroupSession,
  loadRescheduledSession,
  loadSessionDetail,
} from '@/lib/api/fixtures';
import { describeConfirmations, describePeriod, sortForAgenda } from '@/lib/domain/agenda';
import { translateSessionType } from '@/lib/domain/labels';
import { formatDate, formatInterval } from '@/lib/format';

/**
 * A2 · Supervisión de sesiones.
 *
 * El admin ve toda la organización, no solo lo suyo. La diferencia con la
 * agenda del mentor no es de permisos sino de propósito: el mentor opera sus
 * sesiones, el admin busca **lo que está en riesgo**.
 *
 * Por eso arriba va el conteo de personas sin responder y no un total de
 * sesiones: un total no le dice a nadie qué hacer.
 */
export default async function AdminSesionesPage() {
  const [me, oneOnOne, group, rescheduled] = await Promise.all([
    loadAdminAuthMe(),
    loadSessionDetail(),
    loadGroupSession(),
    loadRescheduledSession(),
  ]);

  const sessions = sortForAgenda([oneOnOne, group, rescheduled]);
  const scheduled = sessions.filter((item) => item.status === 'SCHEDULED');
  const awaiting = sessions.reduce(
    (total, item) => total + item.confirmationSummary.pending,
    0,
  );

  const rows: readonly TableRow[] = sessions.map((session) => {
    const period = describePeriod(session);

    return {
      key: session.id,
      cells: [
        <span key="title">
          <span className="font-medium">{session.title}</span>
          <span className="block text-xs text-[var(--edu-text-secondary)]">
            {translateSessionType(session.type)}
            {period === null ? '' : ` · ${period}`}
          </span>
        </span>,
        session.mentor.fullName,
        <span key="when" className="tabular text-[var(--edu-text-secondary)]">
          {formatDate(session.startsAt, session.timezone)}
          <span className="block text-xs">
            {formatInterval(session.startsAt, session.endsAt, session.timezone).replace(/^de /, '')}
          </span>
        </span>,
        <span key="confirmations" className="text-[var(--edu-text-secondary)]">
          {describeConfirmations(session.confirmationSummary)}
        </span>,
        <StatusChip key="status" kind="sessionStatus" value={session.status} />,
      ],
    };
  });

  return (
    <AppShell
      me={me}
      currentPath="/admin/sesiones"
      aside={
        <Card variant="quiet" title="Qué mirar aquí">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Una sesión reprogramada no desaparece: queda en el listado como historial, encadenada a
            la que la reemplazó. Cancelar y reprogramar siempre dejan rastro.
          </p>
        </Card>
      }
    >
      <h1 className="text-2xl font-bold tracking-tight">Sesiones</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric value={`${scheduled.length}`} label="Programadas" />
        <Metric value={`${awaiting}`} label="Personas sin responder" />
        <Metric value={`${sessions.length}`} label="En el periodo" />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="Ningún resultado con estos filtros"
          body="Prueba ampliando el rango de fechas o quitando algún filtro."
        />
      ) : (
        <ResponsiveTable
          caption="Sesiones de la organización en el periodo"
          headers={['Sesión', 'Mentor', 'Cuándo', 'Confirmaciones', 'Estado']}
          rows={rows}
        />
      )}
    </AppShell>
  );
}
