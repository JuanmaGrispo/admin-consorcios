import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { NaturalezaGasto, RolUsuario, RubroGasto } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { RubrosGastoRepository } from './rubros-gasto.repository';
import { RubrosGastoService } from './rubros-gasto.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };

const rubro = (datos: Partial<RubroGasto> = {}) =>
  ({
    id: 'r1',
    consorcioId: null,
    nombre: 'Sueldos',
    icono: null,
    naturaleza: NaturalezaGasto.ORDINARIO,
    ...datos,
  }) as RubroGasto;

describe('RubrosGastoService', () => {
  let guardados: RubroGasto[];
  let gastosPorRubro: Record<string, number>;
  let service: RubrosGastoService;

  beforeEach(() => {
    guardados = [];
    gastosPorRubro = {};
    const repo = {
      findById: async (id: string) => guardados.find((r) => r.id === id) ?? null,
      findPorNombre: async (nombre: string, consorcioId: string | null) =>
        guardados.find(
          (r) =>
            r.nombre.toLowerCase() === nombre.toLowerCase() &&
            (consorcioId === null || r.consorcioId === null || r.consorcioId === consorcioId),
        ) ?? null,
      contarGastos: async (id: string) => gastosPorRubro[id] ?? 0,
      create: async (d: Partial<RubroGasto>) => {
        const r = rubro({ ...d, id: 'nuevo' });
        guardados.push(r);
        return r;
      },
      remove: async () => undefined,
    } as unknown as RubrosGastoRepository;
    service = new RubrosGastoService(repo, { findOne: async () => ({}) } as unknown as ConsorciosService);
  });

  it('el administrador no crea rubros compartidos', async () => {
    await assert.rejects(service.create(admin, { nombre: 'Luz' }), ForbiddenException);
  });

  it('no repite el nombre de uno compartido', async () => {
    guardados.push(rubro());
    await assert.rejects(
      service.create(admin, { consorcioId: 'c1', nombre: 'sueldos' }),
      ConflictException,
    );
  });

  it('no borra un rubro con gastos', async () => {
    guardados.push(rubro({ consorcioId: 'c1' }));
    gastosPorRubro.r1 = 2;
    await assert.rejects(service.remove(admin, 'r1'), ConflictException);
  });

  it('exigirUsable rechaza uno de otro consorcio', async () => {
    guardados.push(rubro({ consorcioId: 'c2' }));
    await assert.rejects(service.exigirUsable('r1', 'c1'), BadRequestException);
  });
});
