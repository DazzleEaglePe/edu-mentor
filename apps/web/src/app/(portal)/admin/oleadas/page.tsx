import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, Metric } from '@/components/ui/card';
import {
  loadAdminEnrollment,
  loadAdminMentorAssignment,
  loadAdminOleada,
  loadAdminUsers,
  loadAuthMe,
} from '@/lib/api/fixtures';
import {
  allowedTransitions,
  isReadOnly,
  occupancyOf,
  setupSteps,
  type OleadaStatus,
} from '@/lib/domain/cohorts';
import { translateStatus } from '@/lib/domain/labels';
import { formatDate } from '@/lib/format';

/**
 * A6 · Configurar la oleada.
 *
 * Setup guiado en cuatro pasos, no un formulario gigante: es la primera vez que
 * alguien de Proyectos toca la plataforma.
 *
 * Los pasos **se derivan del estado real** (`setupSteps`), no de un checklist
 * que alguien marca a mano. Si se inscribe gente por otra vía, el paso se marca
 * solo; un stepper manual mentiría en cuanto alguien trabaje fuera de él.
 */
export default async function AdminOleadasPage() {
  const [me, oleada, users, enrollment, assignment] = await Promise.all([
    loadAuthMe(),
    loadAdminOleada(),
    loadAdminUsers(),
    loadAdminEnrollment(),
    loadAdminMentorAssignment(),
  ]);

  const occupancy = occupancyOf(oleada);
  const readOnly = isReadOnly(oleada);
  const steps = setupSteps({
    oleada,
    userCount: users.meta.total,
    enrollments: [enrollment],
    assignments: [assignment],
  });
  const pendingSteps = steps.filter((step) => !step.done);
  const transitions = allowedTransitions(oleada.status);

  return (
    <AppShell
      me={me}
      currentPath="/admin/oleadas"
      aside={
        <Card variant="quiet" title="Estado de la oleada">
          <p className="text-sm">
            {translateStatus('oleadaStatus', oleada.status)?.label ?? oleada.status}
          </p>
          {transitions.length === 0 ? (
            <p className="text-sm text-[var(--edu-text-secondary)]">
              Una oleada cerrada es de solo lectura. Reabrirla no sería una edición, sería otra
              decisión de programa.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {transitions.map((next: OleadaStatus) => (
                <Button
                  key={next}
                  id={`transition-${next.toLowerCase()}`}
                  variant="ghost"
                  disabled
                  disabledReason={
                    next === 'OPEN' && pendingSteps.length > 0
                      ? `Faltan ${pendingSteps.length} paso(s) del setup.`
                      : 'Disponible cuando activemos el portal.'
                  }
                >
                  {translateStatus('oleadaStatus', next)?.label ?? next}
                </Button>
              ))}
            </div>
          )}
        </Card>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{oleada.name}</h1>
        <span className="rounded-[var(--edu-radius-sm)] bg-[var(--edu-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--edu-text-secondary)]">
          {oleada.sector}
        </span>
      </div>

      <p className="text-sm text-[var(--edu-text-secondary)]">
        Del {formatDate(`${oleada.startDate}T00:00:00Z`, 'America/Lima')} al{' '}
        {formatDate(`${oleada.endDate}T00:00:00Z`, 'America/Lima')}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric value={`${occupancy.used}/${occupancy.capacity}`} label="Cupos ocupados" />
        <Metric value={`${occupancy.remaining}`} label="Cupos disponibles" />
        <Metric value={`${occupancy.percentage}%`} label="Ocupación" />
      </div>

      <Card
        title="Preparación de la oleada"
        variant={pendingSteps.length > 0 ? 'emphasis' : 'default'}
      >
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex flex-col gap-1 rounded-[var(--edu-radius-sm)] border border-[var(--edu-border)] p-3"
            >
              <span className="text-xs font-semibold text-[var(--edu-text-secondary)]">
                {step.done ? '✓ Listo' : '○ Falta'}
              </span>
              <span className="font-medium">
                {index + 1}. {step.label}
              </span>
              <span className="text-xs text-[var(--edu-text-secondary)]">{step.detail}</span>
            </li>
          ))}
        </ol>

        {readOnly ? null : (
          <p className="text-xs text-[var(--edu-text-secondary)]">
            {pendingSteps.length === 0
              ? 'Los cuatro pasos están completos.'
              : `Completa ${pendingSteps.length} paso(s) antes de abrir la oleada.`}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/admin/enrollments"
          className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
        >
          Ver inscripciones
        </Link>
        <Link
          href="/admin/asignaciones"
          className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
        >
          Ver asignaciones de mentoría
        </Link>
      </div>
    </AppShell>
  );
}
