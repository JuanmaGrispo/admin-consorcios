import { BadRequestException, NotFoundException } from '@nestjs/common';
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

/**
 * Un calendario en memoria para las reglas del amenity: guarda reservas y
 * resuelve los chequeos que en la base hacen el lock y el EXCLUDE.
 */
function crearEntorno(amenityExtra: Partial<Amenity> = {}, ahora = new Date('2026-09-10T12:00:00Z')) {
  const amenity = {
    id: 'am1',
    consorcioId: 'c1',
    nombre: 'SUM',
    activo: true,
    horaApertura: '10:00:00',
    horaCierre: '22:00:00',
    anticipacionMinimaHoras: 0,
    duracionMaximaHoras: null,
    duracionFranjaMinutos: null,
    cancelacionMinimaHoras: 0,
    lugares: 1,
    requiereAprobacion: false,
    bloqueaConDeuda: false,
    montoSena: 0,
    ...amenityExtra,
  } as Amenity;
  const reservas: Reserva[] = [];
  const ocupa = (r: Reserva) => [EstadoReserva.PENDIENTE, EstadoReserva.APROBADA].includes(r.estado);
  const repo = {
    cerrarVencidas: async () => undefined,
    senasDe: async () => new Map(),
    ahora: async () => ahora,
    findAmenityById: async () => amenity,
    findUnidad: async () => ({ id: 'u1', consorcioId: 'c1', activa: true }),
    unidadesDelUsuario: async () => ['u1'],
    // Argentina es UTC-3 todo el año: alcanza para armar instantes en el test.
    instantes: async (fecha: string, hi: string, hf: string) => {
      const inicio = new Date(`${fecha}T${hi.slice(0, 5)}:00-03:00`);
      let fin = new Date(`${fecha}T${hf === '24:00' ? '23:59' : hf.slice(0, 5)}:00-03:00`);
      if (hf === '24:00') fin = new Date(fin.getTime() + 60_000);
      else if (fin <= inicio) fin = new Date(fin.getTime() + 86_400_000);
      return { inicio, fin, ahora };
    },
    reservasEnRango: async (_a: string, inicio: Date, fin: Date) =>
      reservas.filter((r) => ocupa(r) && r.inicio < fin && r.fin > inicio),
    bloqueosEnRango: async () => [],
    haySolapamiento: async (_a: string, inicio: Date, fin: Date, excluir: string | null, _m?: unknown, lugar?: number) =>
      reservas.some(
        (r) => ocupa(r) && r.id !== excluir && r.inicio < fin && r.fin > inicio && (lugar === undefined || r.lugar === lugar),
      ),
    hayBloqueo: async () => false,
    crearReserva: async (_a: string, datos: Partial<Reserva>, chequear: (m: unknown) => Promise<Partial<Reserva> | void>) => {
      const extra = (await chequear(null)) ?? {};
      const r = { id: `rs${reservas.length + 1}`, amenity, ...datos, ...extra } as Reserva;
      reservas.push(r);
      return r;
    },
    findById: async (id: string) => reservas.find((r) => r.id === id) ?? null,
    actualizarReserva: async (r: Reserva, d: Partial<Reserva>) => Object.assign(r, d),
  } as unknown as ReservasRepository;
  const service = new ReservasService(
    repo,
    { findOne: async () => ({ administradorId: 'a1' }) } as unknown as ConsorciosService,
    { tieneDeudaVencida: async () => false } as unknown as ExpensasService,
    { enviar: async () => undefined } as unknown as Notificador,
  );
  return { service, reservas, amenity };
}

describe('ReservasService — cancelación', () => {
  // El 10/09 a las 09:00 de Buenos Aires.
  const ahora = new Date('2026-09-10T12:00:00Z');

  it('el vecino no cancela fuera del plazo del amenity, la administración sí', async () => {
    const { service } = crearEntorno({ cancelacionMinimaHoras: 24 }, ahora);
    // Mañana 11/09 a las 12:00: faltan 27 h, se puede reservar y cancelar.
    const a = await service.crear(vecino, { amenityId: 'am1', fecha: '2026-09-11', horaInicio: '12:00', horaFin: '14:00' });
    assert.equal(a.cancelableHasta?.toISOString(), '2026-09-10T15:00:00.000Z');
    // Hoy a las 20:00: faltan 11 h, ya no.
    const b = await service.crear(vecino, { amenityId: 'am1', fecha: '2026-09-10', horaInicio: '20:00', horaFin: '21:00' });
    await assert.rejects(service.cancelar(vecino, b.id), BadRequestException);
    assert.equal((await service.cancelar(admin, b.id)).estado, EstadoReserva.CANCELADA);
    assert.equal((await service.cancelar(vecino, a.id)).estado, EstadoReserva.CANCELADA);
  });
});
