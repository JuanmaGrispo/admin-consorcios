import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Aviso, Notificador } from '../../core/notificaciones/notificador';
import {
  Boleta,
  CriterioProrrateo,
  EstadoLiquidacion,
  Gasto,
  Liquidacion,
  NaturalezaGasto,
  PeriodicidadMora,
  RolUsuario,
  Unidad,
} from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { ProveedoresService } from '../proveedores/proveedores.service';
import type { RubrosGastoService } from '../rubros-gasto/rubros-gasto.service';
import type { ExpensasRepository } from './expensas.repository';
import { ExpensasService, vencimientoPorDefecto } from './expensas.service';
import type { BoletaCalculada } from './prorrateo';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR };
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const CONSORCIO = {
  id: 'c1',
  diaVencimiento: 10,
  porcentajeFondoReserva: 0,
  tasaInteresMora: 3,
  periodicidadMora: PeriodicidadMora.MENSUAL,
};

/** Base en memoria con lo que usa el service. */
function crearEntorno() {
  const db = {
    liquidaciones: [] as Liquidacion[],
    gastos: [] as Gasto[],
    unidades: [
      { id: 'u1', consorcioId: 'c1', coeficiente: 40, activa: true },
      { id: 'u2', consorcioId: 'c1', coeficiente: 60, activa: true },
    ] as Unidad[],
    deudas: [] as { unidadId: string; saldo: number; fechaVencimiento: string }[],
    boletas: new Map<string, BoletaCalculada[]>(),
    boletaGuardada: null as Boleta | null,
    ajusteAplicado: null as unknown,
    vecinos: new Map([['u1', ['v1']], ['u2', ['v2', 'v3']]]),
    unidadesDelVecino: ['u1'],
    hoy: '2026-11-09',
  };

  const liq = (id: string) => db.liquidaciones.find((l) => l.id === id) ?? null;

  const repo = {
    findById: async (id: string) => liq(id),
    findConGastos: async (id: string) => liq(id),
    findByPeriodo: async (c: string, p: string) =>
      db.liquidaciones.find((l) => l.consorcioId === c && l.periodo === p) ?? null,
    ultimoPeriodoEmitido: async () =>
      db.liquidaciones
        .filter((l) => l.estado === EstadoLiquidacion.EMITIDA)
        .map((l) => l.periodo)
        .sort()
        .pop() ?? null,
    hayPendienteAnterior: async (c: string, p: string) =>
      db.liquidaciones.some(
        (l) =>
          l.consorcioId === c &&
          l.periodo < p &&
          l.estado !== EstadoLiquidacion.EMITIDA &&
          l.estado !== EstadoLiquidacion.CERRADA,
      ),
    create: async (d: Partial<Liquidacion>) => {
      const l = {
        id: `l${db.liquidaciones.length + 1}`,
        estado: EstadoLiquidacion.BORRADOR,
        criterioProrrateo: CriterioProrrateo.COEFICIENTE,
        ...d,
      } as Liquidacion;
      db.liquidaciones.push(l);
      return l;
    },
    update: async (id: string, d: Partial<Liquidacion>) => void Object.assign(liq(id)!, d),
    remove: async () => undefined,
    gastosDe: async (id: string) => db.gastos.filter((g) => g.liquidacionId === id),
    findGasto: async (id: string) => db.gastos.find((g) => g.id === id) ?? null,
    crearGasto: async (d: Partial<Gasto>) => {
      const g = { id: `g${db.gastos.length + 1}`, ...d } as Gasto;
      db.gastos.push(g);
      return g;
    },
    actualizarGasto: async (g: Gasto, d: Partial<Gasto>) => Object.assign(g, d),
    borrarGasto: async (id: string) => {
      db.gastos = db.gastos.filter((g) => g.id !== id);
    },
    recalcularTotalGastos: async () => undefined,
    unidadesActivas: async () => db.unidades.filter((u) => u.activa),
    deudasAnteriores: async () => db.deudas,
    ajustesDe: async () => new Map(),
    hoy: async () => db.hoy,
    reemplazarBoletas: async (id: string, b: BoletaCalculada[], estado: EstadoLiquidacion) => {
      db.boletas.set(id, b);
      liq(id)!.estado = estado;
    },
    findBoleta: async () => db.boletaGuardada,
    aplicarAjuste: async (...args: unknown[]) => {
      db.ajusteAplicado = args;
    },
    unidadesDelUsuario: async () => db.unidadesDelVecino,
    vecinosPorUnidad: async () => db.vecinos,
  } as unknown as ExpensasRepository;

  const avisos: Aviso[] = [];
  const notificador = {
    enviar: async (a: Aviso) => {
      if (a.destinatarioId === 'falla') throw new Error('SMTP caído');
      avisos.push(a);
    },
  } as unknown as Notificador;

  const service = new ExpensasService(
    repo,
    { findOne: async () => CONSORCIO } as unknown as ConsorciosService,
    {
      exigirUsable: async () => ({ id: 'r1', naturaleza: NaturalezaGasto.ORDINARIO }),
    } as unknown as RubrosGastoService,
    { exigirAsignable: async () => ({}) } as unknown as ProveedoresService,
    notificador,
  );

  return { db, service, avisos };
}

