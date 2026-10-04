import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RolUsuario, Usuario } from '../../database/entities';
import type { ArchivosService } from '../archivos/archivos.service';
import type { UsuarioActual } from '../auth/auth.types';
import { hashearPassword } from '../auth/password';
import type { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

const superAdmin: UsuarioActual = { id: 's1', email: 's@x', rol: RolUsuario.SUPER_ADMIN };
const admin: UsuarioActual = {
  id: 'a1',
  email: 'a@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c1'],
};

const cuenta = (datos: Partial<Usuario>) =>
  ({ nombre: 'N', apellido: 'A', activo: true, passwordHash: 'hash', ...datos }) as Usuario;

describe('UsuariosService', () => {
  let cuentas: Usuario[];
  /** usuarioId → consorcios donde vive hoy. */
  let viveEn: Record<string, string[]>;
  let listados: { consorcioIds: string[]; buscar?: string }[];
  let service: UsuariosService;

  beforeEach(() => {
    cuentas = [
      cuenta({ id: 'v1', email: 'ana@x', rol: RolUsuario.VECINO }),
      cuenta({ id: 'v2', email: 'beto@x', rol: RolUsuario.VECINO }),
      cuenta({ id: 'a9', email: 'otro-admin@x', rol: RolUsuario.ADMINISTRADOR }),
      cuenta({ id: 's2', email: 'otro-super@x', rol: RolUsuario.SUPER_ADMIN }),
    ];
    viveEn = { v1: ['c1'], v2: ['c2'] };
    listados = [];
    const repo = {
      findAll: async () => cuentas,
      listarVecinos: async (consorcioIds: string[], buscar?: string) => {
        listados.push({ consorcioIds, buscar });
        return cuentas.filter((u) => (viveEn[u.id] ?? []).some((c) => consorcioIds.includes(c)));
      },
      viveEn: async (id: string, consorcioIds: string[]) =>
        (viveEn[id] ?? []).some((c) => consorcioIds.includes(c)),
      findById: async (id: string) => cuentas.find((u) => u.id === id) ?? null,
      findByEmail: async (email: string) => cuentas.find((u) => u.email === email) ?? null,
      update: async (u: Usuario, d: Partial<Usuario>) => Object.assign(u, d),
    } as unknown as UsuariosRepository;
    const archivos = {
      exigirPropia: (url: string) => {
        if (!url.startsWith('https://storage/avatares/')) throw new BadRequestException('ajena');
      },
    } as unknown as ArchivosService;
    service = new UsuariosService(repo, archivos);
  });

  describe('alcance del administrador', () => {
    it('lista sólo los vecinos de sus consorcios, sin el hash', async () => {
      const lista = await service.listar(admin, {});
      assert.deepEqual(lista.map((u) => u.id), ['v1']);
      assert.equal('passwordHash' in lista[0], false);
    });

    it('filtrar por un consorcio ajeno no devuelve nada', async () => {
      await service.listar(admin, { consorcioId: 'c2' });
      assert.deepEqual(listados, [{ consorcioIds: [], buscar: undefined }]);
    });

    it('un vecino de otro consorcio, o un administrador, le da 404', async () => {
      await assert.rejects(service.findVisible(admin, 'v2'), NotFoundException);
      await assert.rejects(service.findVisible(admin, 'a9'), NotFoundException);
      assert.equal((await service.findVisible(admin, 'v1')).id, 'v1');
    });

    it('por email encuentra a un vecino existente, con datos mínimos', async () => {
      const [encontrado] = await service.listar(admin, { email: 'beto@x' });
      assert.deepEqual(encontrado, {
        id: 'v2',
        nombre: 'N',
        apellido: 'A',
        email: 'beto@x',
        rol: RolUsuario.VECINO,
      });
      assert.deepEqual(await service.listar(admin, { email: 'otro-admin@x' }), []);
    });
  });

  describe('edición', () => {
    it('el administrador edita a su vecino pero no lo da de baja', async () => {
      const editado = await service.update(admin, 'v1', { telefono: '1155550000' });
      assert.equal(editado.telefono, '1155550000');
      await assert.rejects(service.update(admin, 'v1', { activo: false }), ForbiddenException);
    });

    it('el superadmin da de baja una cuenta', async () => {
      const editado = await service.update(superAdmin, 'v2', { activo: false });
      assert.equal(editado.activo, false);
    });

    it('no deja repetir un email', async () => {
      await assert.rejects(service.update(admin, 'v1', { email: 'Beto@x' }), ConflictException);
    });

    it('las cuentas de otro superadmin no se tocan por API', async () => {
      await assert.rejects(service.update(superAdmin, 's2', { nombre: 'X' }), ForbiddenException);
      await assert.rejects(service.resetearPassword(superAdmin, 's2', 'nueva-clave'), ForbiddenException);
    });
  });

  describe('reset de contraseña', () => {
    it('el administrador resetea la de su vecino', async () => {
      await service.resetearPassword(admin, 'v1', 'nueva-clave');
      assert.notEqual(cuentas[0].passwordHash, 'hash');
    });

    it('no la de un vecino de otro consorcio', async () => {
      await assert.rejects(service.resetearPassword(admin, 'v2', 'nueva-clave'), NotFoundException);
      assert.equal(cuentas[1].passwordHash, 'hash');
    });
  });

  describe('perfil propio', () => {
    it('sale sin el hash', async () => {
      const propio = await service.perfil('v1');
      assert.equal('passwordHash' in propio, false);
    });

    it('el avatar tiene que venir de archivos', async () => {
      await assert.rejects(
        service.actualizarPerfil('v1', { avatarUrl: 'https://otro.com/yo.jpg' }),
        BadRequestException,
      );
      const propio = await service.actualizarPerfil('v1', {
        avatarUrl: 'https://storage/avatares/v1/a.jpg',
      });
      assert.equal(propio.avatarUrl, 'https://storage/avatares/v1/a.jpg');
    });

    it('cambiar la contraseña pide la actual', async () => {
      cuentas[0].passwordHash = await hashearPassword('vieja-clave');
      await assert.rejects(
        service.cambiarPassword('v1', { actual: 'otra', nueva: 'nueva-clave' }),
        BadRequestException,
      );
      const antes = cuentas[0].passwordHash;
      await service.cambiarPassword('v1', { actual: 'vieja-clave', nueva: 'nueva-clave' });
      assert.notEqual(cuentas[0].passwordHash, antes);
    });
  });
});
