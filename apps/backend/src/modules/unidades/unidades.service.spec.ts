import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RolUsuario, Unidad, UnidadUsuario, VinculoUnidad } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { UsuariosService } from '../usuarios/usuarios.service';
import type { UnidadesRepository } from './unidades.repository';
import { UnidadesService } from './unidades.service';

const CONSORCIO = 'c1';
const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const unidad = (datos: Partial<Unidad> = {}) =>
  ({ id: 'u1', consorcioId: CONSORCIO, etiqueta: '1º A', coeficiente: 10, activa: true, ...datos }) as Unidad;

/** Repositorio en memoria con lo justo para cada caso. */
function crearRepo() {
  const estado = {
    unidades: [] as Unidad[],
    vinculos: [] as UnidadUsuario[],
    hoy: '2026-09-25',
    borrados: [] as string[],
    terminados: [] as { id: string; hasta: string }[],
  };
  const repo = {
    listar: async (f: { ids?: string[] }) =>
      estado.unidades.filter((u) => !f.ids || f.ids.includes(u.id)),
    findById: async (id: string) => estado.unidades.find((u) => u.id === id) ?? null,
    findByEtiqueta: async (c: string, e: string) =>
      estado.unidades.find((u) => u.consorcioId === c && u.etiqueta === e) ?? null,
    sumaCoeficientes: async (c: string, excluir?: string) =>
      estado.unidades
        .filter((u) => u.consorcioId === c && u.activa && u.id !== excluir)
        .reduce((s, u) => s + u.coeficiente, 0),
    create: async (d: Partial<Unidad>) => {
      const nueva = unidad({ ...d, id: `u${estado.unidades.length + 1}` });
      estado.unidades.push(nueva);
      return nueva;
    },
    update: async (u: Unidad, d: Partial<Unidad>) => ({ ...u, ...d }),
    hoy: async () => estado.hoy,
    unidadesDelUsuario: async (usuarioId: string) =>
      estado.vinculos.filter((v) => v.usuarioId === usuarioId).map((v) => v.unidadId),
    findVinculo: async (id: string) => estado.vinculos.find((v) => v.id === id) ?? null,
    findVinculoVigente: async (u: string, us: string) =>
      estado.vinculos.find((v) => v.unidadId === u && v.usuarioId === us && !v.hasta) ?? null,
    findTitularVigente: async (u: string) =>
      estado.vinculos.find((v) => v.unidadId === u && v.esTitular && !v.hasta) ?? null,
    crearVinculo: async (d: Partial<UnidadUsuario>) =>
      ({ id: 'nuevo', desde: estado.hoy, hasta: null, ...d, usuario: { id: d.usuarioId, nombre: 'N', apellido: 'A', email: 'e', passwordHash: 'x' } }) as unknown as UnidadUsuario,
    borrarVinculo: async (id: string) => void estado.borrados.push(id),
    terminarVinculo: async (id: string, hasta: string) => void estado.terminados.push({ id, hasta }),
  };
  return { estado, repo: repo as unknown as UnidadesRepository };
}