describe('vencimientoPorDefecto', () => {
  it('el día del consorcio en el mes siguiente', () => {
    assert.equal(vencimientoPorDefecto('2026-09-01', 10), '2026-10-10');
  });

  it('si el mes es más corto, el último día', () => {
    assert.equal(vencimientoPorDefecto('2026-01-01', 31), '2026-02-28');
  });

  it('diciembre vence en enero del año siguiente', () => {
    assert.equal(vencimientoPorDefecto('2026-12-01', 10), '2027-01-10');
  });
});

describe('ExpensasService', () => {
  let entorno: ReturnType<typeof crearEntorno>;
  let db: ReturnType<typeof crearEntorno>['db'];
  let service: ExpensasService;

  beforeEach(() => {
    entorno = crearEntorno();
    db = entorno.db;
    service = entorno.service;
  });

  /** Una liquidación con un gasto de $1.000, lista para previsualizar. */
  async function liquidacionConGasto(periodo = '2026-10') {
    const l = await service.create(admin, { consorcioId: 'c1', periodo });
    await service.agregarGasto(l.id, { rubroId: 'r1', descripcion: 'Luz', monto: 1_000 });
    return l;
  }

  describe('alta', () => {
    it('guarda el período como primer día del mes y calcula el vencimiento', async () => {
      const l = await service.create(admin, { consorcioId: 'c1', periodo: '2026-10' });
      assert.equal(l.periodo, '2026-10-01');
      assert.equal(l.fechaVencimiento, '2026-11-10');
      assert.equal(l.creadaPorId, 'a1');
    });

    it('una sola por consorcio y período', async () => {
      await service.create(admin, { consorcioId: 'c1', periodo: '2026-10' });
      await assert.rejects(
        service.create(admin, { consorcioId: 'c1', periodo: '2026-10' }),
        ConflictException,
      );
    });

    it('no liquida un período anterior al último emitido', async () => {
      const l = await liquidacionConGasto('2026-10');
      await service.previsualizar(l.id);
      await service.emitir(l.id);
      await assert.rejects(
        service.create(admin, { consorcioId: 'c1', periodo: '2026-09' }),
        BadRequestException,
      );
    });

    it('rechaza un vencimiento anterior al período', async () => {
      await assert.rejects(
        service.create(admin, { consorcioId: 'c1', periodo: '2026-10', fechaVencimiento: '2026-09-30' }),
        BadRequestException,
      );
    });
  });

  describe('gastos', () => {
    it('sin naturaleza toma la del rubro', async () => {
      const l = await service.create(admin, { consorcioId: 'c1', periodo: '2026-10' });
      const g = await service.agregarGasto(l.id, { rubroId: 'r1', descripcion: 'X', monto: 10 });
      assert.equal(g.naturaleza, NaturalezaGasto.ORDINARIO);
    });

    it('las cuotas van juntas', async () => {
      const l = await service.create(admin, { consorcioId: 'c1', periodo: '2026-10' });
      await assert.rejects(
        service.agregarGasto(l.id, { rubroId: 'r1', descripcion: 'X', monto: 10, cuotaNumero: 2 }),
        BadRequestException,
      );
      await assert.rejects(
        service.agregarGasto(l.id, { rubroId: 'r1', descripcion: 'X', monto: 10, cuotaNumero: 7, cuotaTotal: 6 }),
        BadRequestException,
      );
    });

    it('un gasto nuevo con la previsualización abierta recalcula las boletas', async () => {
      const l = await liquidacionConGasto();
      await service.previsualizar(l.id);
      await service.agregarGasto(l.id, { rubroId: 'r1', descripcion: 'Agua', monto: 500 });
      assert.deepEqual(db.boletas.get(l.id)!.map((b) => b.total), [600, 900]);
    });

    it('borrar el último gasto vuelve la liquidación a borrador', async () => {
      const l = await liquidacionConGasto();
      await service.previsualizar(l.id);
      await service.borrarGasto(l.id, 'g1');
      assert.equal(db.liquidaciones[0].estado, EstadoLiquidacion.BORRADOR);
      assert.deepEqual(db.boletas.get(l.id), []);
    });

    it('un gasto de otra liquidación da 404', async () => {
      const l = await liquidacionConGasto();
      const otra = await service.create(admin, { consorcioId: 'c1', periodo: '2026-11' });
      await assert.rejects(service.borrarGasto(otra.id, 'g1'), NotFoundException);
      assert.equal(l.id, 'l1');
    });
  });

  describe('previsualizar', () => {
    it('sin gastos no hay nada que calcular', async () => {
      const l = await service.create(admin, { consorcioId: 'c1', periodo: '2026-10' });
      await assert.rejects(service.previsualizar(l.id), BadRequestException);
    });

    it('por coeficiente exige que sumen 100%', async () => {
      db.unidades[1].coeficiente = 50;
      const l = await liquidacionConGasto();
      await assert.rejects(service.previsualizar(l.id), /suman 90%/);
    });

    it('por partes iguales no mira los coeficientes', async () => {
      db.unidades[1].coeficiente = 50;
      const l = await service.create(admin, {
        consorcioId: 'c1',
        periodo: '2026-10',
        criterioProrrateo: CriterioProrrateo.PARTES_IGUALES,
      });
      await service.agregarGasto(l.id, { rubroId: 'r1', descripcion: 'Luz', monto: 1_000 });
      await service.previsualizar(l.id);
      assert.deepEqual(db.boletas.get(l.id)!.map((b) => b.total), [500, 500]);
    });

    it('reparte y deja la liquidación en PREVISUALIZACION', async () => {
      const l = await liquidacionConGasto();
      await service.previsualizar(l.id);
      assert.equal(db.liquidaciones[0].estado, EstadoLiquidacion.PREVISUALIZACION);
      assert.deepEqual(db.boletas.get(l.id)!.map((b) => b.total), [400, 600]);
    });

    it('arrastra la deuda con mora por los días de atraso', async () => {
      // Venció el 10/10 y hoy es 9/11: 30 días al 3% mensual.
      db.deudas = [{ unidadId: 'u1', saldo: 1_000, fechaVencimiento: '2026-10-10' }];
      const l = await liquidacionConGasto();
      await service.previsualizar(l.id);
      const [u1] = db.boletas.get(l.id)!;
      assert.equal(u1.saldoAnterior, 1_000);
      assert.equal(u1.interesesMora, 30);
      assert.equal(u1.total, 1_430);
    });

    it('no toca una liquidación emitida', async () => {
      const l = await liquidacionConGasto();
      await service.previsualizar(l.id);
      await service.emitir(l.id);
      await assert.rejects(service.previsualizar(l.id), BadRequestException);
      await assert.rejects(
        service.agregarGasto(l.id, { rubroId: 'r1', descripcion: 'X', monto: 1 }),
        BadRequestException,
      );
    });
  });

  describe('emitir', () => {
    it('exige previsualizar antes', async () => {
      const l = await liquidacionConGasto();
      await assert.rejects(service.emitir(l.id), /Previsualizá/);
    });

    it('no emite si hay un período anterior pendiente', async () => {
      await liquidacionConGasto('2026-09');
      const l = await liquidacionConGasto('2026-10');
      await service.previsualizar(l.id);
      await assert.rejects(service.emitir(l.id), /período anterior sin emitir/);
    });

    it('congela, suma el total emitido y avisa a cada vecino', async () => {
      const l = await liquidacionConGasto();
      await service.previsualizar(l.id);
      const emitida = await service.emitir(l.id);
      assert.equal(emitida.estado, EstadoLiquidacion.EMITIDA);
      assert.equal(emitida.totalEmitido, 1_000);
      assert.ok(emitida.fechaEmision instanceof Date);
      assert.deepEqual(entorno.avisos.map((a) => a.destinatarioId).sort(), ['v1', 'v2', 'v3']);
    });

    it('un aviso que falla no corta la emisión', async () => {
      db.vecinos.set('u1', ['falla', 'v1']);
      const l = await liquidacionConGasto();
      await service.previsualizar(l.id);
      const emitida = await service.emitir(l.id);
      assert.equal(emitida.estado, EstadoLiquidacion.EMITIDA);
      assert.ok(entorno.avisos.some((a) => a.destinatarioId === 'v1'));
    });

    it('sólo se cierra una emitida', async () => {
      const l = await liquidacionConGasto();
      await assert.rejects(service.cerrar(l.id), BadRequestException);
      await service.previsualizar(l.id);
      await service.emitir(l.id);
      assert.equal((await service.cerrar(l.id)).estado, EstadoLiquidacion.CERRADA);
    });
  });

  describe('boletas', () => {
    const boleta = (estado: EstadoLiquidacion, datos: Partial<Boleta> = {}) =>
      ({
        id: 'b1',
        unidadId: 'u1',
        total: 400,
        ajusteManual: 0,
        liquidacion: { estado },
        ...datos,
      }) as Boleta;

    it('el vecino no ve una boleta en previsualización', async () => {
      db.boletaGuardada = boleta(EstadoLiquidacion.PREVISUALIZACION);
      await assert.rejects(service.findBoleta(vecino, 'b1'), NotFoundException);
    });

    it('el vecino no ve la boleta de otra unidad', async () => {
      db.boletaGuardada = boleta(EstadoLiquidacion.EMITIDA, { unidadId: 'u2' });
      await assert.rejects(service.findBoleta(vecino, 'b1'), NotFoundException);
    });

    it('el vecino ve la suya emitida', async () => {
      db.boletaGuardada = boleta(EstadoLiquidacion.EMITIDA);
      assert.equal((await service.findBoleta(vecino, 'b1')).id, 'b1');
    });

    it('un ajuste pide motivo', async () => {
      db.boletaGuardada = boleta(EstadoLiquidacion.PREVISUALIZACION);
      await assert.rejects(service.ajustarBoleta('b1', { ajusteManual: -50 }), /motivo/);
    });

    it('un ajuste no puede dejar el total negativo', async () => {
      db.boletaGuardada = boleta(EstadoLiquidacion.PREVISUALIZACION);
      await assert.rejects(
        service.ajustarBoleta('b1', { ajusteManual: -401, motivoAjuste: 'x' }),
        /negativo/,
      );
    });

    it('reemplaza el ajuste anterior al recalcular el total', async () => {
      db.boletaGuardada = boleta(EstadoLiquidacion.PREVISUALIZACION, { total: 350, ajusteManual: -50 });
      await service.ajustarBoleta('b1', { ajusteManual: 25.5, motivoAjuste: 'Cargo por llave' });
      const [id, datos, linea] = db.ajusteAplicado as [string, { total: number }, { monto: number }];
      assert.equal(id, 'b1');
      assert.equal(datos.total, 425.5);
      assert.deepEqual(linea, { concepto: 'Ajuste: Cargo por llave', monto: 25.5 });
    });

    it('no se ajusta una boleta emitida', async () => {
      db.boletaGuardada = boleta(EstadoLiquidacion.EMITIDA);
      await assert.rejects(
        service.ajustarBoleta('b1', { ajusteManual: 10, motivoAjuste: 'x' }),
        BadRequestException,
      );
    });
  });
});
