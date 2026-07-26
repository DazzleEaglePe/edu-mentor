import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actionsFor,
  awaitingResponse,
  checkpointMonthOptions,
  dayKey,
  describeConfirmations,
  describePeriod,
  groupByDay,
  periodFieldFor,
  periodOptionsFor,
  sortForAgenda,
  validatePeriod,
  type Session,
  type SessionParticipant,
} from './agenda';

const participant = (
  id: string,
  confirmationStatus: SessionParticipant['confirmationStatus'],
): SessionParticipant => ({
  enrollmentId: id,
  participant: { id: `u-${id}`, fullName: `Persona ${id}` },
  confirmationStatus,
  attendanceStatus: 'PENDING',
  confirmedAt: null,
  version: 1,
});

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  title: 'Taller grupal',
  type: 'GROUP',
  phase: 'FASE_1',
  startsAt: '2026-08-26T20:00:00.000Z',
  endsAt: '2026-08-26T21:00:00.000Z',
  timezone: 'America/Lima',
  status: 'SCHEDULED',
  confirmationClosesAt: '2026-08-26T20:00:00.000Z',
  canConfirm: false,
  confirmationSummary: { total: 8, pending: 2, confirmed: 5, declined: 1 },
  oleada: { id: 'o1', name: 'Oleada Tecnología Demo 2026' },
  mentor: { id: 'm1', fullName: 'Mentora Demo' },
  weekNumber: 4,
  checkpointMonth: null,
  participants: [],
  rescheduledFromId: null,
  version: 1,
  ...overrides,
});

describe('describeConfirmations', () => {
  it('distingue quien declinó de quien no respondió', () => {
    // Fundirlos en "5 de 8" borra la diferencia que decide a quién escribir.
    const text = describeConfirmations({ total: 8, confirmed: 5, declined: 1, pending: 2 });
    assert.equal(text, '5 confirmaron · 1 no asistirá · 2 sin responder');
  });

  it('concuerda el plural de quienes no asistirán', () => {
    const text = describeConfirmations({ total: 8, confirmed: 4, declined: 2, pending: 2 });
    assert.ok(text.includes('2 no asistirán'));
  });

  it('omite los tramos en cero', () => {
    const text = describeConfirmations({ total: 5, confirmed: 5, declined: 0, pending: 0 });
    assert.equal(text, '5 confirmaron');
    assert.ok(!text.includes('0'));
  });

  it('dice algo útil cuando no hay participantes', () => {
    const text = describeConfirmations({ total: 0, confirmed: 0, declined: 0, pending: 0 });
    assert.equal(text, 'Sin participantes');
  });
});

describe('awaitingResponse', () => {
  it('devuelve solo a quien no ha respondido', () => {
    const item = session({
      participants: [
        participant('a', 'CONFIRMED'),
        participant('b', 'PENDING'),
        participant('c', 'DECLINED'),
        participant('d', 'PENDING'),
      ],
    });

    // Quien declinó ya respondió: recordarle sería molestar.
    assert.deepEqual(
      awaitingResponse(item).map((row) => row.enrollmentId),
      ['b', 'd'],
    );
  });
});

describe('periodFieldFor', () => {
  it('empareja fase con su campo de periodo', () => {
    assert.equal(periodFieldFor('FASE_1'), 'weekNumber');
    assert.equal(periodFieldFor('FASE_2'), 'checkpointMonth');
  });

  it('los checkpoints de Fase 2 son 1, 2, 3 y 6, no meses seguidos', () => {
    assert.deepEqual(checkpointMonthOptions, [1, 2, 3, 6]);
    assert.deepEqual(periodOptionsFor('FASE_2'), [1, 2, 3, 6]);
    assert.equal(periodOptionsFor('FASE_1').length, 6);
  });
});

describe('validatePeriod', () => {
  it('acepta Fase 1 con semana', () => {
    const problem = validatePeriod({ phase: 'FASE_1', weekNumber: 4, checkpointMonth: null });
    assert.equal(problem, null);
  });

  it('acepta Fase 2 con mes de checkpoint', () => {
    const problem = validatePeriod({ phase: 'FASE_2', weekNumber: null, checkpointMonth: 3 });
    assert.equal(problem, null);
  });

  it('exige el periodo de la fase y dice cuál', () => {
    const problem = validatePeriod({ phase: 'FASE_1', weekNumber: null, checkpointMonth: null });
    assert.equal(problem?.field, 'weekNumber');
    assert.ok(problem?.message.includes('1 a 6'));
  });

  it('rechaza un mes de checkpoint que no existe', () => {
    // El mes 4 no es checkpoint del programa aunque sea un número plausible.
    const problem = validatePeriod({ phase: 'FASE_2', weekNumber: null, checkpointMonth: 4 });
    assert.equal(problem?.field, 'checkpointMonth');
  });

  it('rechaza una semana fuera de rango', () => {
    const problem = validatePeriod({ phase: 'FASE_1', weekNumber: 7, checkpointMonth: null });
    assert.equal(problem?.field, 'weekNumber');
  });

  it('impide poblar ambos periodos a la vez', () => {
    const problem = validatePeriod({ phase: 'FASE_1', weekNumber: 4, checkpointMonth: 3 });
    assert.equal(problem?.field, 'checkpointMonth');
    assert.ok(problem?.message.includes('una sola fase'));
  });

  it('señala el campo sobrante también en Fase 2', () => {
    const problem = validatePeriod({ phase: 'FASE_2', weekNumber: 4, checkpointMonth: 3 });
    assert.equal(problem?.field, 'weekNumber');
  });
});

