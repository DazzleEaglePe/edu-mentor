import type { ApiComponents } from '@edu-mentor/shared-types';
import { lookupOr } from './lookup';
import type { Deliverable, Submission, SubmissionStatus } from './deliverables';

type Schemas = ApiComponents['schemas'];

export type Assignment = Schemas['Assignment'];
export type RubricCriterion = Schemas['RubricCriterion'];
export type RubricScore = Schemas['RubricScore'];
export type Evaluation = Schemas['Evaluation'];

/* ------------------------------------------------------ cola de evaluación */

/**
 * Orden de la cola: **por antigüedad de envío**, no por semana ni por nombre.
 *
 * En una cola de trabajo lo que importa es cuánto lleva esperando alguien. Un
 * orden alfabético haría que la misma persona quede siempre al final.
 */
export function sortQueue(deliverables: readonly Deliverable[]): readonly Deliverable[] {
  return [...deliverables].sort((left, right) => {
    const leftAt = oldestSubmittedAt(left);
    const rightAt = oldestSubmittedAt(right);

    // Lo que no tiene fecha de envío no compite por prioridad.
    if (leftAt === null) return rightAt === null ? 0 : 1;
    if (rightAt === null) return -1;

    return leftAt.localeCompare(rightAt);
  });
}

function oldestSubmittedAt(deliverable: Deliverable): string | null {
  const pending = deliverable.submissions.filter(
    (submission) => submission.status === 'SUBMITTED' || submission.status === 'UNDER_REVIEW',
  );

  const dates = pending
    .map((submission) => submission.submittedAt)
    .filter((value): value is string => typeof value === 'string');

  return dates.length === 0 ? null : dates.sort()[0] ?? null;
}

/* ------------------------------------------------- acciones sobre revisión */

/**
 * `start-review` es explícito en el contrato: el mentor **toma** la revisión y
 * recién ahí pasa a `UNDER_REVIEW`. Por eso el botón dice "Tomar y evaluar" y
 * no solo "Evaluar": nombra lo que de verdad ocurre.
 */
export interface ReviewActions {
  readonly canStartReview: boolean;
  readonly canEvaluate: boolean;
  readonly canReturn: boolean;
  readonly isClosed: boolean;
}

const actionsByStatus: Record<SubmissionStatus, ReviewActions> = {
  DRAFT: { canStartReview: false, canEvaluate: false, canReturn: false, isClosed: false },
  SUBMITTED: { canStartReview: true, canEvaluate: false, canReturn: false, isClosed: false },
  UNDER_REVIEW: { canStartReview: false, canEvaluate: true, canReturn: true, isClosed: false },
  RETURNED: { canStartReview: false, canEvaluate: false, canReturn: false, isClosed: false },
  EVALUATED: { canStartReview: false, canEvaluate: false, canReturn: false, isClosed: true },
};

const noActions: ReviewActions = {
  canStartReview: false,
  canEvaluate: false,
  canReturn: false,
  isClosed: false,
};

export function reviewActionsFor(submission: Submission): ReviewActions {
  return lookupOr(actionsByStatus, submission.status, noActions);
}

/* --------------------------------------------------------------- rúbrica */

export interface RubricProblem {
  readonly criterionId: string;
  readonly message: string;
}

/**
 * Valida los puntajes contra la rúbrica **de esa consigna**.
 *
 * Cada criterio trae su propio `maxScore`, así que un 90 puede ser válido en un
 * criterio de 100 e inválido en uno de 40. Validar solo contra el rango global
 * 0–100 dejaría pasar puntajes imposibles.
 *
 * Devuelve la lista de problemas, no un booleano: el formulario marca cada
 * criterio, no un error genérico al final.
 */
export function validateRubricScores(
  rubric: readonly RubricCriterion[],
  scores: readonly RubricScore[],
): readonly RubricProblem[] {
  const problems: RubricProblem[] = [];
  const byId = new Map(rubric.map((criterion) => [criterion.id, criterion]));

  for (const criterion of rubric) {
    const given = scores.find((score) => score.criterionId === criterion.id);

    if (given === undefined) {
      problems.push({ criterionId: criterion.id, message: `Falta puntuar ${criterion.label}.` });
      continue;
    }

    if (given.score < 0) {
      problems.push({ criterionId: criterion.id, message: 'El puntaje no puede ser negativo.' });
      continue;
    }

    if (given.score > criterion.maxScore) {
      problems.push({
        criterionId: criterion.id,
        message: `${criterion.label} llega hasta ${criterion.maxScore}.`,
      });
    }
  }

  for (const score of scores) {
    if (!byId.has(score.criterionId)) {
      problems.push({
        criterionId: score.criterionId,
        message: 'Ese criterio no pertenece a esta consigna.',
      });
    }
  }

  return problems;
}

/** Suma de los criterios. Es información, no el `score` final. */
export function sumRubric(scores: readonly RubricScore[]): number {
  return scores.reduce((total, score) => total + score.score, 0);
}

