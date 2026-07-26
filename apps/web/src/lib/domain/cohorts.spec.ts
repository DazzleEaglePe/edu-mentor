import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowedTransitions,
  assignmentPeriod,
  canTransition,
  coveredEnrollmentIds,
  isReadOnly,
  occupancyOf,
  scopeOf,
  setupSteps,
  type Enrollment,
  type MentorAssignment,
  type Oleada,
  type OleadaStatus,
} from './cohorts';

const oleada = (overrides: Partial<Oleada> = {}): Oleada => ({
  id: 'o1',
  name: 'Oleada Tecnología Demo 2026',
  sector: 'Tecnología',
  status: 'OPEN',
  startDate: '2026-08-01',
  endDate: '2027-02-28',
  capacity: 30,
  activeEnrollmentCount: 18,
  version: 1,
  ...overrides,
});

const enrollment = (id: string, status: Enrollment['status'] = 'ACTIVE'): Enrollment => ({
  id,
  user: {
    id: `u-${id}`,
    email: `${id}@example.test`,
    fullName: `Persona ${id}`,
    roles: ['PARTICIPANT'],
    isActive: true,
    mustChangePassword: false,
    version: 1,
  },
  oleada: { id: 'o1', name: 'Oleada Tecnología Demo 2026' },
  status,
  currentPhase: 'FASE_1',
  currentWeek: 4,
  phase1GraduatedAt: null,
  enrolledAt: '2026-08-01T14:00:00Z',
  version: 1,
});

const assignment = (overrides: Partial<MentorAssignment> = {}): MentorAssignment => ({
  id: 'a1',
  mentor: { id: 'm1', fullName: 'Mentora Demo' },
  oleada: { id: 'o1', name: 'Oleada Tecnología Demo 2026' },
  enrollmentId: null,
  capability: 'SPECIALIST',
  status: 'ACTIVE',
  startsAt: '2026-08-01T14:00:00Z',
  endsAt: null,
  version: 1,
  ...overrides,
});

describe('occupancyOf', () => {
  it('calcula la ocupación sin pedir la lista de enrollments', () => {
    const result = occupancyOf(oleada());
    assert.equal(result.used, 18);
    assert.equal(result.remaining, 12);
    assert.equal(result.percentage, 60);
    assert.equal(result.isFull, false);
  });

  it('marca llena una oleada en su capacidad exacta', () => {
    assert.equal(occupancyOf(oleada({ activeEnrollmentCount: 30 })).isFull, true);
  });

  it('nunca reporta cupos negativos', () => {
    // Si el backend reportara más inscritos que cupos, "-2 disponibles"
    // confundiría más que un cero honesto.
    const result = occupancyOf(oleada({ activeEnrollmentCount: 32 }));
    assert.equal(result.remaining, 0);
    assert.equal(result.isFull, true);
  });

  it('no divide entre cero con capacidad cero', () => {
    const result = occupancyOf(oleada({ capacity: 0, activeEnrollmentCount: 0 }));
    assert.equal(result.percentage, 0);
    assert.ok(Number.isFinite(result.percentage));
  });
});

describe('isReadOnly', () => {
  it('solo una oleada cerrada es de solo lectura', () => {
    const abiertas: readonly OleadaStatus[] = ['DRAFT', 'OPEN', 'IN_PROGRESS'];
    for (const status of abiertas) {
      assert.equal(isReadOnly(oleada({ status })), false);
    }

    assert.equal(isReadOnly(oleada({ status: 'CLOSED' })), true);
  });
});

describe('allowedTransitions', () => {
  it('respeta el ciclo DRAFT → OPEN → IN_PROGRESS → CLOSED', () => {
    assert.deepEqual(allowedTransitions('DRAFT'), ['OPEN']);
    assert.deepEqual(allowedTransitions('OPEN'), ['IN_PROGRESS', 'CLOSED']);
    assert.deepEqual(allowedTransitions('IN_PROGRESS'), ['CLOSED']);
  });

  it('no permite reabrir una oleada cerrada', () => {
    assert.deepEqual(allowedTransitions('CLOSED'), []);
    assert.equal(canTransition('CLOSED', 'OPEN'), false);
    assert.equal(canTransition('CLOSED', 'IN_PROGRESS'), false);
  });

  it('no permite saltarse pasos', () => {
    assert.equal(canTransition('DRAFT', 'IN_PROGRESS'), false);
    assert.equal(canTransition('DRAFT', 'CLOSED'), false);
  });

  it('no confunde el mapa con propiedades heredadas de Object', () => {
    assert.deepEqual(allowedTransitions('toString' as OleadaStatus), []);
  });
});