describe('describePeriod', () => {
  it('usa el periodo que la sesión traiga poblado', () => {
    assert.equal(describePeriod(session({ weekNumber: 4 })), 'Semana 4');
    assert.equal(
      describePeriod(session({ weekNumber: null, checkpointMonth: 3, phase: 'FASE_2' })),
      'Checkpoint mes 3',
    );
  });

  it('devuelve null si ninguno viene, en vez de inventar uno', () => {
    assert.equal(describePeriod(session({ weekNumber: null, checkpointMonth: null })), null);
  });
});

describe('actionsFor', () => {
  const starts = new Date('2026-08-26T20:00:00.000Z');
  const before = new Date('2026-08-26T19:00:00.000Z');
  const after = new Date('2026-08-26T20:30:00.000Z');

  it('no ofrece completar una sesión que aún no empieza', () => {
    const actions = actionsFor(session(), before);
    assert.equal(actions.canComplete, false);
    assert.equal(actions.canRegisterAttendance, false);
    assert.equal(actions.canReschedule, true);
  });

  it('ofrece completar y registrar asistencia una vez empezada', () => {
    const actions = actionsFor(session(), after);
    assert.equal(actions.canComplete, true);
    assert.equal(actions.canRegisterAttendance, true);
  });

  it('trata el instante de inicio como ya empezada', () => {
    assert.equal(actionsFor(session(), starts).canComplete, true);
  });

  it('una sesión cancelada no admite ninguna acción', () => {
    const actions = actionsFor(session({ status: 'CANCELLED' }), after);
    assert.equal(actions.canEdit, false);
    assert.equal(actions.canReschedule, false);
    assert.equal(actions.canCancel, false);
    assert.equal(actions.canComplete, false);
    assert.equal(actions.canRegisterAttendance, false);
  });

  it('una sesión realizada ya no se reprograma, pero admite corregir asistencia', () => {
    const actions = actionsFor(session({ status: 'COMPLETED' }), after);
    assert.equal(actions.canReschedule, false);
    assert.equal(actions.canComplete, false);
    assert.equal(actions.canRegisterAttendance, true);
  });
});

describe('groupByDay', () => {
  it('agrupa en la zona de la sesión, no en la del navegador', () => {
    // 2026-08-26T20:00Z es el día 26 en Lima; en Madrid ya sería el 27.
    const item = session({ startsAt: '2026-08-26T20:00:00.000Z', timezone: 'America/Lima' });
    assert.equal(groupByDay([item])[0]?.day, '2026-08-26');
  });

  it('ordena los días y las sesiones dentro de cada uno', () => {
    const groups = groupByDay([
      session({ id: 'b', startsAt: '2026-08-27T15:00:00.000Z' }),
      session({ id: 'c', startsAt: '2026-08-26T22:00:00.000Z' }),
      session({ id: 'a', startsAt: '2026-08-26T14:00:00.000Z' }),
    ]);

    assert.deepEqual(
      groups.map((group) => group.day),
      ['2026-08-26', '2026-08-27'],
    );
    assert.deepEqual(
      groups[0]?.sessions.map((row) => row.id),
      ['a', 'c'],
    );
  });

  it('devuelve vacío sin sesiones', () => {
    assert.deepEqual(groupByDay([]), []);
  });
});

describe('dayKey', () => {
  it('produce YYYY-MM-DD estable para agrupar', () => {
    assert.equal(dayKey('2026-08-26T20:00:00.000Z', 'America/Lima'), '2026-08-26');
    // Mismo instante, otra zona: es el día siguiente.
    assert.equal(dayKey('2026-08-26T20:00:00.000Z', 'Europe/Madrid'), '2026-08-26');
    assert.equal(dayKey('2026-08-26T23:30:00.000Z', 'Europe/Madrid'), '2026-08-27');
  });
});

describe('sortForAgenda', () => {
  it('pone lo vigente antes que lo terminal', () => {
    const sorted = sortForAgenda([
      session({ id: 'cancelada', status: 'CANCELLED', startsAt: '2026-08-20T10:00:00.000Z' }),
      session({ id: 'programada', status: 'SCHEDULED', startsAt: '2026-08-28T10:00:00.000Z' }),
      session({ id: 'realizada', status: 'COMPLETED', startsAt: '2026-08-21T10:00:00.000Z' }),
    ]);

    assert.deepEqual(
      sorted.map((row) => row.id),
      ['programada', 'realizada', 'cancelada'],
    );
  });

  it('a igual estado ordena cronológicamente', () => {
    const sorted = sortForAgenda([
      session({ id: 'tarde', startsAt: '2026-08-28T10:00:00.000Z' }),
      session({ id: 'temprano', startsAt: '2026-08-26T10:00:00.000Z' }),
    ]);

    assert.deepEqual(
      sorted.map((row) => row.id),
      ['temprano', 'tarde'],
    );
  });

  it('no muta el arreglo recibido', () => {
    const input = [session({ id: 'b' }), session({ id: 'a', status: 'CANCELLED' })];
    const before = input.map((row) => row.id);

    sortForAgenda(input);

    assert.deepEqual(
      input.map((row) => row.id),
      before,
    );
  });
});
