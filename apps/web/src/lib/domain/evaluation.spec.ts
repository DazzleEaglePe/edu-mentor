import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  feedbackMinLength,
  mergeRubric,
  reviewActionsFor,
  rubricMatchesScore,
  rubricMaximum,
  sortQueue,
  sumRubric,
  validateFeedback,
  validateReturnReason,
  validateRubricScores,
  type RubricCriterion,
} from './evaluation';
import type { Deliverable, Submission, SubmissionStatus } from './deliverables';

const rubric: readonly RubricCriterion[] = [
  { id: 'claridad', label: 'Claridad', maxScore: 40 },
  { id: 'evidencia', label: 'Uso de evidencia', maxScore: 60 },
];

const submission = (status: SubmissionStatus, submittedAt: string | null = null): Submission => ({
  id: `s-${status}`,
  revisionNumber: 1,
  status,
  notes: '',
  files: [],
  version: 1,
  ...(submittedAt === null ? {} : { submittedAt }),
});

const deliverable = (id: string, submissions: readonly Submission[]): Deliverable => ({
  id,
  enrollmentId: 'e1',
  currentSubmissionId: submissions[0]?.id ?? null,
  submissions: [...submissions],
  assignment: {
    id: 'a1',
    oleada: { id: 'o1', name: 'Oleada demo' },
    title: 'Consigna',
    instructions: '',
    weekNumber: 1,
    dueAt: '2026-08-15T04:59:59Z',
    maxScore: 100,
    rubric: [...rubric],
    isActive: true,
    version: 1,
  },
});

describe('sortQueue', () => {
  it('ordena por antigüedad de envío, no alfabéticamente', () => {
    // En una cola importa cuánto lleva esperando alguien.
    const sorted = sortQueue([
      deliverable('b', [submission('SUBMITTED', '2026-08-14T10:00:00Z')]),
      deliverable('a', [submission('SUBMITTED', '2026-08-12T10:00:00Z')]),
    ]);

    assert.deepEqual(
      sorted.map((item) => item.id),
      ['a', 'b'],
    );
  });

  it('considera también las revisiones ya tomadas', () => {
    // Una revisión en curso sigue esperando: no puede caer al final.
    const sorted = sortQueue([
      deliverable('nueva', [submission('SUBMITTED', '2026-08-14T10:00:00Z')]),
      deliverable('en-curso', [submission('UNDER_REVIEW', '2026-08-10T10:00:00Z')]),
    ]);

    assert.equal(sorted[0]?.id, 'en-curso');
  });

  it('manda al final lo que no tiene envío pendiente', () => {
    const sorted = sortQueue([
      deliverable('borrador', [submission('DRAFT')]),
      deliverable('enviado', [submission('SUBMITTED', '2026-08-14T10:00:00Z')]),
    ]);

    assert.equal(sorted[0]?.id, 'enviado');
  });

  it('no muta el arreglo recibido', () => {
    const input = [
      deliverable('b', [submission('SUBMITTED', '2026-08-14T10:00:00Z')]),
      deliverable('a', [submission('SUBMITTED', '2026-08-12T10:00:00Z')]),
    ];
    const before = input.map((item) => item.id);

    sortQueue(input);

    assert.deepEqual(
      input.map((item) => item.id),
      before,
    );
  });
});

describe('reviewActionsFor', () => {
  it('una revisión enviada se toma antes de evaluar', () => {
    const actions = reviewActionsFor(submission('SUBMITTED'));
    assert.equal(actions.canStartReview, true);
    assert.equal(actions.canEvaluate, false);
  });

  it('una revisión tomada se evalúa o se devuelve', () => {
    const actions = reviewActionsFor(submission('UNDER_REVIEW'));
    assert.equal(actions.canStartReview, false);
    assert.equal(actions.canEvaluate, true);
    assert.equal(actions.canReturn, true);
  });

  it('un borrador no es asunto del mentor todavía', () => {
    const actions = reviewActionsFor(submission('DRAFT'));
    assert.equal(actions.canStartReview, false);
    assert.equal(actions.canEvaluate, false);
  });

  it('una revisión devuelta espera al participante, no al mentor', () => {
    const actions = reviewActionsFor(submission('RETURNED'));
    assert.equal(actions.canEvaluate, false);
    assert.equal(actions.isClosed, false);
  });

  it('una revisión evaluada está cerrada', () => {
    assert.equal(reviewActionsFor(submission('EVALUATED')).isClosed, true);
  });

  it('un estado desconocido no habilita ninguna acción', () => {
    assert.deepEqual(reviewActionsFor(submission('ARCHIVED' as SubmissionStatus)), {
      canStartReview: false,
      canEvaluate: false,
      canReturn: false,
      isClosed: false,
    });
  });
});

