import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import type { Aviso, Notificador } from '../../core/notificaciones/notificador';
import { Boleta, EstadoBoleta, EstadoPago, MedioPago, Pago, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { ExpensasService } from '../expensas/expensas.service';
import { firmaValida, type MercadoPagoClient, type PagoMercadoPago } from './mercado-pago.client';
import type { PagosRepository } from './pagos.repository';
import { estadoSegunMercadoPago, PagosService } from './pagos.service';

const admin: UsuarioActual = {
  id: 'a1',
  email: 'a@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c1'],
};
const adminAjeno: UsuarioActual = {
  id: 'a2',
  email: 'b@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c2'],
};

/** Pagos en memoria y un ExpensasService de mentira con una boleta de $400. */
function crearEntorno() {
  const db = {
    pagos: [] as Pago[],
    saldo: 400,
    sincronizadas: [] as string[],
    /** La secuencia de recibos de la base, en memoria. */
    correlativo: 0,
    alcances: [] as unknown[],
  };

  const repo = {
    listar: async (_q: unknown, alcance: unknown) => {
      db.alcances.push(alcance);
      return db.pagos;
    },
    findById: async (id: string) => db.pagos.find((p) => p.id === id) ?? null,
    crear: async (d: Partial<Pago>) => {
      const p = { id: `p${db.pagos.length + 1}`, ...d } as Pago;
      db.pagos.push(p);
      return p;
    },
    actualizar: async (id: string, d: Partial<Pago>) =>
      Object.assign(db.pagos.find((p) => p.id === id)!, d),
    findConRelaciones: async (id: string) => {
      const pago = db.pagos.find((p) => p.id === id);
      return pago ? { ...pago, unidad: { consorcioId: 'c1', etiqueta: '3º B' } } : null;
    },
    siguienteCorrelativoRecibo: async () => (db.correlativo += 1),
    pendienteDeMercadoPago: async (boletaId: string) =>
      [...db.pagos]
        .reverse()
        .find(
          (p) =>
            p.boletaId === boletaId &&
            p.medio === MedioPago.MERCADO_PAGO &&
            p.estado === EstadoPago.PENDIENTE &&
            p.mpPreferenceId,
        ) ?? null,
    aprobadoDe: async (boletaId: string) =>
      db.pagos
        .filter((p) => p.boletaId === boletaId && p.estado === EstadoPago.APROBADO)
        .reduce((suma, p) => suma + p.monto, 0),
  } as unknown as PagosRepository;

  const boleta = {
    id: 'b1',
    unidadId: 'u1',
    total: 400,
    liquidacion: { periodo: '2026-10-01', consorcioId: 'c1' },
    unidad: { etiqueta: '3º B' },
  } as Boleta;
  const expensas = {
    boletaPagable: async () => ({ boleta, saldo: db.saldo }),
    sincronizarEstado: async (id: string) => {
      db.sincronizadas.push(id);
      return { ...boleta, estado: EstadoBoleta.PARCIAL } as Boleta;
    },
    findBoletaInterna: async () => boleta,
    vecinosDe: async () => ['v1', 'falla'],
    unidadesVisibles: async () => undefined,
  } as unknown as ExpensasService;

  const consorcios = {
    findOne: async () => ({
      administradorId: 'a1',
      nombre: 'Consorcio Rivadavia 4820',
      calle: 'Av. Rivadavia',
      numero: '4820',
      ciudad: 'CABA',
      cuit: '30-12345678-9',
    }),
  } as unknown as ConsorciosService;

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
    preferencias: 0,
  };
  const mercadoPago = {
    crearPreferencia: async () => {
      if (mp.preferenciaFalla) throw new Error('MP caído');
      mp.preferencias += 1;
      return { id: `pref${mp.preferencias}`, initPoint: `https://mp/checkout/${mp.preferencias}` };
    },
    obtenerPreferencia: async (id: string) => ({
      id,
      initPoint: `https://mp/checkout/${id.replace('pref', '')}`,
    }),
    obtenerPago: async (id: string) => mp.pagos.get(id)!,
    firmaValida: (firma?: string) => firma === 'ok',
  } as unknown as MercadoPagoClient;

  return { db, mp, repo, expensas, consorcios, mercadoPago, notificador, avisos };
}

