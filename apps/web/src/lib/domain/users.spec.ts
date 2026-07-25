import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accountState,
  describeAccountState,
  describeRoles,
  pendingFirstAccess,
  sortByAttention,
  type AdminUser,
} from './users';

const user = (overrides: Partial<AdminUser> & Pick<AdminUser, 'id' | 'fullName'>): AdminUser => ({
  email: `${overrides.id}@example.test`,
  roles: ['PARTICIPANT'],
  isActive: true,
  mustChangePassword: false,
  version: 1,
  ...overrides,
});

describe('accountState', () => {
  it('distingue a quien aún no ha entrado de quien ya opera', () => {
    const nuevo = user({ id: 'a', fullName: 'Ana', mustChangePassword: true });
    const activo = user({ id: 'b', fullName: 'Beto' });

    assert.equal(accountState(nuevo), 'TEMPORARY_PASSWORD');
    assert.equal(accountState(activo), 'ACTIVE');
  });

  it('una cuenta desactivada lo está aunque tenga contraseña temporal', () => {
    const baja = user({
      id: 'c',
      fullName: 'Carla',
      isActive: false,
      mustChangePassword: true,
    });

    assert.equal(accountState(baja), 'INACTIVE');
  });
});

describe('describeAccountState', () => {
  it('explica qué significa cada estado, no solo lo nombra', () => {
    assert.equal(describeAccountState('TEMPORARY_PASSWORD').label, 'Contraseña temporal');
    assert.ok(describeAccountState('TEMPORARY_PASSWORD').hint.includes('primera vez'));
    // Desactivar no borra: el historial del programa depende de conservarlo.
    assert.ok(describeAccountState('INACTIVE').hint.includes('historial'));
  });
});

describe('describeRoles', () => {
  it('muestra todos los roles, no solo el primero (DEC-002)', () => {
    assert.equal(describeRoles(['MENTOR', 'ADMIN']), 'Mentor · Admin');
    assert.equal(describeRoles(['PARTICIPANT']), 'Participante');
  });

  it('no se rompe con una lista vacía', () => {
    assert.equal(describeRoles([]), '');
  });
});

describe('pendingFirstAccess', () => {
  it('cuenta solo a quien sigue sin entrar', () => {
    const users = [
      user({ id: 'a', fullName: 'Ana', mustChangePassword: true }),
      user({ id: 'b', fullName: 'Beto' }),
      user({ id: 'c', fullName: 'Carla', mustChangePassword: true }),
      // Desactivada: ya no participa, no cuenta como pendiente.
      user({ id: 'd', fullName: 'Dora', isActive: false, mustChangePassword: true }),
    ];

    assert.equal(pendingFirstAccess(users), 2);
  });

  it('llega a cero cuando todos entraron', () => {
    assert.equal(pendingFirstAccess([user({ id: 'a', fullName: 'Ana' })]), 0);
  });
});

describe('sortByAttention', () => {
  it('pone arriba a quien requiere intervención', () => {
    const sorted = sortByAttention([
      user({ id: 'b', fullName: 'Beto' }),
      user({ id: 'd', fullName: 'Dora', isActive: false }),
      user({ id: 'a', fullName: 'Ana', mustChangePassword: true }),
    ]);

    assert.deepEqual(
      sorted.map((item) => item.fullName),
      ['Ana', 'Beto', 'Dora'],
    );
  });

  it('a igual estado ordena alfabéticamente en español', () => {
    const sorted = sortByAttention([
      user({ id: 'z', fullName: 'Zoe' }),
      user({ id: 'n', fullName: 'Ñuflo' }),
      user({ id: 'a', fullName: 'Álvaro' }),
    ]);

    assert.deepEqual(
      sorted.map((item) => item.fullName),
      ['Álvaro', 'Ñuflo', 'Zoe'],
    );
  });

  it('no muta el arreglo recibido', () => {
    const input = [
      user({ id: 'b', fullName: 'Beto' }),
      user({ id: 'a', fullName: 'Ana', mustChangePassword: true }),
    ];
    const before = input.map((item) => item.id);

    sortByAttention(input);

    assert.deepEqual(
      input.map((item) => item.id),
      before,
    );
  });
});
