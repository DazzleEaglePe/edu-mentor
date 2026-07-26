import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, Metric } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import { loadAdminEnrollment, loadAdminOleada, loadAuthMe } from '@/lib/api/fixtures';
import { isReadOnly, occupancyOf } from '@/lib/domain/cohorts';
import { translateProgramPhase } from '@/lib/domain/labels';
import { formatDate } from '@/lib/format';

/**
 * A7 · Inscripciones de la oleada.
 *
 * Aquí sí vive la pertenencia a una oleada — el dato que el wireframe de A5
 * mostraba por error en la tabla de usuarios. `Enrollment` es el recurso que
 * relaciona persona y cohorte, con su fase y su semana.
 *
 * `activeEnrollmentCount` de la oleada da la ocupación sin recorrer la lista,
 * así que el conteo de arriba no depende de cuántas filas se hayan paginado.
 */
export default async function AdminEnrollmentsPage() {
  const [me, oleada, enrollment] = await Promise.all([
    loadAuthMe(),
    loadAdminOleada(),
    loadAdminEnrollment(),
  ]);

  const enrollments = [enrollment];
  const occupancy = occupancyOf(oleada);
  const readOnly = isReadOnly(oleada);

  return (
    <AppShell
      me={me}
      currentPath="/admin/oleadas"
      aside={
        <Card variant="quiet" title="Sobre los cupos">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            El backend protege la capacidad de forma transaccional: dos altas simultáneas no pueden
            exceder el cupo. Si ocurre, la segunda recibe un conflicto y esta pantalla lo muestra en
            vez de aceptar la inscripción.
          </p>
        </Card>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscripciones</h1>
          <p className="text-sm text-[var(--edu-text-secondary)]">{oleada.name}</p>
        </div>
        <Button
          id="create-enrollment"
          disabled
          disabledReason={
            readOnly
              ? 'La oleada está cerrada.'
              : occupancy.isFull
                ? 'No quedan cupos disponibles.'
                : 'Disponible cuando activemos el portal.'
          }
        >
          Inscribir participante
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric value={`${occupancy.used}/${occupancy.capacity}`} label="Cupos ocupados" />
        <Metric value={`${occupancy.remaining}`} label="Cupos disponibles" />
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          title="Nadie está inscrito todavía"
          body="Inscribe a los participantes que ya creaste para que puedan ver sus sesiones."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--edu-radius-md)] border border-[var(--edu-border)]">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Participantes inscritos en la oleada</caption>
            <thead>
              <tr className="bg-[var(--edu-surface-sunken)] text-left">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Participante
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Fase
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Inscrito
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((item) => (
                <tr key={item.id} className="border-t border-[var(--edu-border)] align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium">{item.user.fullName}</span>
                    <span className="block text-xs text-[var(--edu-text-secondary)]">
                      {item.user.email}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {translateProgramPhase(item.currentPhase)}
                    {typeof item.currentWeek === 'number' ? (
                      <span className="block text-xs text-[var(--edu-text-secondary)]">
                        Semana {item.currentWeek}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular px-3 py-2 text-[var(--edu-text-secondary)]">
                    {formatDate(item.enrolledAt, 'America/Lima')}
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip kind="enrollmentStatus" value={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href="/admin/oleadas"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a la oleada
      </Link>
    </AppShell>
  );
}
