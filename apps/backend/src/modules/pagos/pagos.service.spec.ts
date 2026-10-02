import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import type { Aviso, Notificador } from '../../core/notificaciones/notificador';
import { Boleta, EstadoBoleta, EstadoPago, MedioPago, Pago, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ExpensasService } from '../expensas/expensas.service';
import { firmaValida, type MercadoPagoClient, type PagoMercadoPago } from './mercado-pago.client';
import type { PagosRepository } from './pagos.repository';
import { estadoSegunMercadoPago, PagosService } from './pagos.service';

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
    boletaPagable: async () => ({
      boleta: {
        id: 'b1',
        unidadId: 'u1',
        total: 400,
        liquidacion: { periodo: '2026-10-01' },
        unidad: { etiqueta: '3º B' },
      } as Boleta,
      saldo: db.saldo,
    }),
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

  /** Lo que "responde" Mercado Pago, por id de pago. */
  const mp = {
    pagos: new Map<string, PagoMercadoPago>(),
    preferenciaFalla: false,
  };
  const mercadoPago = {
    crearPreferencia: async () => {
      if (mp.preferenciaFalla) throw new Error('MP caído');
      return { id: 'pref1', initPoint: 'https://mp/checkout' };
    },
    obtenerPago: async (id: string) => mp.pagos.get(id)!,
    firmaValida: (firma?: string) => firma === 'ok',
  } as unknown as MercadoPagoClient;

  return { db, mp, repo, expensas, mercadoPago, notificador, avisos };
}

describe('PagosService', () => {
  let entorno: ReturnType<typeof crearEntorno>;
  let service: PagosService;

  beforeEach(() => {
    entorno = crearEntorno();
    service = new PagosService(entorno.repo, entorno.expensas, entorno.mercadoPago, entorno.notificador);
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

  describe('Mercado Pago', () => {
    const pagoMp = (id: number, status: string, monto = 400): PagoMercadoPago => ({
      id,
      status,
      status_detail: status,
      external_reference: 'p1',
      transaction_amount: monto,
      date_approved: status === 'approved' ? '2026-10-05T12:00:00Z' : null,
    });
    const webhook = (dataId: string, firma = 'ok') =>
      service.procesarWebhook({ tipo: 'payment', dataId, firma, requestId: 'r1' });

    it('la preferencia crea un pago pendiente por el saldo', async () => {
      const r = await service.crearPreferencia(admin, 'b1');
      assert.equal(r.initPoint, 'https://mp/checkout');
      const [pago] = entorno.db.pagos;
      assert.equal(pago.estado, EstadoPago.PENDIENTE);
      assert.equal(pago.medio, MedioPago.MERCADO_PAGO);
      assert.equal(pago.monto, 400);
      assert.equal(pago.mpPreferenceId, 'pref1');
    });

    it('si Mercado Pago falla, el pago no queda pendiente para siempre', async () => {
      entorno.mp.preferenciaFalla = true;
      await assert.rejects(service.crearPreferencia(admin, 'b1'));
      assert.equal(entorno.db.pagos[0].estado, EstadoPago.RECHAZADO);
    });

    it('con firma inválida, 401 y no toca nada', async () => {
      await service.crearPreferencia(admin, 'b1');
      await assert.rejects(webhook('100', 'trucha'), UnauthorizedException);
      assert.equal(entorno.db.pagos[0].estado, EstadoPago.PENDIENTE);
    });

    it('aprueba el pago, mueve la boleta y es idempotente', async () => {
      await service.crearPreferencia(admin, 'b1');
      entorno.mp.pagos.set('100', pagoMp(100, 'approved'));
      await webhook('100');
      await webhook('100');
      const [pago] = entorno.db.pagos;
      assert.equal(pago.estado, EstadoPago.APROBADO);
      assert.equal(pago.mpPaymentId, '100');
      // El reintento no vuelve a sincronizar ni a avisar.
      assert.deepEqual(entorno.db.sincronizadas, ['b1']);
      assert.equal(entorno.avisos.length, 1);
    });

    it('un intento rechazado tardío no pisa uno aprobado', async () => {
      await service.crearPreferencia(admin, 'b1');
      entorno.mp.pagos.set('100', pagoMp(100, 'rejected'));
      entorno.mp.pagos.set('101', pagoMp(101, 'approved'));
      await webhook('101');
      await webhook('100');
      assert.equal(entorno.db.pagos[0].estado, EstadoPago.APROBADO);
      assert.equal(entorno.db.pagos[0].mpPaymentId, '101');
    });

    it('un reintegro vuelve a sincronizar la boleta', async () => {
      await service.crearPreferencia(admin, 'b1');
      entorno.mp.pagos.set('100', pagoMp(100, 'approved'));
      await webhook('100');
      entorno.mp.pagos.set('100', pagoMp(100, 'refunded'));
      await webhook('100');
      assert.equal(entorno.db.pagos[0].estado, EstadoPago.REINTEGRADO);
      assert.deepEqual(entorno.db.sincronizadas, ['b1', 'b1']);
    });

    it('ignora avisos que no son de pagos', async () => {
      await service.procesarWebhook({ tipo: 'merchant_order', dataId: '9', firma: 'ok', requestId: 'r1' });
      assert.equal(entorno.db.pagos.length, 0);
    });

    it('traduce los estados de Mercado Pago', () => {
      assert.equal(estadoSegunMercadoPago('approved'), EstadoPago.APROBADO);
      assert.equal(estadoSegunMercadoPago('cancelled'), EstadoPago.RECHAZADO);
      assert.equal(estadoSegunMercadoPago('charged_back'), EstadoPago.REINTEGRADO);
      assert.equal(estadoSegunMercadoPago('in_process'), EstadoPago.PENDIENTE);
    });
  });
});

describe('firmaValida', () => {
  const secreto = 'secreto';
  const firmar = (manifest: string) => createHmac('sha256', secreto).update(manifest).digest('hex');

  it('acepta la firma del manifest de Mercado Pago', () => {
    const v1 = firmar('id:abc123;request-id:req-1;ts:1700000000;');
    assert.equal(firmaValida(secreto, `ts=1700000000,v1=${v1}`, 'req-1', 'ABC123'), true);
  });

  it('rechaza otra firma, otro id o cabeceras faltantes', () => {
    const v1 = firmar('id:abc123;request-id:req-1;ts:1700000000;');
    assert.equal(firmaValida(secreto, `ts=1700000000,v1=${v1}`, 'req-1', 'otro'), false);
    assert.equal(firmaValida(secreto, 'ts=1700000000,v1=00', 'req-1', 'abc123'), false);
    assert.equal(firmaValida(secreto, undefined, 'req-1', 'abc123'), false);
    assert.equal(firmaValida(secreto, `ts=1700000000,v1=${v1}`, undefined, 'abc123'), false);
  });
});
