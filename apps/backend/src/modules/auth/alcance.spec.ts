import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RolUsuario } from '../../database/entities';
import { consorciosGestionados, esGestor, gestiona } from './alcance';
import type { UsuarioActual } from './auth.types';

const superAdmin: UsuarioActual = { id: 's1', email: 's@x', rol: RolUsuario.SUPER_ADMIN };
const admin: UsuarioActual = {
  id: 'a1',
  email: 'a@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c1', 'c2'],
};
const adminSinConsorcios: UsuarioActual = { id: 'a2', email: 'b@x', rol: RolUsuario.ADMINISTRADOR };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

describe('alcance', () => {
  it('el superadmin gestiona todos los consorcios', () => {
    assert.equal(consorciosGestionados(superAdmin), undefined);
    assert.equal(gestiona(superAdmin, 'cualquiera'), true);
  });

  it('el administrador gestiona sólo los suyos', () => {
    assert.deepEqual(consorciosGestionados(admin), ['c1', 'c2']);
    assert.equal(gestiona(admin, 'c1'), true);
    assert.equal(gestiona(admin, 'c3'), false);
  });

  it('un administrador sin consorcios no gestiona ninguno', () => {
    assert.deepEqual(consorciosGestionados(adminSinConsorcios), []);
    assert.equal(gestiona(adminSinConsorcios, 'c1'), false);
  });

  it('el vecino no gestiona consorcios', () => {
    assert.equal(esGestor(vecino), false);
    assert.equal(gestiona(vecino, 'c1'), false);
    assert.equal(esGestor(admin), true);
    assert.equal(esGestor(superAdmin), true);
  });
});
