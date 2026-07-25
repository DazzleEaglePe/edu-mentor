import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { errorCopy, isApiError, scheduleConflictCopy } from './errors';

/**
 * El contrato garantiza `{ error: { code, message, traceId, details? } }` y la
 * UI redacta **desde `code`**. Estas pruebas fijan las dos reglas que más fácil
 * se rompen sin querer: filtrar datos ajenos en un conflicto y mostrar el
 * `message` del backend.
 */

const interval = (startsAt: string, endsAt: string, timezone: string) =>
  `de ${startsAt} a ${endsAt} (${timezone})`;

describe('errorCopy', () => {
  it('nunca usa el message del backend', () => {
    const copy = errorCopy({
      code: 'NOT_FOUND',
      message: 'Session 33333333 not found in organization aaaa',
      traceId: 'trace-1',
    });

    assert.equal(copy.title, 'Este contenido no está disponible');
    assert.ok(!copy.body.includes('33333333'));
    assert.ok(!copy.body.includes('organization'));
  });

  it('dice "no está disponible", nunca "no existe"', () => {
    // El backend oculta lo ajeno con 404: afirmar que no existe filtra información.
    const copy = errorCopy({ code: 'NOT_FOUND', message: '', traceId: 't' });
    assert.ok(copy.body.includes('no tienes acceso') || copy.title.includes('no está disponible'));
    assert.ok(!copy.title.includes('no existe'));
  });

  it('solo muestra el código de soporte cuando de verdad ayuda', () => {
    assert.equal(errorCopy({ code: 'NOT_FOUND', message: '', traceId: 't' }).showTraceId, false);
    assert.equal(errorCopy({ code: 'FORBIDDEN', message: '', traceId: 't' }).showTraceId, false);
    // Un fallo inesperado sí necesita que la persona pueda copiar el código.
    const unexpected = errorCopy({ code: 'INTERNAL_ERROR', message: '', traceId: 't' });
    assert.equal(unexpected.showTraceId, true);
  });

  it('degrada a un texto útil ante un code que no conoce', () => {
    const copy = errorCopy({ code: 'SOMETHING_NEW', message: 'raw', traceId: 't' });
    assert.ok(copy.title.length > 0);
    assert.ok(!copy.body.includes('raw'));
    assert.equal(copy.showTraceId, true);
  });

  it('no confunde el catálogo con propiedades heredadas de Object', () => {
    // Sin `Object.hasOwn`, `catalog['toString']` devolvería una función y la
    // pantalla intentaría leer `.title` de algo que no es copy.
    for (const code of ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty']) {
      const copy = errorCopy({ code, message: 'raw', traceId: 't' });
      assert.equal(typeof copy.title, 'string');
      assert.equal(typeof copy.body, 'string');
      assert.equal(typeof copy.showTraceId, 'boolean');
      assert.ok(copy.title.length > 0, `"${code}" debería caer en el texto de respaldo`);
      assert.ok(!copy.body.includes('raw'));
    }
  });

  it('explica el cierre de confirmación sin culpar a la persona', () => {
    const copy = errorCopy({ code: 'CONFIRMATION_CLOSED', message: '', traceId: 't' });
    assert.equal(copy.action, null);
    assert.ok(copy.body.includes('Avisa a tu mentora'));
  });
});

describe('scheduleConflictCopy', () => {
  const occupiedInterval = {
    startsAt: '2026-08-19T15:00:00Z',
    endsAt: '2026-08-19T16:00:00Z',
    timezone: 'America/Lima',
  };

  it('ofrece abrir la sesión cuando el actor puede verla', () => {
    const copy = scheduleConflictCopy(
      {
        resourceType: 'USER',
        resourceId: 'mentor-1',
        occupiedInterval,
        canViewConflictingSession: true,
        conflictingSessionId: 'session-9',
      },
      'Nancy G.',
      interval,
    );

    assert.equal(copy.conflictingSessionId, 'session-9');
    assert.ok(copy.body.includes('ya tiene una sesión'));
  });

  it('no revela la sesión ajena cuando el ownership no lo permite', () => {
    const copy = scheduleConflictCopy(
      {
        resourceType: 'ENROLLMENT',
        resourceId: 'enrollment-2',
        occupiedInterval,
        canViewConflictingSession: false,
        conflictingSessionId: null,
      },
      'Daniel V.',
      interval,
    );

    assert.equal(copy.conflictingSessionId, null);
    assert.ok(copy.body.includes('no está disponible'));
    assert.ok(!copy.body.includes('sesión de'));
  });

  it('ignora un id filtrado por el backend cuando el flag dice que no puede verlo', () => {
    // Defensa en profundidad: si el contrato se rompiera, la UI no enlaza igual.
    const copy = scheduleConflictCopy(
      {
        resourceType: 'ENROLLMENT',
        resourceId: 'enrollment-2',
        occupiedInterval,
        canViewConflictingSession: false,
        conflictingSessionId: 'session-que-no-deberia-llegar',
      },
      'Daniel V.',
      interval,
    );

    assert.equal(copy.conflictingSessionId, null);
  });

  it('nunca promete el siguiente horario libre', () => {
    for (const canView of [true, false]) {
      const copy = scheduleConflictCopy(
        {
          resourceType: 'USER',
          resourceId: 'mentor-1',
          occupiedInterval,
          canViewConflictingSession: canView,
          conflictingSessionId: canView ? 'session-9' : null,
        },
        'Nancy G.',
        interval,
      );

      // El backend no lo calcula; sugerirlo solo produce un segundo 409.
      assert.ok(!copy.body.toLowerCase().includes('libre'));
      assert.ok(!copy.body.toLowerCase().includes('disponible a las'));
      assert.equal(copy.action, 'Elegir otro horario');
    }
  });
});

describe('isApiError', () => {
  it('reconoce el envelope sin mirar el status HTTP', () => {
    assert.equal(isApiError({ error: { code: 'X', message: 'm', traceId: 't' } }), true);
  });

  it('rechaza cualquier otra forma', () => {
    assert.equal(isApiError(null), false);
    assert.equal(isApiError(undefined), false);
    assert.equal(isApiError('error'), false);
    assert.equal(isApiError({ error: 'texto plano' }), false);
    assert.equal(isApiError({ error: { message: 'sin code ni traceId' } }), false);
    assert.equal(isApiError({ data: [] }), false);
  });

  it('exige que los tres campos sean strings, no solo que existan', () => {
    // `'code' in candidate` bastaba antes y dejaba pasar valores que revientan
    // en cuanto alguien los usa para buscar copy.
    assert.equal(isApiError({ error: { code: null, message: 'm', traceId: 't' } }), false);
    assert.equal(isApiError({ error: { code: 'X', message: 'm', traceId: null } }), false);
    assert.equal(isApiError({ error: { code: 'X', traceId: 't' } }), false);
    assert.equal(isApiError({ error: { code: 42, message: 'm', traceId: 't' } }), false);
    assert.equal(isApiError({ error: { code: 'X', message: {}, traceId: 't' } }), false);
  });
});
