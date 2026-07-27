import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluationProgress,
  risks,
  unaccountedSubmissions,
  type AdminDashboard,
} from './dashboard';

const dashboard = (overrides: Partial<AdminDashboard> = {}): AdminDashboard => ({
  activeUsers: 45,
  upcomingSessions: 14,
  pendingDeliverables: 5,
  failedJobs: 0,
  totalOleadas: 3,
  activeOleadas: 2,
  totalParticipants: 45,
  activeMentors: 12,
  pendingReviews: 5,
  completedSessions: 28,
  submissionsSummary: { total: 32, evaluated: 22, pending: 5, returned: 5 },
  ...overrides,
});

describe('risks', () => {
  it('omite lo que está en cero', () => {
    // Un panel que anuncia "0 fallidos" entrena a la gente a ignorarlo.
    const items = risks(
      dashboard({
        failedJobs: 0,
        pendingReviews: 0,
        pendingDeliverables: 0,
        submissionsSummary: { total: 10, evaluated: 10, pending: 0, returned: 0 },
      }),
    );

    assert.deepEqual(items, []);
  });

  it('pone los envíos fallidos primero', () => {
    // Es lo único que nadie recibió: el resto solo espera a una persona.
    const items = risks(dashboard({ failedJobs: 2 }));
    assert.equal(items[0]?.label, 'Envíos fallidos');
  });

  it('distingue quién debe actuar en cada riesgo', () => {
    const items = risks(dashboard({ failedJobs: 1 }));
    const byLabel = new Map(items.map((item) => [item.label, item.hint]));

    assert.ok(byLabel.get('Entregas sin evaluar')?.includes('mentor'));
    assert.ok(byLabel.get('Entregas devueltas')?.includes('participante'));
  });

  it('cada riesgo trae qué hacer, no solo un número', () => {
    for (const item of risks(dashboard({ failedJobs: 3 }))) {
      assert.ok(item.hint.length > 0, `${item.label} debería decir qué hacer`);
      assert.ok(item.value > 0);
    }
  });
});

describe('evaluationProgress', () => {
  it('calcula sobre el total de entregas', () => {
    assert.equal(evaluationProgress(dashboard()), 69);
  });

  it('no divide entre cero', () => {
    const empty = dashboard({
      submissionsSummary: { total: 0, evaluated: 0, pending: 0, returned: 0 },
    });

    assert.equal(evaluationProgress(empty), 0);
    assert.ok(Number.isFinite(evaluationProgress(empty)));
  });

  it('llega a 100 cuando todo está evaluado', () => {
    const done = dashboard({
      submissionsSummary: { total: 8, evaluated: 8, pending: 0, returned: 0 },
    });

    assert.equal(evaluationProgress(done), 100);
  });
});

describe('unaccountedSubmissions', () => {
  it('revela las entregas que el desglose no cubre', () => {
    // 32 - 22 - 5 - 5 = 0 en el fixture; con borradores, el resto aparece.
    assert.equal(unaccountedSubmissions(dashboard()), 0);

    const conBorradores = dashboard({
      submissionsSummary: { total: 40, evaluated: 22, pending: 5, returned: 5 },
    });

    assert.equal(unaccountedSubmissions(conBorradores), 8);
  });

  it('nunca reporta un negativo', () => {
    // Si el desglose superara el total, un número negativo sería peor que cero.
    const inconsistente = dashboard({
      submissionsSummary: { total: 5, evaluated: 10, pending: 0, returned: 0 },
    });

    assert.equal(unaccountedSubmissions(inconsistente), 0);
  });
});
