import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  primaryRole,
  translateProgramPhase,
  translateRole,
  translateSessionType,
  translateStatus,
  type StatusKind,
} from './labels';

/**
 * La exhaustividad de los diccionarios ya la garantiza `Record<Enum, …>` en
 * tiempo de compilación: si el contrato agrega un estado, el typecheck falla.
 *
 * Estas pruebas cubren lo que el tipo no puede: el comportamiento en runtime
 * frente a datos reales y frente a un contrato desincronizado.
 */

describe('translateStatus', () => {
  it('traduce cada estado de sesión sin inventar "Confirmada"', () => {
    assert.equal(translateStatus('sessionStatus', 'SCHEDULED')?.label, 'Programada');
    assert.equal(translateStatus('sessionStatus', 'COMPLETED')?.label, 'Realizada');
    assert.equal(translateStatus('sessionStatus', 'CANCELLED')?.label, 'Cancelada');
    assert.equal(translateStatus('sessionStatus', 'RESCHEDULED')?.label, 'Reprogramada');
  });

  it('mantiene confirmación y asistencia como ejes separados (DEC-007)', () => {
    // El mismo valor crudo significa cosas distintas según el eje.
    assert.equal(translateStatus('confirmationStatus', 'PENDING')?.label, 'Por confirmar');
    assert.equal(translateStatus('attendanceStatus', 'PENDING')?.label, 'Sin registrar');

    // `CONFIRMED` no existe como asistencia: confirmar no es asistir.
    assert.equal(translateStatus('attendanceStatus', 'CONFIRMED'), null);

    // `DECLINED` no existe como asistencia: declinar no es faltar.
    assert.equal(translateStatus('attendanceStatus', 'DECLINED'), null);
  });

  it('no acepta "Pendiente" como estado de entregable', () => {
    assert.equal(translateStatus('submissionStatus', 'PENDING'), null);
    assert.equal(translateStatus('submissionStatus', 'SUBMITTED')?.label, 'Enviado');
    assert.equal(translateStatus('submissionStatus', 'RETURNED')?.label, 'Devuelto');
  });

  it('devuelve null ante un enum que la UI no conoce', () => {
    // Un contrato desincronizado tiene que notarse, no pintar un chip vacío.
    assert.equal(translateStatus('sessionStatus', 'CONFIRMED'), null);
    assert.equal(translateStatus('sessionStatus', 'ARCHIVED'), null);
    assert.equal(translateStatus('scanStatus', ''), null);
  });

  it('no confunde el diccionario con propiedades heredadas de Object', () => {
    const kinds: readonly StatusKind[] = ['sessionStatus', 'submissionStatus', 'scanStatus'];
    for (const kind of kinds) {
      assert.equal(translateStatus(kind, 'toString'), null);
      assert.equal(translateStatus(kind, 'constructor'), null);
      assert.equal(translateStatus(kind, '__proto__'), null);
    }
  });

  it('asigna un tono a cada estado, sin depender del color para el significado', () => {
    const declined = translateStatus('confirmationStatus', 'DECLINED');
    const returned = translateStatus('submissionStatus', 'RETURNED');

    // Comparten tono visual pero nunca etiqueta: el texto es el portador real.
    assert.equal(declined?.tone, 'declined');
    assert.equal(returned?.tone, 'returned');
    assert.notEqual(declined?.label, returned?.label);
  });
});

describe('translateSessionType', () => {
  it('usa los tres tipos del enum, sin "Taller"', () => {
    assert.equal(translateSessionType('ONE_ON_ONE'), '1:1');
    assert.equal(translateSessionType('GROUP'), 'Grupal');
    assert.equal(translateSessionType('CHECKPOINT'), 'Checkpoint');
  });
});

describe('translateProgramPhase', () => {
  it('nombra las fases como las conoce el participante', () => {
    assert.equal(translateProgramPhase('FASE_1'), 'Fase 1 · Hub de Empleabilidad');
    assert.equal(translateProgramPhase('FINISHED'), 'Programa finalizado');
  });
});

describe('primaryRole', () => {
  it('prioriza el rol de mayor alcance operativo', () => {
    assert.equal(primaryRole(['PARTICIPANT']), 'PARTICIPANT');
    assert.equal(primaryRole(['MENTOR']), 'MENTOR');
    assert.equal(primaryRole(['MENTOR', 'ADMIN']), 'ADMIN');
    assert.equal(primaryRole(['ADMIN', 'MENTOR']), 'ADMIN');
  });

  it('no asume un solo rol por persona (DEC-002)', () => {
    assert.equal(primaryRole(['PARTICIPANT', 'MENTOR']), 'MENTOR');
    assert.equal(translateRole(primaryRole(['MENTOR', 'ADMIN'])), 'Admin');
  });

  it('degrada a participante cuando la lista llega vacía', () => {
    assert.equal(primaryRole([]), 'PARTICIPANT');
  });
});
