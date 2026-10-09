import { NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Notificador } from '../../core/notificaciones/notificador';
import { Amenity, EstadoReserva, Reserva, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { ExpensasService } from '../expensas/expensas.service';
import type { ReservasRepository } from './reservas.repository';
import { ReservasService } from './reservas.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR, consorcioIds: ['c1'] };
const adminAjeno: UsuarioActual = { id: 'a2', email: 'b@x', rol: RolUsuario.ADMINISTRADOR, consorcioIds: ['c2'] };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const sum = { id: 'am1', consorcioId: 'c1', nombre: 'SUM', activo: true } as Amenity;
const reserva = {
  id: 'rs1',
  amenityId: 'am1',
  unidadId: 'u1',
  estado: EstadoReserva.PENDIENTE,
  amenity: sum,
} as Reserva;

describe('ReservasService — alcance', () => {
  let llamadas: { amenities: unknown[]; reservas: unknown[] };
  let service: ReservasService;

  beforeEach(() => {
    llamadas = { amenities: [], reservas: [] };
    const repo = {
      cerrarVencidas: async () => undefined,
      senasDe: async () => new Map(),
      listarAmenities: async (filtro: unknown) => {
        llamadas.amenities.push(filtro);
        return [];
      },
      findAmenityById: async (id: string) => (id === sum.id ? sum : null),
      consorciosDelUsuario: async () => ['c1'],
      listar: async (_q: unknown, alcance: unknown) => {
        llamadas.reservas.push(alcance);
        return { items: [], total: 0 };
      },
      findById: async (id: string) => (id === reserva.id ? reserva : null),
      unidadesDelUsuario: async () => ['u9'],
      findBloqueo: async () => ({ id: 'b1', amenityId: 'am1' }),
      borrarBloqueo: async () => undefined,
    } as unknown as ReservasRepository;
    service = new ReservasService(
      repo,
      { findOne: async () => ({}) } as unknown as ConsorciosService,
      {} as ExpensasService,
      {} as Notificador,
    );
  });

  it('el administrador lista amenities y reservas sólo de sus consorcios', async () => {
    await service.listarAmenities(admin, {});
    await service.listar(admin, {});
    assert.deepEqual((llamadas.amenities[0] as { consorciosPermitidos: string[] }).consorciosPermitidos, ['c1']);
    assert.deepEqual(llamadas.reservas, [{ consorcios: ['c1'] }]);
  });

  it('al administrador de otro consorcio, el amenity le da 404', async () => {
    await assert.rejects(service.findAmenity(adminAjeno, 'am1'), NotFoundException);
    await assert.rejects(service.actualizarAmenity(adminAjeno, 'am1', { nombre: 'Quincho' }), NotFoundException);
    await assert.rejects(service.borrarBloqueo(adminAjeno, 'am1', 'b1'), NotFoundException);
    assert.equal((await service.findAmenity(admin, 'am1')).id, 'am1');
  });

  it('no carga amenities en un consorcio ajeno', async () => {
    await assert.rejects(
      service.crearAmenity(adminAjeno, { consorcioId: 'c1', nombre: 'Pileta' }),
      NotFoundException,
    );
  });

  it('al administrador de otro consorcio, la reserva le da 404 y no la resuelve', async () => {
    await assert.rejects(service.findOne(adminAjeno, 'rs1'), NotFoundException);
    await assert.rejects(service.aprobar(adminAjeno, 'rs1'), NotFoundException);
    await assert.rejects(
      service.rechazar(adminAjeno, 'rs1', { motivoRechazo: 'No' }),
      NotFoundException,
    );
  });

  it('al vecino, una reserva de otra unidad le da 404', async () => {
    await assert.rejects(service.findOne(vecino, 'rs1'), NotFoundException);
  });
});
