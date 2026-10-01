import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Aviso, Notificador } from '../../core/notificaciones/notificador';
import { Boleta, EstadoBoleta, EstadoPago, MedioPago, Pago, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ExpensasService } from '../expensas/expensas.service';
import type { PagosRepository } from './pagos.repository';
import { PagosService } from './pagos.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };

/** Pagos en memoria y un ExpensasService de mentira con una boleta de $400. */
function crearEntorno() {
  const db = {
    pagos: [] as Pago[],
    saldo: 400,
    sincronizadas: [] as string[],
  };

  const repo = {
    listar: async () => db.pagos,
    findById: async (id: string) => db.pagos.find((p) => p.id === id) ?? null,
    crear: async (d: Partial<Pago>) => {
      const p = { id: `p${db.pagos.length + 1}`, ...d } as Pago;
      db.pagos.push(p);
      return p;
    },
    actualizar: async (id: string, d: Partial<Pago>) =>
      Object.assign(db.pagos.find((p) => p.id === id)!, d),
  } as unknown as PagosRepository;

  const expensas = {
    boletaPagable: async () => ({ boleta: { id: 'b1', unidadId: 'u1', total: 400 } as Boleta, saldo: db.saldo }),
    sincronizarEstado: async (id: string) => {
      db.sincronizadas.push(id);
      return { id, estado: EstadoBoleta.PARCIAL } as Boleta;
    },
    vecinosDe: async () => ['v1', 'falla'],
    unidadesVisibles: async () => undefined,
  } as unknown as ExpensasService;

  const avisos: Aviso[] = [];
  const notificador = {
    enviar: async (a: Aviso) => {
      if (a.destinatarioId === 'falla') throw new Error('SMTP caído');
      avisos.push(a);
    },
  } as unknown as Notificador;

  return { db, repo, expensas, notificador, avisos };
}

describe('PagosService', () => {
  let entorno: ReturnType<typeof crearEntorno>;
  let service: PagosService;

  beforeEach(() => {
    entorno = crearEntorno();
    service = new PagosService(entorno.repo, entorno.expensas, entorno.notificador);
  });

  describe('pago manual', () => {
    const dto = { boletaId: 'b1', monto: 150, medio: MedioPago.TRANSFERENCIA };

    it('nace aprobado, mueve el estado de la boleta y avisa', async () => {
      const pago = await service.registrar(admin, dto);
      assert.equal(pago.estado, EstadoPago.APROBADO);
      assert.equal(pago.unidadId, 'u1');
      assert.equal(pago.registradoPorId, 'a1');
      assert.deepEqual(entorno.db.sincronizadas, ['b1']);
      // El aviso que falla no corta el pago.
      assert.deepEqual(entorno.avisos.map((a) => a.destinatarioId), ['v1']);
    });

    it('no acepta más que el saldo', async () => {
      await assert.rejects(service.registrar(admin, { ...dto, monto: 400.01 }), BadRequestException);
      assert.equal(entorno.db.pagos.length, 0);
    });

    it('acepta exactamente el saldo', async () => {
      await service.registrar(admin, { ...dto, monto: 400 });
      assert.equal(entorno.db.pagos.length, 1);
    });
  });
});
