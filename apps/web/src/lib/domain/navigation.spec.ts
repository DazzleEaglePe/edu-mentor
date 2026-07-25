import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { navigationFor, navigationForRoles } from './navigation';
import type { Role } from './labels';

/**
 * La navegación es una lista blanca cerrada (DEC-015). Estas pruebas existen
 * para que agregar una pantalla `FUTURE` al piloto sea un fallo de CI y no un
 * hallazgo en revisión de diseño.
 */

/** Módulos explícitamente fuera del piloto, por su ruta y por su nombre. */
const forbiddenFragments = [
  'postulacion',
  'matching',
  'graduacion',
  'apoyo',
  'reportes',
  'mensajes',
  'certificados',
  'demo-day',
  'job',
  'mentor-par',
  'checkpoints',
  'ia-cv',
];

const allRoles: readonly Role[] = ['PARTICIPANT', 'MENTOR', 'ADMIN'];

describe('navigationFor', () => {
  it('da al participante cuatro destinos', () => {
    const items = navigationFor('PARTICIPANT');
    assert.equal(items.length, 4);
    assert.deepEqual(
      items.map((item) => item.href),
      ['/inicio', '/sesiones', '/entregables', '/perfil'],
    );
  });

  it('da al mentor cinco destinos', () => {
    assert.equal(navigationFor('MENTOR').length, 5);
  });

  it('da al admin cinco destinos, sin Operación hasta Fase 4', () => {
    const items = navigationFor('ADMIN');
    assert.equal(items.length, 5);
    assert.ok(!items.some((item) => item.href.includes('operacion')));
  });

  it('no expone ninguna pantalla FUTURE en ningún rol', () => {
    for (const role of allRoles) {
      for (const item of navigationFor(role)) {
        const haystack = `${item.href} ${item.label}`.toLowerCase();
        for (const fragment of forbiddenFragments) {
          assert.ok(
            !haystack.includes(fragment),
            `"${item.label}" (${item.href}) expone un módulo fuera de alcance: ${fragment}`,
          );
        }
      }
    }
  });

  it('usa rutas absolutas, para que el shell pueda marcar la activa', () => {
    for (const role of allRoles) {
      for (const item of navigationFor(role)) {
        assert.ok(item.href.startsWith('/'), `${item.href} debería ser absoluta`);
        assert.ok(item.label.length > 0);
      }
    }
  });
});

describe('navigationForRoles', () => {
  it('une los destinos de varios roles sin duplicar', () => {
    const items = navigationForRoles(['PARTICIPANT', 'MENTOR']);
    const hrefs = items.map((item) => item.href);

    assert.equal(new Set(hrefs).size, hrefs.length);
    assert.ok(hrefs.includes('/sesiones'));
    assert.ok(hrefs.includes('/agenda'));
    // `/inicio` y `/perfil` están en ambas listas y aparecen una sola vez.
    assert.equal(hrefs.filter((href) => href === '/inicio').length, 1);
    assert.equal(hrefs.filter((href) => href === '/perfil').length, 1);
  });

  it('respeta el orden de la lista blanca, no el de los roles recibidos', () => {
    const forward = navigationForRoles(['PARTICIPANT', 'ADMIN']).map((item) => item.href);
    const reversed = navigationForRoles(['ADMIN', 'PARTICIPANT']).map((item) => item.href);
    assert.deepEqual(forward, reversed);
  });

  it('devuelve vacío sin roles, en vez de adivinar uno', () => {
    assert.deepEqual(navigationForRoles([]), []);
  });

  it('sigue sin exponer módulos fuera de alcance al combinar los tres roles', () => {
    for (const item of navigationForRoles(allRoles)) {
      const haystack = `${item.href} ${item.label}`.toLowerCase();
      for (const fragment of forbiddenFragments) {
        assert.ok(!haystack.includes(fragment), `${item.href} expone ${fragment}`);
      }
    }
  });
});
