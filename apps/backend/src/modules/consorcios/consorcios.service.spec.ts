import { NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Consorcio, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { UsuariosService } from '../usuarios/usuarios.service';
import type { ConsorciosRepository } from './consorcios.repository';
import { ConsorciosService } from './consorcios.service';

const superAdmin: UsuarioActual = { id: 's1', email: 's@x', rol: RolUsuario.SUPER_ADMIN };
const admin: UsuarioActual = {
  id: 'a1',
  email: 'a@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c1'],
};
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

type Filtro = { id?: string; ids?: string[]; vecinoId?: string };

describe('ConsorciosService — alcance', () => {
  let filtros: Filtro[];
  let service: ConsorciosService;

  beforeEach(() => {
    filtros = [];
    const todos = [{ id: 'c1' }, { id: 'c2' }] as Consorcio[];
    const repo = {
      findAll: async (filtro: Filtro) => {
        filtros.push(filtro);
        return todos.filter(
          (c) => (!filtro.id || c.id === filtro.id) && (!filtro.ids || filtro.ids.includes(c.id)),
        );
      },
    } as unknown as ConsorciosRepository;
    service = new ConsorciosService(repo, {} as UsuariosService);
  });

  it('el superadmin lista todos', async () => {
    const lista = await service.findAll(superAdmin);
    assert.equal(lista.length, 2);
    assert.deepEqual(filtros[0], { ids: undefined });
  });

  it('el administrador lista sólo los suyos', async () => {
    const lista = await service.findAll(admin);
    assert.deepEqual(lista.map((c) => c.id), ['c1']);
  });

  it('el vecino lista los consorcios donde vive', async () => {
    await service.findAll(vecino);
    assert.deepEqual(filtros[0], { vecinoId: 'v1' });
  });

  it('un consorcio ajeno responde 404 al administrador', async () => {
    await assert.rejects(service.findVisible(admin, 'c2'), NotFoundException);
    const propio = await service.findVisible(admin, 'c1');
    assert.equal(propio.id, 'c1');
  });
});
