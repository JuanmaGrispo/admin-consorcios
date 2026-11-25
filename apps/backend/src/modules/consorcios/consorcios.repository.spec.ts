import { ConflictException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QueryFailedError, type Repository } from 'typeorm';
import type { Consorcio } from '../../database/entities';
import { ConsorciosRepository } from './consorcios.repository';

function repositorioQueFalla(code: string): ConsorciosRepository {
  const repo = {
    delete: async () => {
      throw new QueryFailedError('DELETE FROM consorcio', [], Object.assign(new Error('falla'), { code }));
    },
  } as unknown as Repository<Consorcio>;
  return new ConsorciosRepository(repo);
}

describe('ConsorciosRepository — borrado', () => {
  it('un consorcio con datos responde 409, no 500 (DEF-08)', async () => {
    await assert.rejects(repositorioQueFalla('23503').remove('c1'), ConflictException);
  });

  it('otro error de la base no se disfraza de conflicto', async () => {
    await assert.rejects(repositorioQueFalla('57014').remove('c1'), QueryFailedError);
  });

  it('borra el que no tiene datos y avisa si no existía', async () => {
    const afectados = [1, 0];
    const repo = { delete: async () => ({ affected: afectados.shift() }) } as unknown as Repository<Consorcio>;
    const consorcios = new ConsorciosRepository(repo);
    assert.equal(await consorcios.remove('c1'), true);
    assert.equal(await consorcios.remove('c2'), false);
  });
});