/** Máximo alcanzable según la rúbrica de la consigna. */
export function rubricMaximum(rubric: readonly RubricCriterion[]): number {
  return rubric.reduce((total, criterion) => total + criterion.maxScore, 0);
}

/**
 * El contrato tiene `score` y `rubricScores` como campos independientes y no
 * dice que uno derive del otro, así que **la UI no autocompleta el puntaje**:
 * muestra la suma como referencia y deja la decisión en el mentor.
 *
 * Si Producto decide que el total es la suma, esto se convierte en un cálculo
 * y el campo pasa a solo lectura. Mientras tanto, inventar la regla sería
 * decidir por ellos.
 */
export function rubricMatchesScore(
  scores: readonly RubricScore[],
  score: number,
): boolean {
  return sumRubric(scores) === score;
}

/**
 * Une los puntajes con los criterios de la consigna, para poder mostrar
 * "Claridad · 36 / 40" en vez de un id suelto.
 *
 * El orden lo manda la **rúbrica**, no el arreglo de puntajes: así el
 * participante ve siempre los criterios en el mismo orden en que se los
 * anunciaron al entregar.
 *
 * Un criterio sin puntaje aparece con `score: null` en vez de omitirse: que
 * falte una nota es información, y esconderla haría parecer que la rúbrica
 * tenía menos criterios de los que tenía.
 */
export interface ScoredCriterion {
  readonly id: string;
  readonly label: string;
  readonly maxScore: number;
  readonly score: number | null;
  readonly comment: string | null;
}

export function mergeRubric(
  rubric: readonly RubricCriterion[],
  scores: readonly RubricScore[],
): readonly ScoredCriterion[] {
  return rubric.map((criterion) => {
    const given = scores.find((score) => score.criterionId === criterion.id);

    return {
      id: criterion.id,
      label: criterion.label,
      maxScore: criterion.maxScore,
      score: given?.score ?? null,
      comment: given?.comment ?? null,
    };
  });
}

/* ------------------------------------------------------------- top 3 */

export type TopCandidates = Schemas['TopCandidates'];
export type TopCandidate = Schemas['TopCandidate'];

export interface ResolvedCandidate {
  readonly rank: number;
  readonly submissionId: string;
  /** `null` cuando la entrega no está entre los datos cargados. */
  readonly participantName: string | null;
  readonly score: number | null;
}

/**
 * Resuelve un candidato del Top 3 hasta la persona.
 *
 * `TopCandidate` solo trae `submissionId` y `rank`, así que hay que atravesar
 * dos saltos: revisión → entregable → enrollment → usuario. Si alguno falta,
 * el candidato se muestra **igual** con el nombre en `null`: ocultar un puesto
 * porque no se pudo resolver el nombre haría parecer que el Top 3 tiene menos
 * seleccionados de los que tiene.
 *
 * El orden lo manda el `rank`, no el arreglo recibido.
 */
export function resolveCandidates(
  candidates: readonly TopCandidate[],
  deliverables: readonly Deliverable[],
  namesByEnrollmentId: ReadonlyMap<string, string>,
): readonly ResolvedCandidate[] {
  return [...candidates]
    .sort((left, right) => left.rank - right.rank)
    .map((candidate) => {
      const owner = deliverables.find((deliverable) =>
        deliverable.submissions.some((submission) => submission.id === candidate.submissionId),
      );

      const submission = owner?.submissions.find((item) => item.id === candidate.submissionId);

      return {
        rank: candidate.rank,
        submissionId: candidate.submissionId,
        participantName:
          owner === undefined ? null : (namesByEnrollmentId.get(owner.enrollmentId) ?? null),
        score: submission?.evaluation?.score ?? null,
      };
    });
}

/** Los tres puestos, con los vacíos visibles: falta uno es información. */
export function rankSlots(
  resolved: readonly ResolvedCandidate[],
): readonly (ResolvedCandidate | null)[] {
  return [1, 2, 3].map((rank) => resolved.find((item) => item.rank === rank) ?? null);
}

/* ------------------------------------------------------------- feedback */

/** El contrato exige entre 10 y 4000 caracteres. */
export const feedbackMinLength = 10;
export const feedbackMaxLength = 4000;

export function validateFeedback(feedback: string): string | null {
  const trimmed = feedback.trim();

  if (trimmed.length === 0) {
    return 'Escribe la retroalimentación antes de guardar.';
  }

  if (trimmed.length < feedbackMinLength) {
    return `La retroalimentación necesita al menos ${feedbackMinLength} caracteres.`;
  }

  if (trimmed.length > feedbackMaxLength) {
    return `La retroalimentación no puede pasar de ${feedbackMaxLength} caracteres.`;
  }

  return null;
}

/**
 * Devolver también exige un motivo: sin él, el participante recibe un "corrige"
 * sin saber qué. El contrato lo permite vacío; el diseño no.
 */
export function validateReturnReason(reason: string): string | null {
  return reason.trim().length === 0 ? 'Explica qué debe corregir antes de devolver.' : null;
}
