import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lookup, lookupOr } from './lookup';

/**
 * Las claves que rompieron los tres diccionarios anteriores. Si alguien
 * reemplaza `lookup` por un acceso directo, estas pruebas lo detienen.
 */
const inheritedKeys = [
  'toString',
  'constructor',
  '__proto__',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
];

const dictionary = { alpha: 'A', beta: 'B' };

describe('lookup', () => {
  it('devuelve el valor de una clave propia', () => {
    assert.equal(lookup(dictionary, 'alpha'), 'A');
    assert.equal(lookup(dictionary, 'beta'), 'B');
  });

  it('devuelve null para una clave que no existe', () => {
    assert.equal(lookup(dictionary, 'gamma'), null);
    assert.equal(lookup(dictionary, ''), null);
  });

  it('nunca devuelve algo heredado de Object.prototype', () => {
    for (const key of inheritedKeys) {
      const result = lookup(dictionary, key);
      assert.equal(result, null, `"${key}" no debería resolver contra el prototipo`);
      assert.notEqual(typeof result, 'function');
    }
  });

  it('respeta un valor propio aunque se llame como algo heredado', () => {
    // Si alguien define legítimamente una clave "toString", debe devolverla.
    assert.equal(lookup({ toString: 'valor propio' }, 'toString'), 'valor propio');
  });
});

describe('lookupOr', () => {
  it('usa el respaldo cuando la clave no es propia', () => {
    assert.equal(lookupOr(dictionary, 'gamma', 'Z'), 'Z');
    for (const key of inheritedKeys) {
      assert.equal(lookupOr(dictionary, key, 'Z'), 'Z');
    }
  });

  it('no usa el respaldo cuando la clave existe', () => {
    assert.equal(lookupOr(dictionary, 'alpha', 'Z'), 'A');
  });
});
