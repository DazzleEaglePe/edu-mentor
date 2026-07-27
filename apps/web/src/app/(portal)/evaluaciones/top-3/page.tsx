import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  loadAdminEnrollment,
  loadDeliverableDetail,
  loadEvaluatedDeliverable,
  loadMentorAuthMe,
  loadTopCandidates,
} from '@/lib/api/fixtures';
import { rankSlots, resolveCandidates } from '@/lib/domain/evaluation';

/**
 * M16 · Top 3 por consigna.
 *
 * **La regla es provisional.** `TopCandidates.provisionalRule` viene en `true`
 * y CCR-008 sigue esperando a Producto: nadie ha ratificado si el Top 3 es por
 * consigna, por semana o por oleada. La pantalla lo dice en vez de presentar
 * la selección como cerrada — diseñarla como aprobada sería fingir una decisión
 * que no se ha tomado.
 *
 * Los tres puestos se muestran siempre, incluso vacíos: que falte uno es
 * información, y ocultarlo haría parecer que la selección está completa.
 */
export default async function TopTresPage() {
  const [me, top, pendiente, evaluado, enrollment] = await Promise.all([
    loadMentorAuthMe(),
    loadTopCandidates(),
    loadDeliverableDetail(),
    loadEvaluatedDeliverable(),
    loadAdminEnrollment(),
  ]);

  const namesByEnrollmentId = new Map([[enrollment.id, enrollment.user.fullName]]);
  const resolved = resolveCandidates(top.candidates, [pendiente, evaluado], namesByEnrollmentId);
  const slots = rankSlots(resolved);
  const chosen = resolved.length;

  return (
    <AppShell
      me={me}
      currentPath="/evaluaciones"
      aside={
        <Card variant="quiet" title="Regla provisional">
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Todavía no está decidido si el Top 3 se elige por consigna, por semana o por toda la
            oleada. Lo que ves aquí sigue el baseline técnico —por consigna, con puestos 1 a 3— y
            cambiará si Proyectos decide otra cosa.
          </p>
          <p className="text-sm text-[var(--edu-text-secondary)]">
            Mientras tanto, marcar a alguien no publica nada fuera de esta pantalla.
          </p>
        </Card>
      }
    >
      <Link
        href="/evaluaciones"
        className="text-sm text-[var(--edu-text-link)] underline underline-offset-2"
      >
        ← Volver a la cola
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Top 3 de la consigna</h1>
        {top.provisionalRule ? (
          <span className="rounded-[var(--edu-radius-sm)] border border-[var(--edu-coral-200)] bg-[var(--edu-coral-100)] px-2.5 py-1 text-xs font-semibold text-[var(--edu-coral-800)]">
            Regla provisional
          </span>
        ) : null}
      </div>

      <p className="text-sm text-[var(--edu-text-secondary)]">
        {chosen === 0 ? 'Todavía no has marcado a nadie.' : `${chosen} de 3 puestos asignados.`}
      </p>

      <ol className="flex flex-col gap-3">
        {slots.map((slot, index) => {
          const rank = index + 1;

          return (
            <li key={rank}>
              <Card variant={slot === null ? 'quiet' : 'default'}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="tabular font-mono text-lg font-bold text-[var(--edu-text-secondary)]">
                      {rank}.º
                    </span>
                    <div className="min-w-0">
                      {slot === null ? (
                        <p className="text-sm text-[var(--edu-text-secondary)]">Sin asignar</p>
                      ) : (
                        <>
                          <p className="font-semibold">
                            {slot.participantName ?? 'Participante no identificado'}
                          </p>
                          <p className="text-xs text-[var(--edu-text-secondary)]">
                            {slot.score === null ? 'Sin evaluar todavía' : `Puntaje ${slot.score}`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    id={`top-slot-${rank}`}
                    variant="ghost"
                    disabled
                    disabledReason="Disponible cuando activemos el portal."
                  >
                    {slot === null ? 'Asignar puesto' : 'Quitar'}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-[var(--edu-text-secondary)]">
        Los tres puestos se muestran aunque estén vacíos: que falte uno es información, y ocultarlo
        haría parecer que la selección ya está completa.
      </p>
    </AppShell>
  );
}
