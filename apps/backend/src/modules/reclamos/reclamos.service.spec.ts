import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Notificador } from '../../core/notificaciones/notificador';
import { Reclamo, RolUsuario } from '../../database/entities';
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