describe('UnidadesService', () => {
  let estado: ReturnType<typeof crearRepo>['estado'];
  let service: UnidadesService;
  let usuarios: Record<string, { activo: boolean; rol: RolUsuario; nombre: string; apellido: string }>;

  beforeEach(() => {
    const creado = crearRepo();
    estado = creado.estado;
    usuarios = {
      v1: { activo: true, rol: RolUsuario.VECINO, nombre: 'Ana', apellido: 'Paz' },
      a1: { activo: true, rol: RolUsuario.ADMINISTRADOR, nombre: 'Luis', apellido: 'Sosa' },
    };
    const consorcios = { findOne: async () => ({}) } as unknown as ConsorciosService;
    const usuariosService = {
      findOne: async (id: string) => (usuarios[id] ? { id, ...usuarios[id] } : null),
    } as unknown as UsuariosService;
    service = new UnidadesService(creado.repo, consorcios, usuariosService);
  });

  describe('coeficientes', () => {
    it('rechaza un alta que haría pasar el 100%', async () => {
      estado.unidades.push(unidad({ coeficiente: 95 }));
      await assert.rejects(
        service.create({ consorcioId: CONSORCIO, etiqueta: '2º A', coeficiente: 5.0001 }),
        BadRequestException,
      );
    });

    it('acepta llegar justo al 100% sin error de redondeo', async () => {
      estado.unidades.push(unidad({ coeficiente: 33.3333 }), unidad({ id: 'u2', etiqueta: '2º A', coeficiente: 33.3333 }));
      await service.create({ consorcioId: CONSORCIO, etiqueta: '3º A', coeficiente: 33.3334 });
    });

    it('no cuenta las unidades inactivas', async () => {
      estado.unidades.push(unidad({ coeficiente: 95, activa: false }));
      await service.create({ consorcioId: CONSORCIO, etiqueta: '2º A', coeficiente: 50 });
    });

    it('revisa el tope al reactivar una unidad', async () => {
      estado.unidades.push(
        unidad({ id: 'u1', coeficiente: 20, activa: false }),
        unidad({ id: 'u2', etiqueta: '2º A', coeficiente: 90 }),
      );
      await assert.rejects(service.update('u1', { activa: true }), BadRequestException);
    });

    it('al editar no se cuenta a sí misma', async () => {
      estado.unidades.push(unidad({ coeficiente: 60 }), unidad({ id: 'u2', etiqueta: '2º A', coeficiente: 30 }));
      await service.update('u1', { coeficiente: 70 });
    });
  });

  it('rechaza una etiqueta repetida en el consorcio', async () => {
    estado.unidades.push(unidad());
    await assert.rejects(
      service.create({ consorcioId: CONSORCIO, etiqueta: '1º A', coeficiente: 1 }),
      ConflictException,
    );
  });

  describe('visibilidad', () => {
    it('al vecino, una unidad ajena le da 404', async () => {
      estado.unidades.push(unidad());
      await assert.rejects(service.findOne(vecino, 'u1'), NotFoundException);
    });

    it('el vecino lista sólo las suyas', async () => {
      estado.unidades.push(unidad(), unidad({ id: 'u2', etiqueta: '2º A' }));
      estado.vinculos.push({ id: 'x', unidadId: 'u2', usuarioId: 'v1' } as UnidadUsuario);
      const vistas = await service.listar(vecino, {});
      assert.deepEqual(vistas.map((u) => u.id), ['u2']);
    });

    it('el administrador ve cualquiera', async () => {
      estado.unidades.push(unidad());
      assert.equal((await service.findOne(admin, 'u1')).id, 'u1');
    });
  });

  describe('vínculos', () => {
    beforeEach(() => void estado.unidades.push(unidad()));

    it('sólo vincula usuarios con rol VECINO', async () => {
      await assert.rejects(
        service.vincular('u1', { usuarioId: 'a1', vinculo: VinculoUnidad.PROPIETARIO }),
        BadRequestException,
      );
    });

    it('no vincula a una unidad dada de baja', async () => {
      estado.unidades[0].activa = false;
      await assert.rejects(
        service.vincular('u1', { usuarioId: 'v1', vinculo: VinculoUnidad.INQUILINO }),
        BadRequestException,
      );
    });

    it('no admite un segundo titular vigente', async () => {
      estado.vinculos.push({ id: 't', unidadId: 'u1', usuarioId: 'otro', esTitular: true, hasta: null } as UnidadUsuario);
      await assert.rejects(
        service.vincular('u1', { usuarioId: 'v1', vinculo: VinculoUnidad.PROPIETARIO, esTitular: true }),
        ConflictException,
      );
    });

    it('no duplica un vínculo vigente', async () => {
      estado.vinculos.push({ id: 'x', unidadId: 'u1', usuarioId: 'v1', hasta: null } as UnidadUsuario);
      await assert.rejects(
        service.vincular('u1', { usuarioId: 'v1', vinculo: VinculoUnidad.INQUILINO }),
        ConflictException,
      );
    });

    it('el vínculo sale sin el hash del usuario', async () => {
      const v = await service.vincular('u1', { usuarioId: 'v1', vinculo: VinculoUnidad.INQUILINO });
      assert.equal('passwordHash' in v.usuario, false);
    });

    it('termina hoy un vínculo que ya regía', async () => {
      estado.vinculos.push({ id: 'x', unidadId: 'u1', desde: '2025-01-10', hasta: null } as UnidadUsuario);
      await service.desvincular('u1', 'x');
      assert.deepEqual(estado.terminados, [{ id: 'x', hasta: '2026-09-25' }]);
      assert.deepEqual(estado.borrados, []);
    });

    it('borra un vínculo que todavía no había empezado', async () => {
      estado.vinculos.push({ id: 'x', unidadId: 'u1', desde: '2026-09-25', hasta: null } as UnidadUsuario);
      await service.desvincular('u1', 'x');
      assert.deepEqual(estado.borrados, ['x']);
      assert.deepEqual(estado.terminados, []);
    });

    it('un vínculo de otra unidad da 404', async () => {
      estado.vinculos.push({ id: 'x', unidadId: 'otra', desde: '2025-01-10', hasta: null } as UnidadUsuario);
      await assert.rejects(service.desvincular('u1', 'x'), NotFoundException);
    });
  });
});
