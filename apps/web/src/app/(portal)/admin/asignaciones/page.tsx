import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import {
  loadAdminEnrollment,
  loadAdminMentorAssignment,
  loadAdminOleada,
  loadAuthMe,
} from '@/lib/api/fixtures';
import {
  assignmentPeriod,
  coveredEnrollmentIds,
  isReadOnly,
  scopeOf,
  type Enrollment,
} from '@/lib/domain/cohorts';
import { translateRole } from '@/lib/domain/labels';
import { formatDate } from '@/lib/format';

const day = (iso: string) => formatDate(iso, 'America/Lima');

/**
 * A8 · Asignaciones de mentoría.
 *
 * `enrollmentId` es **nullable**, así que una asignación cubre la oleada
 * completa —el mentor de los talleres grupales— o a un participante concreto.
 * La tabla muestra ambos alcances; asumir 1:1 dejaría fuera el caso que el
 * contrato modela explícitamente.
 *
 * Cerrar una asignación es un `DELETE` semántico: la fila permanece con su
 * periodo y sin acciones, porque el historial de quién acompañó a quién es
 * parte de la trazabilidad del programa.
 */
export default async function AdminAsignacionesPage() {
  const [me, oleada, enrollment, assignment] = await Promise.all([
    loadAuthMe(),
    loadAdminOleada(),
    loadAdminEnrollment(),
    loadAdminMentorAssignment(),
  ]);

  const assignments = [assignment];
  const activeEnrollments: readonly Enrollment[] = [enrollment].filter(
    (item) => item.status === 'ACTIVE',
  );
  const covered = coveredEnrollmentIds(assignments, activeEnrollments);
  const uncovered = activeEnrollments.filter((item) => !covered.has(item.id));
  const readOnly = isReadOnly(oleada);

  return (
    <AppShell
      me={me}
      currentPath="/admin/oleadas"
      aside={
        <Card variant="quiet" title="Dos alcances">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Una asignación puede cubrir <strong>toda la oleada</strong> —útil para quien dicta las
            sesiones grupales— o a <strong>un participante</strong>. El contrato modela ambos con
            un <code>enrollmentId</code> que puede venir vacío.
          </p>
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Reasignar cierra la anterior y la deja en el historial: no se borra.
          </p>
        </Card>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asignaciones de mentoría</h1>
          <p className="text-sm text-[var(--edu-text-secondary)]">{oleada.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            id="assign-participant"
            variant="ghost"
            disabled
            disabledReason={
              readOnly ? 'La oleada está cerrada.' : 'Disponible cuando activemos el portal.'
            }
          >
            Asignar a un participante
          </Button>
          <Button
            id="assign-oleada"
            variant="ghost"
            disabled
            disabledReason={
              readOnly ? 'La oleada está cerrada.' : 'Disponible cuando activemos el portal.'
            }
          >
            Asignar a toda la oleada
          </Button>
        </div>
      </div>

      {uncovered.length > 0 ? (
        <Card variant="emphasis">
          <p className="text-sm">
            <strong>{uncovered.length} participante(s) sin mentor vigente.</strong> Asígnales uno
            antes de abrir la oleada: sin asignación, su mentor no puede agendar sesiones.
          </p>
        </Card>
      ) : null}

      {assignments.length === 0 ? (
        <EmptyState
          title="Aún no hay mentores asignados"
          body="Asigna un mentor a cada participante, o uno para toda la oleada."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--edu-radius-md)] border border-[var(--edu-border)]">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Asignaciones de mentoría de la oleada</caption>
            <thead>
              <tr className="bg-[var(--edu-surface-sunken)] text-left">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Mentor
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Alcance
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Capacidad
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Vigencia
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => {
                const scope = scopeOf(item);
                const target =
                  scope === 'OLEADA'
                    ? 'Toda la oleada'
                    : (activeEnrollments.find((row) => row.id === item.enrollmentId)?.user
                        .fullName ?? 'Participante');

                return (
                  <tr key={item.id} className="border-t border-[var(--edu-border)] align-top">
                    <td className="px-3 py-2 font-medium">{item.mentor.fullName}</td>
                    <td className="px-3 py-2">
                      {scope === 'OLEADA' ? <em>{target}</em> : target}
                    </td>
                    <td className="px-3 py-2 text-[var(--edu-text-secondary)]">
                      {item.capability === 'SPECIALIST' ? 'Especialista' : 'Mentor par'}
                    </td>
                    <td className="tabular px-3 py-2 text-[var(--edu-text-secondary)]">
                      {assignmentPeriod(item, day)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip kind="mentorAssignmentStatus" value={item.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[var(--edu-text-secondary)]">
        Rol del mentor en el programa: {translateRole('MENTOR')}.
      </p>

      <Link
        href="/admin/oleadas"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a la oleada
      </Link>
    </AppShell>
  );
}
