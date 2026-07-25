import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/ui/states';
import { loadAuthMe, loadDeliverableDetail } from '@/lib/api/fixtures';
import {
  currentSubmission,
  sortByRequiredAction,
  summarizeSubmission,
} from '@/lib/domain/deliverables';
import { formatDate } from '@/lib/format';

/**
 * P6 · Mis entregables.
 *
 * Ordenados **por acción requerida, no cronológicamente**: lo devuelto sube al
 * tope porque es lo único que bloquea al participante. El orden y el texto
 * salen de `lib/domain/deliverables`, el mismo módulo que usa P1, para que las
 * dos pantallas no puedan contradecirse.
 */
export default async function EntregablesPage() {
  const [me, deliverable] = await Promise.all([loadAuthMe(), loadDeliverableDetail()]);
  const deliverables = sortByRequiredAction([deliverable]);

  return (
    <AppShell me={me} currentPath="/entregables">
      <h1 className="text-2xl font-bold tracking-tight">Mis entregables</h1>

      {deliverables.length === 0 ? (
        <EmptyState
          title="Aún no hay consignas publicadas para tu semana"
          body="Cuando tu mentor publique la primera, aparecerá acá."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {deliverables.map((item) => {
            const submission = currentSubmission(item);
            if (submission === null) {
              return null;
            }

            const summary = summarizeSubmission(submission.status);
            const fileCount = submission.files.length;
            const detail = summary.needsAction
              ? `Entrega hasta el ${formatDate(item.assignment.dueAt, 'America/Lima')}`
              : `Revisión ${submission.revisionNumber} · ${fileCount} archivo(s)`;

            return (
              <li key={item.id}>
                <Card variant={summary.needsAction ? 'emphasis' : 'default'}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--edu-text-secondary)]">{summary.title}</p>
                      <p className="font-semibold">
                        Semana {item.assignment.weekNumber} · {item.assignment.title}
                      </p>
                      <p className="text-sm text-[var(--edu-text-secondary)]">{detail}</p>
                    </div>
                    <StatusChip kind="submissionStatus" value={submission.status} />
                  </div>

                  <Link
                    href={`/entregables/${item.id}`}
                    className="text-sm font-semibold text-[var(--edu-text-link)] underline underline-offset-2"
                  >
                    Ver consigna y mi entrega
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
