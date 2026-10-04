import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { crearSobre, type EventoDomus } from '../../core/mensajeria/eventos';
import type { PublicadorEventos } from '../../core/mensajeria/publicador-eventos';
import { Novedad, NovedadAdjunto, RolUsuario, TipoAdjunto } from '../../database/entities';
import type { ArchivosService } from '../archivos/archivos.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { FiltroNovedades, NovedadesRepository } from './novedades.repository';
import { NovedadesService } from './novedades.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR, consorcioIds: ['c1'] };
const adminAjeno: UsuarioActual = { id: 'a2', email: 'b@x', rol: RolUsuario.ADMINISTRADOR, consorcioIds: ['c2'] };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const novedad = (datos: Partial<Novedad> = {}) =>
  ({
    id: 'n1',
    consorcioId: 'c1',
    titulo: 'Corte de agua',
    cuerpo: 'El martes de 9 a 13.',
    fijada: false,
    activa: true,
    publicadaAt: new Date(),
    ...datos,
  }) as Novedad;

describe('NovedadesService', () => {
  let guardadas: Novedad[];
  let adjuntosGuardados: Partial<NovedadAdjunto>[];
  let filtros: FiltroNovedades[];
  let lecturas: string[];
  let publicados: unknown[][];
  let procesados: Set<string>;
  let automaticas: Partial<Novedad>[];
  let service: NovedadesService;

  beforeEach(() => {
    guardadas = [novedad()];
    adjuntosGuardados = [];
    filtros = [];
    lecturas = [];
    publicados = [];
    procesados = new Set();
    automaticas = [];
    const repo = {
      administradorDe: async (id: string) => (id === 'c1' ? 'a1' : null),
      crearDesdeEvento: async (eventoId: string, consumidor: string, datos: Partial<Novedad>) => {
        const clave = `${eventoId}:${consumidor}`;
        if (procesados.has(clave)) return false;
        procesados.add(clave);
        automaticas.push(datos);
        return true;
      },
      listar: async (f: FiltroNovedades) => {
        filtros.push(f);
        return { items: guardadas, total: guardadas.length };
      },
      findById: async (id: string) => guardadas.find((n) => n.id === id) ?? null,
      consorciosDelVecino: async () => ['c1'],
      leidasPor: async () => new Set(lecturas),
      contarLecturas: async () => new Map([['n1', 3]]),
      crear: async (datos: Partial<Novedad>, adjuntos: Partial<NovedadAdjunto>[]) => {
        adjuntosGuardados.push(...adjuntos);
        const nueva = novedad({ ...datos, id: 'n2' });
        guardadas.push(nueva);
        return nueva;
      },
      actualizar: async (n: Novedad, d: Partial<Novedad>) => ({ ...n, ...d }),
      marcarLeida: async (id: string) => void lecturas.push(id),
    } as unknown as NovedadesRepository;
    const archivos = {
      exigirPropia: (url: string) => {
        if (!url.startsWith('https://storage/novedades/')) throw new BadRequestException('ajena');
      },
    } as unknown as ArchivosService;
    const eventos = {
      publicar: (...args: unknown[]) => void publicados.push(args),
    } as unknown as PublicadorEventos;
    service = new NovedadesService(repo, archivos, eventos);
  });

  describe('publicar', () => {
    it('guarda la novedad publicada y avisa con novedad.publicada', async () => {
      const creada = await service.crear(admin, {
        consorcioId: 'c1',
        titulo: ' Pintura del hall ',
        cuerpo: 'Arranca el lunes.',
        adjuntos: [{ url: 'https://storage/novedades/a1/presupuesto.pdf' }],
      });
      assert.equal(creada.titulo, 'Pintura del hall');
      assert.ok(creada.publicadaAt instanceof Date);
      assert.equal(adjuntosGuardados[0].tipo, TipoAdjunto.PDF);
      assert.deepEqual(publicados, [['novedad.publicada', 'c1', { novedad_id: 'n2', titulo: 'Pintura del hall' }]]);
    });

    it('no publica en un consorcio ajeno ni con adjuntos de afuera', async () => {
      await assert.rejects(
        service.crear(adminAjeno, { consorcioId: 'c1', titulo: 'X', cuerpo: 'Y' }),
        NotFoundException,
      );
      await assert.rejects(
        service.crear(admin, { consorcioId: 'c1', titulo: 'X', cuerpo: 'Y', adjuntos: [{ url: 'https://otro.com/a.pdf' }] }),
        BadRequestException,
      );
      assert.equal(publicados.length, 0);
    });
  });

  describe('alcance', () => {
    it('el administrador lista las de sus consorcios, con cuántos la leyeron', async () => {
      const { items } = await service.listar(admin, {});
      assert.deepEqual(filtros[0].consorcioIds, ['c1']);
      assert.equal(filtros[0].soloVisibles, true);
      assert.equal(items[0].lecturas, 3);
    });

    it('el vecino lista las de donde vive, con si la leyó', async () => {
      lecturas.push('n1');
      const { items } = await service.listar(vecino, { incluirInactivas: true });
      assert.deepEqual(filtros[0].consorcioIds, ['c1']);
      assert.equal(filtros[0].soloVisibles, true);
      assert.equal(items[0].leida, true);
    });

    it('una de otro consorcio da 404 y no se edita', async () => {
      await assert.rejects(service.findOne(adminAjeno, 'n1'), NotFoundException);
      await assert.rejects(service.actualizar(adminAjeno, 'n1', { fijada: true }), NotFoundException);
    });

    it('el vecino no ve las dadas de baja', async () => {
      guardadas = [novedad({ activa: false })];
      await assert.rejects(service.findOne(vecino, 'n1'), NotFoundException);
    });
  });

  describe('lecturas', () => {
    it('el vecino la marca como leída', async () => {
      await service.marcarLeida(vecino, 'n1');
      assert.deepEqual(lecturas, ['n1']);
    });

    it('el administrador no marca lecturas', async () => {
      await assert.rejects(service.marcarLeida(admin, 'n1'), ForbiddenException);
    });
  });

  describe('muro automático', () => {
    const cerrada = (consorcioId: string) =>
      crearSobre('votacion.cerrada', consorcioId, {
        votacion_id: 'v1',
        titulo: 'Pintura',
        resultado: 'aprobada',
        participacion_pct: 70,
      }) as EventoDomus;

    it('publica en nombre del administrador y un evento repetido no la duplica', async () => {
      const evento = cerrada('c1');
      await service.publicarAutomatica(evento);
      await service.publicarAutomatica(evento);
      assert.equal(automaticas.length, 1);
      assert.equal(automaticas[0].autorId, 'a1');
      assert.equal(automaticas[0].titulo, 'Resultado de la votación: Pintura');
    });

    it('un consorcio que ya no existe no rompe el consumidor', async () => {
      await service.publicarAutomatica(cerrada('c9'));
      assert.equal(automaticas.length, 0);
    });
  });
});
