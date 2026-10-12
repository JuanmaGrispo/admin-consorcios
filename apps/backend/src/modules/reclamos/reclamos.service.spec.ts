import { BadRequestException, NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PublicadorEventos } from '../../core/mensajeria/publicador-eventos';
import type { Notificador } from '../../core/notificaciones/notificador';
import {
  EstadoReclamo,
  PrioridadReclamo,
  Reclamo,
  ReclamoEvento,
  RolUsuario,
  TipoEventoReclamo,
} from '../../database/entities';
import type { ArchivosService } from '../archivos/archivos.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { CategoriasReclamoService } from '../categorias-reclamo/categorias-reclamo.service';
import type { ProveedoresService } from '../proveedores/proveedores.service';
import type { AlcanceReclamos, ReclamosRepository } from './reclamos.repository';
import { ReclamosService } from './reclamos.service';

/** Anota con qué alcance filtró el listado y qué timeline pidió. */
function crearService() {
  const llamadas = { alcances: [] as AlcanceReclamos[], soloVisibles: [] as boolean[] };
  const repo = {
    listar: async (_q: unknown, alcance: AlcanceReclamos) => {
      llamadas.alcances.push(alcance);
      return { items: [], total: 0 };
    },
    unidadesDelUsuario: async () => [],
    findById: async (id: string) => ({ id, unidadId: 'u-ajena', consorcioId: 'c1' }) as Reclamo,
    findUnidad: async (id: string) => ({ id, consorcioId: 'c1' }),
    findEventos: async (_id: string, soloVisibles: boolean) => {
      llamadas.soloVisibles.push(soloVisibles);
      return [];
    },
  } as unknown as ReclamosRepository;
  const service = new ReclamosService(
    repo,
    {} as Notificador,
    {} as CategoriasReclamoService,
    {} as ProveedoresService,
    // Sólo son nuestras las fotos subidas a `reclamos`.
    {
      exigirPropia: (url: string) => {
        if (!url.startsWith('https://storage/reclamos/')) throw new BadRequestException('ajena');
      },
    } as unknown as ArchivosService,
    { publicar: () => undefined } as unknown as PublicadorEventos,
  );
  return { service, llamadas };
}

const superAdmin: UsuarioActual = { id: 's1', email: 's@x', rol: RolUsuario.SUPER_ADMIN };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };
const adminAjeno: UsuarioActual = {
  id: 'a2',
  email: 'b@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c2'],
};

describe('ReclamosService — superadmin', () => {
  it('lista sin filtrar por consorcios', async () => {
    const { service, llamadas } = crearService();
    await service.listar(superAdmin, {});
    assert.deepEqual(llamadas.alcances, [{ consorcios: undefined }]);
  });

  it('abre el detalle de cualquier reclamo y ve las notas internas', async () => {
    const { service, llamadas } = crearService();
    await service.findOne(superAdmin, 'r1');
    assert.deepEqual(llamadas.soloVisibles, [false]);
  });

  it('el vecino sigue filtrado por sus unidades', async () => {
    const { service, llamadas } = crearService();
    await service.listar(vecino, {});
    assert.deepEqual(llamadas.alcances, [{ unidades: [] }]);
  });
});

describe('ReclamosService — administrador de otro consorcio', () => {
  it('lista sólo los de sus consorcios', async () => {
    const { service, llamadas } = crearService();
    await service.listar(adminAjeno, {});
    assert.deepEqual(llamadas.alcances, [{ consorcios: ['c2'] }]);
  });

  it('un reclamo ajeno le da 404', async () => {
    const { service } = crearService();
    await assert.rejects(service.findOne(adminAjeno, 'r1'), NotFoundException);
  });

  it('no abre reclamos sobre una unidad ajena', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(adminAjeno, { unidadId: 'u1', categoriaId: 'k1', titulo: 'Gotera', descripcion: 'Gotera en el techo' }),
      NotFoundException,
    );
  });
});

