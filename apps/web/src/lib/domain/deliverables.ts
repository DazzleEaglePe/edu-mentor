import type { ApiComponents } from '@edu-mentor/shared-types';
import { lookupOr } from './lookup';

type Schemas = ApiComponents['schemas'];

export type SubmissionStatus = Schemas['SubmissionStatus'];
export type Submission = Schemas['Submission'];
export type Deliverable = Schemas['Deliverable'];
export type DeliverableFile = Schemas['DeliverableFile'];

/**
 * Qué significa cada estado de revisión **para quien lo mira**.
 *
 * Vive aquí y no en una pantalla porque P1 y P6 tienen que decir exactamente
 * lo mismo: si el texto se duplica, tarde o temprano divergen y una de las dos
 * miente. `needsAction` decide el orden de la lista y el énfasis visual, no es
 * una preferencia estética.
 */
export interface DeliverableSummary {
  readonly title: string;
  readonly needsAction: boolean;
}

// El tipo `Record<SubmissionStatus, …>` sigue garantizando exhaustividad en
// compilación: si el contrato agrega un estado, este objeto deja de compilar.
// `lookupOr` protege el runtime, donde el valor llega como string cualquiera.
const summaryByStatus: Record<SubmissionStatus, DeliverableSummary> = {
  DRAFT: { title: 'Pendiente de entregar', needsAction: true },
  RETURNED: { title: 'Tu mentora pide ajustes', needsAction: true },
  SUBMITTED: { title: 'Enviado, esperando evaluación', needsAction: false },
  UNDER_REVIEW: { title: 'Tu mentora lo está revisando', needsAction: false },
  EVALUATED: { title: 'Tienes retroalimentación', needsAction: false },
};

/**
 * El respaldo no es cosmético: si el backend agrega un estado que la UI no
 * conoce, la pantalla dice que no puede interpretarlo en vez de afirmar que
 * hay algo pendiente. Nunca inventamos una tarea.
 */
const unknownSummary: DeliverableSummary = {
  title: 'Estado no reconocido',
  needsAction: false,
};

export function summarizeSubmission(status: SubmissionStatus): DeliverableSummary {
  return lookupOr(summaryByStatus, status, unknownSummary);
}

/** La revisión vigente del entregable, o `null` si el agregado llega incompleto. */
export function currentSubmission(deliverable: Deliverable): Submission | null {
  const found = deliverable.submissions.find(
    (submission) => submission.id === deliverable.currentSubmissionId,
  );

  return found ?? null;
}

/**
 * Orden de `Mis entregables`: **por acción requerida, no cronológico**.
 *
 * Lo devuelto sube al tope porque es lo único que bloquea a la persona; los
 * borradores le siguen por vencimiento; lo ya enviado o evaluado va al final.
 * Un orden por fecha de creación enterraría justo lo que hay que atender.
 */
const priorityByStatus: Record<SubmissionStatus, number> = {
  RETURNED: 0,
  DRAFT: 1,
  SUBMITTED: 2,
  UNDER_REVIEW: 3,
  EVALUATED: 4,
};

const lowestPriority = Number.MAX_SAFE_INTEGER;

function priorityOf(deliverable: Deliverable): number {
  const submission = currentSubmission(deliverable);

  // Un agregado sin revisión vigente no puede reclamar prioridad.
  if (submission === null) {
    return lowestPriority;
  }

  return lookupOr(priorityByStatus, submission.status, lowestPriority);
}

export function sortByRequiredAction(deliverables: readonly Deliverable[]): readonly Deliverable[] {
  return [...deliverables].sort((left, right) => {
    const byPriority = priorityOf(left) - priorityOf(right);
    if (byPriority !== 0) {
      return byPriority;
    }

    // A igual urgencia, primero lo que vence antes.
    const byDueDate = left.assignment.dueAt.localeCompare(right.assignment.dueAt);
    if (byDueDate !== 0) {
      return byDueDate;
    }

    return left.assignment.weekNumber - right.assignment.weekNumber;
  });
}

/**
 * Enviar exige que **todos** los archivos estén `CLEAN` (DEC-021).
 *
 * Devuelve el motivo del bloqueo en vez de un booleano: un control
 * deshabilitado sin explicación es el peor patrón de este producto, así que
 * quien llama no puede deshabilitar sin tener a mano qué decir.
 */
export type SubmitBlock =
  { readonly canSubmit: true } | { readonly canSubmit: false; readonly reason: string };

export function canSubmitRevision(submission: Submission): SubmitBlock {
  if (submission.status !== 'DRAFT') {
    return { canSubmit: false, reason: 'Esta revisión ya fue enviada.' };
  }

  if (submission.files.length === 0) {
    return { canSubmit: false, reason: 'Agrega al menos un archivo antes de enviar.' };
  }

  const scanning = submission.files.filter((file) => file.scanStatus === 'PENDING').length;
  if (scanning > 0) {
    const noun = scanning === 1 ? 'archivo' : 'archivos';
    return { canSubmit: false, reason: `Esperando el análisis de ${scanning} ${noun}.` };
  }

  const blocked = submission.files.filter((file) => file.scanStatus !== 'CLEAN').length;
  if (blocked > 0) {
    const noun = blocked === 1 ? 'archivo' : 'archivos';
    return { canSubmit: false, reason: `Quita ${blocked} ${noun} que no se pudo procesar.` };
  }

  return { canSubmit: true };
}

/** Tamaño legible. El contrato entrega bytes; nadie lee bytes. */
export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
