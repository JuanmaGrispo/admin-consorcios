import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { CategoriaReclamo, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { CategoriasReclamoRepository } from './categorias-reclamo.repository';
import { CategoriasReclamoService } from './categorias-reclamo.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };

const categoria = (datos: Partial<CategoriaReclamo> = {}) =>
  ({ id: 'k1', consorcioId: null, nombre: 'Plomería', icono: null, ...datos }) as CategoriaReclamo;

describe('CategoriasReclamoService', () => {
  let guardadas: CategoriaReclamo[];
  let reclamosPorCategoria: Record<string, number>;
  let borradas: string[];
  let service: CategoriasReclamoService;

  beforeEach(() => {
    guardadas = [];
    reclamosPorCategoria = {};
    borradas = [];
    const repo = {
      findById: async (id: string) => guardadas.find((c) => c.id === id) ?? null,
      findPorNombre: async (nombre: string, consorcioId: string | null) =>
        guardadas.find(
          (c) =>
            c.nombre.toLowerCase() === nombre.toLowerCase() &&
            (consorcioId === null || c.consorcioId === null || c.consorcioId === consorcioId),
        ) ?? null,
      contarReclamos: async (id: string) => reclamosPorCategoria[id] ?? 0,
      create: async (d: Partial<CategoriaReclamo>) => {
        const c = categoria({ ...d, id: 'nueva' });
        guardadas.push(c);
        return c;
      },
      remove: async (id: string) => void borradas.push(id),
    } as unknown as CategoriasReclamoRepository;
    const consorcios = { findOne: async () => ({}) } as unknown as ConsorciosService;
    service = new CategoriasReclamoService(repo, consorcios);
  });

  it('el administrador no crea categorías compartidas', async () => {
    await assert.rejects(service.create(admin, { nombre: 'Gas' }), ForbiddenException);
  });

  it('no repite el nombre de una compartida, sin importar mayúsculas', async () => {
    guardadas.push(categoria());
    await assert.rejects(
      service.create(admin, { consorcioId: 'c1', nombre: 'PLOMERÍA' }),
      ConflictException,
    );
  });

  it('el mismo nombre en otro consorcio no choca', async () => {
    guardadas.push(categoria({ consorcioId: 'c2', nombre: 'Pileta' }));
    await service.create(admin, { consorcioId: 'c1', nombre: 'Pileta' });
  });

  it('no borra una categoría con reclamos', async () => {
    guardadas.push(categoria({ consorcioId: 'c1' }));
    reclamosPorCategoria.k1 = 3;
    await assert.rejects(service.remove(admin, 'k1'), ConflictException);
    assert.deepEqual(borradas, []);
  });

  it('borra una sin reclamos', async () => {
    guardadas.push(categoria({ consorcioId: 'c1' }));
    await service.remove(admin, 'k1');
    assert.deepEqual(borradas, ['k1']);
  });

  describe('exigirUsable', () => {
    it('acepta una compartida', async () => {
      guardadas.push(categoria());
      await service.exigirUsable('k1', 'c1');
    });

    it('rechaza una de otro consorcio', async () => {
      guardadas.push(categoria({ consorcioId: 'c2' }));
      await assert.rejects(service.exigirUsable('k1', 'c1'), BadRequestException);
    });

    it('rechaza una inexistente', async () => {
      await assert.rejects(service.exigirUsable('k9', 'c1'), BadRequestException);
    });
  });
});