describe('scopeOf', () => {
  it('reconoce la asignación de oleada completa', () => {
    assert.equal(scopeOf(assignment({ enrollmentId: null })), 'OLEADA');
  });

  it('reconoce la asignación a un participante', () => {
    assert.equal(scopeOf(assignment({ enrollmentId: 'e1' })), 'PARTICIPANT');
  });
});

describe('coveredEnrollmentIds', () => {
  const enrollments = [enrollment('e1'), enrollment('e2'), enrollment('e3')];

  it('una asignación de oleada cubre a todos los inscritos', () => {
    const covered = coveredEnrollmentIds([assignment({ enrollmentId: null })], enrollments);
    assert.equal(covered.size, 3);
  });

  it('las asignaciones individuales cubren solo a los suyos', () => {
    const covered = coveredEnrollmentIds(
      [assignment({ id: 'a1', enrollmentId: 'e1' }), assignment({ id: 'a2', enrollmentId: 'e3' })],
      enrollments,
    );

    assert.deepEqual([...covered].sort(), ['e1', 'e3']);
  });

  it('ignora las asignaciones cerradas', () => {
    const covered = coveredEnrollmentIds(
      [assignment({ id: 'a1', enrollmentId: 'e1', status: 'CLOSED' })],
      enrollments,
    );

    assert.equal(covered.size, 0);
  });

  it('una asignación de oleada cerrada no cubre a nadie', () => {
    const covered = coveredEnrollmentIds(
      [assignment({ enrollmentId: null, status: 'CLOSED' })],
      enrollments,
    );

    assert.equal(covered.size, 0);
  });
});

describe('setupSteps', () => {
  const base = {
    oleada: oleada(),
    userCount: 21,
    enrollments: [enrollment('e1'), enrollment('e2')],
  };

  it('deriva los pasos del estado real, no de un checklist manual', () => {
    const steps = setupSteps({ ...base, assignments: [assignment({ enrollmentId: null })] });

    assert.deepEqual(
      steps.map((step) => step.done),
      [true, true, true, true],
    );
  });

  it('marca asignaciones incompleto si falta alguien', () => {
    const steps = setupSteps({
      ...base,
      assignments: [assignment({ enrollmentId: 'e1' })],
    });

    const asignaciones = steps.find((step) => step.id === 'asignaciones');
    assert.equal(asignaciones?.done, false);
    assert.equal(asignaciones?.detail, '1 de 2 con mentor');
  });

  it('no da por hechas las asignaciones cuando no hay nadie inscrito', () => {
    const steps = setupSteps({
      oleada: oleada({ activeEnrollmentCount: 0 }),
      userCount: 21,
      enrollments: [],
      assignments: [],
    });

    // Sin inscritos, "0 de 0 con mentor" sería técnicamente cierto y
    // operativamente falso: la oleada no está lista para abrirse.
    assert.equal(steps.find((step) => step.id === 'asignaciones')?.done, false);
    assert.equal(steps.find((step) => step.id === 'inscripciones')?.done, false);
  });

  it('no cuenta enrollments retirados como pendientes de mentor', () => {
    const steps = setupSteps({
      oleada: oleada(),
      userCount: 21,
      enrollments: [enrollment('e1'), enrollment('e2', 'WITHDRAWN')],
      assignments: [assignment({ enrollmentId: 'e1' })],
    });

    assert.equal(steps.find((step) => step.id === 'asignaciones')?.done, true);
  });
});

describe('assignmentPeriod', () => {
  const day = (iso: string) => iso.slice(0, 10);

  it('una asignación vigente no muestra fecha de cierre', () => {
    assert.equal(assignmentPeriod(assignment({ endsAt: null }), day), 'desde 2026-08-01');
  });

  it('una asignación cerrada muestra su periodo completo', () => {
    const closed = assignment({ status: 'CLOSED', endsAt: '2026-08-12T00:00:00Z' });
    assert.equal(assignmentPeriod(closed, day), '2026-08-01 – 2026-08-12');
  });
});
