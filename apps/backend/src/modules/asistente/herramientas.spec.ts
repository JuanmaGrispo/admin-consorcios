import { NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RolUsuario } from '../../database/entities';
import type { EstadoCuentaService } from '../expensas/estado-cuenta.service';
import type { ReclamosService } from '../reclamos/reclamos.service';
import type { ReservasService } from '../reservas/reservas.service';
import type { AsistenteRepository } from './asistente.repository';
import { HERRAMIENTAS_POR_ROL, HerramientasAsistente } from './herramientas';

const VECINO = { id: 'u1', email: 'v@x', rol: RolUsuario.VECINO as const };
const ADMIN = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR as const, consorcioIds: ['c1'] };

function crear(reclamos: Partial<ReclamosService> = {}) {
  return new HerramientasAsistente(
    {} as EstadoCuentaService,
    reclamos as ReclamosService,
    {} as ReservasService,
    {} as AsistenteRepository,
  );
}

describe('HerramientasAsistente', () => {
  it('todas las herramientas sirven en modo estricto y ninguna recibe un id', () => {
    for (const h of Object.values(HERRAMIENTAS_POR_ROL).flat()) {
      // El modo estricto pide que todo campo sea obligatorio y no admite campos extra.
      assert.deepEqual(h.parameters.required, Object.keys(h.parameters.properties), h.name);
      assert.equal(h.parameters.additionalProperties, false, h.name);
      const campos = Object.keys(h.parameters.properties);
      assert.ok(!campos.some((c) => /id$/i.test(c)), `${h.name} recibe ${campos}`);
    }
  });

  it('una herramienta de otro rol vuelve como error, sin correr', async () => {
    const r = await crear().ejecutar(VECINO, 'deuda_antigua', { dias: 30 });
    assert.deepEqual(r, { error: 'La herramienta deuda_antigua no está disponible.' });
    const r2 = await crear().ejecutar(ADMIN, 'mis_reclamos', { situacion: 'todos' });
    assert.ok((r2 as { error?: string }).error);
  });

  it('una entrada inválida vuelve como error para el modelo', async () => {
    const r = await crear().ejecutar(VECINO, 'mis_reclamos', { situacion: 'borrar' });
    assert.match((r as { error: string }).error, /situacion/);
  });

  it('consulta con el usuario del token y devuelve sólo lo necesario', async () => {
    let quien: unknown;
    const reclamos = {
      listar: async (usuario: unknown) => {
        quien = usuario;
        return {
          items: [
            {
              id: 'r1',
              codigo: 'R-0001',
              titulo: 'Pérdida en el baño',
              estado: 'NUEVO',
              categoria: { nombre: 'Plomería' },
              unidad: { etiqueta: '4B' },
              creadoPor: { email: 'v@x' },
              createdAt: new Date('2026-11-01'),
              cerradoAt: null,
            },
          ],
          total: 1,
          pagina: 1,
          paginas: 1,
        };
      },
    } as unknown as ReclamosService;
    const r = (await crear(reclamos).ejecutar(VECINO, 'mis_reclamos', { situacion: 'abiertos' })) as {
      reclamos: Record<string, unknown>[];
    };
    assert.equal(quien, VECINO);
    assert.equal(r.reclamos[0].numero, 'R-0001');
    assert.ok(!('id' in r.reclamos[0]) && !('creadoPor' in r.reclamos[0]));
  });

  it('un 404 del service vuelve como dato; una falla de la base, no', async () => {
    const no = crear({ listar: async () => Promise.reject(new NotFoundException('No existe')) });
    assert.deepEqual(await no.ejecutar(VECINO, 'mis_reclamos', { situacion: 'todos' }), { error: 'No existe' });
    const caida = crear({ listar: async () => Promise.reject(new Error('ECONNRESET')) });
    await assert.rejects(caida.ejecutar(VECINO, 'mis_reclamos', { situacion: 'todos' }), /ECONNRESET/);
  });
});
