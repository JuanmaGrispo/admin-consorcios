import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Notificador } from '../../core/notificaciones/notificador';
import { Reclamo, RolUsuario } from '../../database/entities';
import type { ArchivosService } from '../archivos/archivos.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { CategoriasReclamoService } from '../categorias-reclamo/categorias-reclamo.service';
import type { ProveedoresService } from '../proveedores/proveedores.service';
import type { ReclamosRepository } from './reclamos.repository';
import { ReclamosService } from './reclamos.service';

/** Anota con qué unidades filtró el listado y qué timeline pidió. */
function crearService() {
  const llamadas = { unidadesListado: [] as (string[] | undefined)[], soloVisibles: [] as boolean[] };
  const repo = {
    listar: async (_q: unknown, unidades?: string[]) => {
      llamadas.unidadesListado.push(unidades);
      return { items: [], total: 0 };
    },
    unidadesDelUsuario: async () => [],
    findById: async (id: string) => ({ id, unidadId: 'u-ajena' }) as Reclamo,
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
  );
  return { service, llamadas };
}

const superAdmin: UsuarioActual = { id: 's1', email: 's@x', rol: RolUsuario.SUPER_ADMIN };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

describe('ReclamosService — superadmin', () => {
  it('lista sin filtrar por unidades, como un administrador', async () => {
    const { service, llamadas } = crearService();
    await service.listar(superAdmin, {});
    assert.deepEqual(llamadas.unidadesListado, [undefined]);
  });

  it('abre el detalle de cualquier reclamo y ve las notas internas', async () => {
    const { service, llamadas } = crearService();
    await service.findOne(superAdmin, 'r1');
    assert.deepEqual(llamadas.soloVisibles, [false]);
  });

  it('el vecino sigue filtrado por sus unidades', async () => {
    const { service, llamadas } = crearService();
    await service.listar(vecino, {});
    assert.deepEqual(llamadas.unidadesListado, [[]]);
  });
});

describe('ReclamosService — adjuntos', () => {
  it('rechaza una foto que no se subió a reclamos', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(vecino, {
        categoriaId: 'c1',
        descripcion: 'Pierde el inodoro',
        adjuntos: [{ url: 'https://otro.com/foto.jpg' }],
      }),
      BadRequestException,
    );
  });
});