describe('ReclamosService — adjuntos', () => {
  it('rechaza una foto que no se subió a reclamos', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(vecino, {
        categoriaId: 'c1',
        titulo: 'Inodoro',
        descripcion: 'Pierde el inodoro',
        adjuntos: [{ url: 'https://otro.com/foto.jpg' }],
      }),
      BadRequestException,
    );
  });
});

describe('ReclamosService — asignación', () => {
  it('el evento guarda a qué proveedor se asignó', async () => {
    const eventos: Partial<ReclamoEvento>[] = [];
    const reclamo = { id: 'r1', codigo: 'RC-1', consorcioId: 'c1', estado: EstadoReclamo.NUEVO } as Reclamo;
    const repo = {
      findById: async () => reclamo,
      actualizarConEvento: async (r: Reclamo, evento: Partial<ReclamoEvento>) => {
        eventos.push(evento);
        return r;
      },
    } as unknown as ReclamosRepository;
    const service = new ReclamosService(
      repo,
      { enviar: async () => undefined } as unknown as Notificador,
      {} as CategoriasReclamoService,
      { exigirAsignable: async () => ({}) } as unknown as ProveedoresService,
      {} as ArchivosService,
      { publicar: () => undefined } as unknown as PublicadorEventos,
    );

    await service.asignarProveedor(superAdmin, 'r1', { proveedorId: 'p1' });
    assert.equal(eventos[0].proveedorId, 'p1');
    assert.equal(eventos[0].tipo, TipoEventoReclamo.ASIGNACION);
  });
});

describe('ReclamosService — prioridad', () => {
  function conReclamo(reclamo: Reclamo) {
    const eventos: Partial<ReclamoEvento>[] = [];
    const avisos: unknown[] = [];
    const repo = {
      findById: async () => reclamo,
      actualizarConEvento: async (r: Reclamo, evento: Partial<ReclamoEvento>) => {
        eventos.push(evento);
        return r;
      },
    } as unknown as ReclamosRepository;
    const service = new ReclamosService(
      repo,
      { enviar: async (a: unknown) => void avisos.push(a) } as unknown as Notificador,
      {} as CategoriasReclamoService,
      {} as ProveedoresService,
      {} as ArchivosService,
      { publicar: () => undefined } as unknown as PublicadorEventos,
    );
    return { service, eventos, avisos };
  }
  const abierto = () =>
    ({ id: 'r1', codigo: 'RC-1', consorcioId: 'c1', estado: EstadoReclamo.NUEVO, prioridad: PrioridadReclamo.MEDIA }) as Reclamo;

  it('la cambia y lo deja como nota interna, sin avisar al vecino', async () => {
    const { service, eventos, avisos } = conReclamo(abierto());
    const r = await service.cambiarPrioridad(superAdmin, 'r1', { prioridad: PrioridadReclamo.ALTA });
    assert.equal(r.prioridad, PrioridadReclamo.ALTA);
    assert.equal(eventos[0].tipo, TipoEventoReclamo.NOTA_INTERNA);
    assert.equal(eventos[0].visibleParaVecino, false);
    assert.deepEqual(avisos, []);
  });

  it('rechaza la misma prioridad que ya tiene', async () => {
    const { service } = conReclamo(abierto());
    await assert.rejects(
      service.cambiarPrioridad(superAdmin, 'r1', { prioridad: PrioridadReclamo.MEDIA }),
      BadRequestException,
    );
  });

  it('un reclamo resuelto no se reprioriza', async () => {
    const { service } = conReclamo({ ...abierto(), estado: EstadoReclamo.RESUELTO } as Reclamo);
    await assert.rejects(
      service.cambiarPrioridad(superAdmin, 'r1', { prioridad: PrioridadReclamo.ALTA }),
      BadRequestException,
    );
  });

  it('un reclamo de otro consorcio da 404', async () => {
    const { service } = conReclamo(abierto());
    await assert.rejects(
      service.cambiarPrioridad(adminAjeno, 'r1', { prioridad: PrioridadReclamo.ALTA }),
      NotFoundException,
    );
  });
});
