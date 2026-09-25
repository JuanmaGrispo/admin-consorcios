import { BadRequestException, ForbiddenException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Proveedor, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { ProveedoresRepository } from './proveedores.repository';
import { ProveedoresService } from './proveedores.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };
const superAdmin: UsuarioActual = { id: 's1', email: 's@x', rol: RolUsuario.SUPER_ADMIN };

const proveedor = (datos: Partial<Proveedor> = {}) =>
  ({ id: 'p1', consorcioId: 'c1', razonSocial: 'Rivas SRL', activo: true, ...datos }) as Proveedor;

describe('ProveedoresService', () => {
  let guardados: Proveedor[];
  let service: ProveedoresService;

  beforeEach(() => {
    guardados = [];
    const repo = {
      findById: async (id: string) => guardados.find((p) => p.id === id) ?? null,
      create: async (d: Partial<Proveedor>) => {
        const p = proveedor({ consorcioId: null, ...d, id: 'nuevo' });
        guardados.push(p);
        return p;
      },
      update: async (p: Proveedor, d: Partial<Proveedor>) => ({ ...p, ...d }),
    } as unknown as ProveedoresRepository;
    const consorcios = { findOne: async () => ({}) } as unknown as ConsorciosService;
    service = new ProveedoresService(repo, consorcios);
  });

  describe('compartidos', () => {
    it('el administrador no crea proveedores compartidos', async () => {
      await assert.rejects(service.create(admin, { razonSocial: 'X' }), ForbiddenException);
    });

    it('el superadmin sí', async () => {
      const p = await service.create(superAdmin, { razonSocial: 'X' });
      assert.equal(p.consorcioId, null);
    });

    it('el administrador no edita un compartido', async () => {
      guardados.push(proveedor({ consorcioId: null }));
      await assert.rejects(service.update(admin, 'p1', { telefono: '1' }), ForbiddenException);
    });

    it('el administrador crea uno de su consorcio', async () => {
      const p = await service.create(admin, { consorcioId: 'c1', razonSocial: 'X' });
      assert.equal(p.consorcioId, 'c1');
    });
  });

  describe('exigirAsignable', () => {
    it('acepta uno del mismo consorcio', async () => {
      guardados.push(proveedor());
      await service.exigirAsignable('p1', 'c1');
    });

    it('acepta uno compartido', async () => {
      guardados.push(proveedor({ consorcioId: null }));
      await service.exigirAsignable('p1', 'c1');
    });

    it('rechaza uno de otro consorcio', async () => {
      guardados.push(proveedor({ consorcioId: 'c2' }));
      await assert.rejects(service.exigirAsignable('p1', 'c1'), BadRequestException);
    });

    it('rechaza uno dado de baja', async () => {
      guardados.push(proveedor({ activo: false }));
      await assert.rejects(service.exigirAsignable('p1', 'c1'), BadRequestException);
    });

    it('rechaza uno inexistente', async () => {
      await assert.rejects(service.exigirAsignable('p9', 'c1'), BadRequestException);
    });
  });
});
