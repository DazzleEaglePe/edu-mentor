import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canSubmitRevision,
  currentSubmission,
  formatFileSize,
  sortByRequiredAction,
  summarizeSubmission,
  type Deliverable,
  type DeliverableFile,
  type Submission,
  type SubmissionStatus,
} from './deliverables';

const file = (scanStatus: DeliverableFile['scanStatus'], id = 'f1'): DeliverableFile => ({
  id,
  originalName: 'entrega.pdf',
  detectedMimeType: 'application/pdf',
  sizeBytes: 1024,
  scanStatus,
});

const submission = (
  status: SubmissionStatus,
  files: readonly DeliverableFile[] = [file('CLEAN')],
  id = 's1',
): Submission => ({
  id,
  revisionNumber: 1,
  status,
  notes: '',
  files: [...files],
  version: 1,
});

const deliverable = (
  status: SubmissionStatus,
  dueAt: string,
  weekNumber: number,
  id = `d-${weekNumber}`,
): Deliverable => ({
  id,
  enrollmentId: 'e1',
  currentSubmissionId: `s-${weekNumber}`,
  submissions: [{ ...submission(status), id: `s-${weekNumber}` }],
  assignment: {
    id: `a-${weekNumber}`,
    oleada: { id: 'o1', name: 'Oleada demo' },
    title: `Consigna ${weekNumber}`,
    instructions: '',
    weekNumber,
    dueAt,
    maxScore: 100,
    rubric: [{ id: 'claridad', label: 'Claridad', maxScore: 100 }],
    isActive: true,
    version: 1,
  },
});

describe('summarizeSubmission', () => {
  it('solo marca como acción lo que realmente bloquea a la persona', () => {
    assert.equal(summarizeSubmission('DRAFT').needsAction, true);
    assert.equal(summarizeSubmission('RETURNED').needsAction, true);

    // Ya entregó: la pelota está en la mentora, no en quien mira la pantalla.
    assert.equal(summarizeSubmission('SUBMITTED').needsAction, false);
    assert.equal(summarizeSubmission('UNDER_REVIEW').needsAction, false);
    assert.equal(summarizeSubmission('EVALUATED').needsAction, false);
  });

  it('no llama "pendiente de entregar" a algo ya enviado', () => {
    assert.equal(summarizeSubmission('SUBMITTED').title, 'Enviado, esperando evaluación');
    assert.notEqual(summarizeSubmission('SUBMITTED').title, 'Pendiente de entregar');
  });
});

describe('currentSubmission', () => {
  it('encuentra la revisión vigente por id, no la última del arreglo', () => {
    const item = deliverable('DRAFT', '2026-08-15T04:59:59Z', 4);
    const withExtra: Deliverable = {
      ...item,
      submissions: [...item.submissions, { ...submission('EVALUATED'), id: 'otra' }],
    };

    assert.equal(currentSubmission(withExtra)?.id, 's-4');
  });

  it('devuelve null si el agregado no trae la revisión vigente', () => {
    const item = deliverable('DRAFT', '2026-08-15T04:59:59Z', 4);
    assert.equal(currentSubmission({ ...item, submissions: [] }), null);
  });
});

describe('sortByRequiredAction', () => {
  it('pone lo devuelto primero, aunque venza más tarde', () => {
    const sorted = sortByRequiredAction([
      deliverable('DRAFT', '2026-08-01T00:00:00Z', 1),
      deliverable('EVALUATED', '2026-07-01T00:00:00Z', 2),
      deliverable('RETURNED', '2026-12-01T00:00:00Z', 3),
    ]);

    assert.deepEqual(
      sorted.map((item) => item.assignment.weekNumber),
      [3, 1, 2],
    );
  });

  it('a igual urgencia, primero lo que vence antes', () => {
    const sorted = sortByRequiredAction([
      deliverable('DRAFT', '2026-09-10T00:00:00Z', 5),
      deliverable('DRAFT', '2026-08-20T00:00:00Z', 6),
    ]);

    assert.deepEqual(
      sorted.map((item) => item.assignment.weekNumber),
      [6, 5],
    );
  });

  it('no muta el arreglo recibido', () => {
    const input = [
      deliverable('EVALUATED', '2026-07-01T00:00:00Z', 1),
      deliverable('RETURNED', '2026-12-01T00:00:00Z', 2),
    ];
    const before = input.map((item) => item.id);

    sortByRequiredAction(input);

    assert.deepEqual(
      input.map((item) => item.id),
      before,
    );
  });

  it('manda al final lo que no tiene revisión vigente, sin romperse', () => {
    const broken: Deliverable = {
      ...deliverable('DRAFT', '2026-01-01T00:00:00Z', 1),
      submissions: [],
    };
    const evaluated = deliverable('EVALUATED', '2026-12-01T00:00:00Z', 2);
    const sorted = sortByRequiredAction([broken, evaluated]);

    assert.equal(sorted[0]?.assignment.weekNumber, 2);
  });
});

describe('canSubmitRevision', () => {
  it('permite enviar cuando todo está limpio', () => {
    assert.deepEqual(canSubmitRevision(submission('DRAFT', [file('CLEAN')])), { canSubmit: true });
  });

  it('bloquea mientras el análisis no termina, diciendo cuántos faltan', () => {
    const block = canSubmitRevision(
      submission('DRAFT', [file('CLEAN', 'a'), file('PENDING', 'b'), file('PENDING', 'c')]),
    );

    assert.equal(block.canSubmit, false);
    assert.ok(block.canSubmit === false && block.reason.includes('2 archivos'));
  });

  it('usa singular cuando falta un solo archivo', () => {
    const block = canSubmitRevision(submission('DRAFT', [file('PENDING')]));
    assert.ok(block.canSubmit === false && block.reason.includes('1 archivo.'));
  });

  it('bloquea archivos rechazados o con error de análisis', () => {
    for (const status of ['REJECTED', 'ERROR'] as const) {
      const block = canSubmitRevision(submission('DRAFT', [file(status)]));
      assert.equal(block.canSubmit, false);
    }
  });

  it('exige al menos un archivo', () => {
    const block = canSubmitRevision(submission('DRAFT', []));
    assert.ok(block.canSubmit === false && block.reason.includes('al menos un archivo'));
  });

  it('no deja reenviar una revisión ya enviada', () => {
    for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'EVALUATED', 'RETURNED'] as const) {
      const block = canSubmitRevision(submission(status));
      assert.equal(block.canSubmit, false);
    }
  });

  it('siempre entrega un motivo cuando bloquea', () => {
    const blocks = [
      canSubmitRevision(submission('DRAFT', [])),
      canSubmitRevision(submission('DRAFT', [file('PENDING')])),
      canSubmitRevision(submission('DRAFT', [file('REJECTED')])),
      canSubmitRevision(submission('SUBMITTED')),
    ];

    for (const block of blocks) {
      assert.equal(block.canSubmit, false);
      assert.ok(block.canSubmit === false && block.reason.length > 0);
    }
  });
});

describe('formatFileSize', () => {
  it('traduce bytes a algo que una persona lee', () => {
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(245760), '240 KB');
    assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB');
  });
});