describe('PagosService', () => {
  let entorno: ReturnType<typeof crearEntorno>;
  let service: PagosService;

  beforeEach(() => {
    entorno = crearEntorno();
    service = new PagosService(
      entorno.repo,
      entorno.expensas,
      entorno.consorcios,
      entorno.mercadoPago,
      entorno.notificador,
    );
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
      assert.equal(r.initPoint, 'https://mp/checkout/1');
      const [pago] = entorno.db.pagos;
      assert.equal(pago.estado, EstadoPago.PENDIENTE);
      assert.equal(pago.medio, MedioPago.MERCADO_PAGO);
      assert.equal(pago.monto, 400);
      assert.equal(pago.mpPreferenceId, 'pref1');
    });

    it('un segundo "Pagar" vuelve al mismo checkout en vez de abrir otro', async () => {
      const primero = await service.crearPreferencia(admin, 'b1');
      const segundo = await service.crearPreferencia(admin, 'b1');
      assert.equal(segundo.pagoId, primero.pagoId);
      assert.equal(segundo.initPoint, primero.initPoint);
      assert.equal(entorno.db.pagos.length, 1);
    });

    it('si el saldo cambió, descarta el checkout viejo y abre uno nuevo', async () => {
      await service.crearPreferencia(admin, 'b1');
      entorno.db.saldo = 250;
      const nuevo = await service.crearPreferencia(admin, 'b1');
      assert.equal(entorno.db.pagos[0].estado, EstadoPago.RECHAZADO);
      assert.equal(nuevo.pagoId, entorno.db.pagos[1].id);
      assert.equal(entorno.db.pagos[1].monto, 250);
    });

    it('si la boleta queda cobrada de más, le avisa al administrador', async () => {
      await service.crearPreferencia(admin, 'b1');
      await service.registrar(admin, { boletaId: 'b1', monto: 400, medio: MedioPago.TRANSFERENCIA });
      entorno.mp.pagos.set('100', pagoMp(100, 'approved'));
      await webhook('100');
      const aviso = entorno.avisos.find((a) => a.destinatarioId === 'a1');
      assert.match(aviso?.cuerpo ?? '', /\$400\.00 de más/);
    });

    it('un segundo intento aprobado del mismo checkout también se avisa', async () => {
      await service.crearPreferencia(admin, 'b1');
      entorno.mp.pagos.set('100', pagoMp(100, 'approved'));
      entorno.mp.pagos.set('101', pagoMp(101, 'approved'));
      await webhook('100');
      await webhook('101');
      assert.equal(entorno.db.pagos[0].mpPaymentId, '100');
      assert.ok(entorno.avisos.some((a) => a.destinatarioId === 'a1' && a.asunto.startsWith('Cobro duplicado')));
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

  describe('recibo', () => {
    const pagoMp = (status: string): PagoMercadoPago => ({
      id: 100,
      status,
      status_detail: status,
      external_reference: 'p1',
      transaction_amount: 400,
      date_approved: status === 'approved' ? '2026-10-05T12:00:00Z' : null,
    });

    it('un pago aprobado se lleva el próximo número de la secuencia', async () => {
      await service.registrar(admin, { boletaId: 'b1', monto: 100, medio: MedioPago.EFECTIVO });
      assert.equal(entorno.db.pagos[0].reciboNumero, '0001-00000001');
    });

    it('el número va en el aviso al vecino', async () => {
      await service.registrar(admin, { boletaId: 'b1', monto: 100, medio: MedioPago.EFECTIVO });
      assert.ok(entorno.avisos[0].cuerpo.includes('0001-00000001'));
    });

    it('un reintento del webhook no renumera el recibo', async () => {
      await service.crearPreferencia(admin, 'b1');
      entorno.mp.pagos.set('100', pagoMp('approved'));
      await service.procesarWebhook({ tipo: 'payment', dataId: '100', firma: 'ok', requestId: 'r1' });
      const numero = entorno.db.pagos[0].reciboNumero;

      // Un reintegro y una nueva aprobación: el comprobante sigue siendo el mismo.
      entorno.mp.pagos.set('100', pagoMp('refunded'));
      await service.procesarWebhook({ tipo: 'payment', dataId: '100', firma: 'ok', requestId: 'r1' });
      entorno.mp.pagos.set('100', pagoMp('approved'));
      await service.procesarWebhook({ tipo: 'payment', dataId: '100', firma: 'ok', requestId: 'r1' });

      assert.equal(entorno.db.pagos[0].reciboNumero, numero);
      assert.equal(entorno.db.correlativo, 1);
    });

    it('no hay recibo de un pago que no se aprobó', async () => {
      await service.crearPreferencia(admin, 'b1');
      await assert.rejects(service.reciboPdf(admin, 'p1'), BadRequestException);
    });

    it('un pago de otra unidad le da 404 al vecino', async () => {
      await service.registrar(admin, { boletaId: 'b1', monto: 100, medio: MedioPago.EFECTIVO });
      const vecinoAjeno: UsuarioActual = { id: 'v9', email: 'v@x', rol: RolUsuario.VECINO };
      entorno.expensas.unidadesVisibles = async () => ['otra-unidad'];
      await assert.rejects(service.findOne(vecinoAjeno, 'p1'), NotFoundException);
    });

    it('al administrador de otro consorcio, el pago le da 404 y la lista se acota', async () => {
      await service.registrar(admin, { boletaId: 'b1', monto: 100, medio: MedioPago.EFECTIVO });
      await assert.rejects(service.findOne(adminAjeno, 'p1'), NotFoundException);
      await service.listar(adminAjeno, {});
      assert.deepEqual(entorno.db.alcances, [{ consorcioIds: ['c2'] }]);
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