describe('validateRubricScores', () => {
  it('acepta puntajes dentro del máximo de cada criterio', () => {
    const problems = validateRubricScores(rubric, [
      { criterionId: 'claridad', score: 35 },
      { criterionId: 'evidencia', score: 50 },
    ]);

    assert.deepEqual(problems, []);
  });

  it('valida contra el máximo del criterio, no contra 0-100', () => {
    // 50 es válido globalmente pero imposible en un criterio de 40.
    const problems = validateRubricScores(rubric, [
      { criterionId: 'claridad', score: 50 },
      { criterionId: 'evidencia', score: 50 },
    ]);

    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.criterionId, 'claridad');
    assert.ok(problems[0]?.message.includes('40'));
  });

  it('señala cada criterio sin puntuar', () => {
    const problems = validateRubricScores(rubric, [{ criterionId: 'claridad', score: 10 }]);
    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.criterionId, 'evidencia');
  });

  it('rechaza un criterio que no pertenece a la consigna', () => {
    const problems = validateRubricScores(rubric, [
      { criterionId: 'claridad', score: 10 },
      { criterionId: 'evidencia', score: 10 },
      { criterionId: 'inventado', score: 10 },
    ]);

    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.criterionId, 'inventado');
  });

  it('rechaza puntajes negativos', () => {
    const problems = validateRubricScores(rubric, [
      { criterionId: 'claridad', score: -1 },
      { criterionId: 'evidencia', score: 10 },
    ]);

    assert.equal(problems[0]?.criterionId, 'claridad');
  });

  it('devuelve un problema por criterio, no un error genérico', () => {
    const problems = validateRubricScores(rubric, []);
    assert.equal(problems.length, 2);
  });
});

describe('sumRubric y rubricMaximum', () => {
  it('suma los criterios sin decidir el puntaje final', () => {
    assert.equal(
      sumRubric([
        { criterionId: 'claridad', score: 35 },
        { criterionId: 'evidencia', score: 50 },
      ]),
      85,
    );
  });

  it('calcula el máximo alcanzable de la rúbrica', () => {
    assert.equal(rubricMaximum(rubric), 100);
  });

  it('detecta si el puntaje coincide con la suma, sin imponerlo', () => {
    const scores = [
      { criterionId: 'claridad', score: 35 },
      { criterionId: 'evidencia', score: 50 },
    ];

    assert.equal(rubricMatchesScore(scores, 85), true);
    assert.equal(rubricMatchesScore(scores, 90), false);
  });
});

describe('mergeRubric', () => {
  const scores = [
    { criterionId: 'evidencia', score: 54, comment: 'Datos verificables.' },
    { criterionId: 'claridad', score: 36 },
  ];

  it('ordena por la rúbrica, no por los puntajes recibidos', () => {
    // El participante ve los criterios en el orden en que se los anunciaron.
    const merged = mergeRubric(rubric, scores);
    assert.deepEqual(
      merged.map((item) => item.id),
      ['claridad', 'evidencia'],
    );
  });

  it('lleva la etiqueta y el máximo de cada criterio', () => {
    const merged = mergeRubric(rubric, scores);
    assert.equal(merged[0]?.label, 'Claridad');
    assert.equal(merged[0]?.maxScore, 40);
    assert.equal(merged[0]?.score, 36);
  });

  it('conserva el comentario cuando existe y null cuando no', () => {
    const merged = mergeRubric(rubric, scores);
    assert.equal(merged[0]?.comment, null);
    assert.equal(merged[1]?.comment, 'Datos verificables.');
  });

  it('muestra un criterio sin puntuar en vez de omitirlo', () => {
    // Que falte una nota es información; esconderla haría parecer que la
    // rúbrica tenía menos criterios de los que tenía.
    const merged = mergeRubric(rubric, [{ criterionId: 'claridad', score: 36 }]);
    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.score, null);
  });

  it('ignora puntajes de criterios que no están en la rúbrica', () => {
    const merged = mergeRubric(rubric, [
      ...scores,
      { criterionId: 'inventado', score: 10 },
    ]);

    assert.equal(merged.length, 2);
  });
});

describe('validateFeedback', () => {
  it('exige el mínimo del contrato', () => {
    assert.ok(validateFeedback('corto')?.includes(`${feedbackMinLength}`));
    assert.equal(validateFeedback('Buen trabajo, sigue así.'), null);
  });

  it('no acepta solo espacios', () => {
    assert.ok(validateFeedback('             ') !== null);
  });

  it('rechaza pasarse del máximo', () => {
    assert.ok(validateFeedback('a'.repeat(4001)) !== null);
  });
});

describe('validateReturnReason', () => {
  it('exige un motivo al devolver', () => {
    // Sin motivo, el participante recibe un "corrige" sin saber qué.
    assert.ok(validateReturnReason('   ') !== null);
    assert.equal(validateReturnReason('Falta la fuente del dato.'), null);
  });
});
