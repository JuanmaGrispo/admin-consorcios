import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CriterioProrrateo, NaturalezaGasto, PeriodicidadMora } from '../../database/entities';
import { calcularBoletas, calcularMora, repartir, type ParametrosProrrateo } from './prorrateo';

const PARAMETROS: ParametrosProrrateo = {
  criterio: CriterioProrrateo.COEFICIENTE,
  porcentajeFondoReserva: 0,
  tasaInteresMora: 0,
  periodicidadMora: PeriodicidadMora.MENSUAL,
};

const gasto = (monto: number, naturaleza = NaturalezaGasto.ORDINARIO, id = 'g1') => ({
  id,
  descripcion: `Gasto ${id}`,
  monto,
  naturaleza,
});

const suma = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe('repartir', () => {
  it('no pierde centavos al dividir en partes que no cierran', () => {
    const partes = repartir(100_000, [1, 1, 1]);
    assert.deepEqual(partes, [33_334, 33_333, 33_333]);
  });

  it('respeta la proporción de los pesos', () => {
    assert.deepEqual(repartir(10_000, [25, 75]), [2_500, 7_500]);
  });

  it('el centavo sobrante va al de mayor resto, no al primero', () => {
    // 100 centavos en 33,3333 / 33,3333 / 33,3334: el tercero tiene más resto.
    assert.deepEqual(repartir(100, [33.3333, 33.3333, 33.3334]), [33, 33, 34]);
  });

  it('suma siempre el total, con montos grandes y coeficientes con decimales', () => {
    const pesos = [4.5, 5.1, 4.2, 12.3456, 73.8544];
    const total = 987_654_321_09;
    assert.equal(suma(repartir(total, pesos)), total);
  });
});

describe('calcularMora', () => {
  it('mensual: se prorratea por día', () => {
    // 10.000 al 3% mensual, 15 días → 1,5% = 150.
    assert.equal(calcularMora(10_000, 15, 3, PeriodicidadMora.MENSUAL), 150);
  });

  it('diaria: tasa × días', () => {
    assert.equal(calcularMora(10_000, 10, 0.1, PeriodicidadMora.DIARIA), 100);
  });

  it('sin atraso o sin deuda no hay interés', () => {
    assert.equal(calcularMora(10_000, 0, 3, PeriodicidadMora.MENSUAL), 0);
    assert.equal(calcularMora(0, 30, 3, PeriodicidadMora.MENSUAL), 0);
  });
});

describe('calcularBoletas', () => {
  const unidades = [
    { id: 'u1', coeficiente: 40 },
    { id: 'u2', coeficiente: 60 },
  ];

  it('reparte por coeficiente y separa por naturaleza', () => {
    const [u1, u2] = calcularBoletas(
      [
        gasto(1_000),
        gasto(500, NaturalezaGasto.EXTRAORDINARIO, 'g2'),
        gasto(100, NaturalezaGasto.FONDO_RESERVA, 'g3'),
      ],
      unidades,
      PARAMETROS,
    );
    assert.equal(u1.importeOrdinarias, 400);
    assert.equal(u1.importeExtraordinarias, 200);
    assert.equal(u1.fondoReserva, 40);
    assert.equal(u1.total, 640);
    assert.equal(u2.total, 960);
  });

  it('la suma de las boletas es el total de los gastos', () => {
    const boletas = calcularBoletas(
      [gasto(1_000.01), gasto(333.33, NaturalezaGasto.ORDINARIO, 'g2')],
      [
        { id: 'a', coeficiente: 33.3333 },
        { id: 'b', coeficiente: 33.3333 },
        { id: 'c', coeficiente: 33.3334 },
      ],
      PARAMETROS,
    );
    assert.equal(Math.round(suma(boletas.map((b) => b.total)) * 100), 133_334);
  });

  it('partes iguales ignora el coeficiente', () => {
    const boletas = calcularBoletas([gasto(900)], unidades, {
      ...PARAMETROS,
      criterio: CriterioProrrateo.PARTES_IGUALES,
    });
    assert.deepEqual(boletas.map((b) => b.total), [450, 450]);
    assert.deepEqual(boletas.map((b) => b.coeficienteAplicado), [50, 50]);
  });

  it('suma el fondo de reserva como porcentaje de las ordinarias', () => {
    const [u1] = calcularBoletas(
      [gasto(1_000), gasto(1_000, NaturalezaGasto.EXTRAORDINARIO, 'g2')],
      unidades,
      { ...PARAMETROS, porcentajeFondoReserva: 5 },
    );
    // 5% de 400 de ordinarias, no de las extraordinarias.
    assert.equal(u1.fondoReserva, 20);
    assert.equal(u1.total, 400 + 400 + 20);
    assert.ok(u1.detalle.some((l) => l.concepto === 'Fondo de reserva (5%)' && l.monto === 20));
  });

  it('arrastra la deuda con su mora', () => {
    const [u1, u2] = calcularBoletas(
      [gasto(1_000)],
      unidades,
      { ...PARAMETROS, tasaInteresMora: 3 },
      new Map([['u1', { saldo: 1_000, diasAtraso: 30 }]]),
    );
    assert.equal(u1.saldoAnterior, 1_000);
    assert.equal(u1.interesesMora, 30);
    assert.equal(u1.total, 400 + 1_000 + 30);
    assert.equal(u2.saldoAnterior, 0);
  });

  it('aplica el ajuste manual y lo deja en el detalle', () => {
    const [u1] = calcularBoletas(
      [gasto(1_000)],
      unidades,
      PARAMETROS,
      new Map(),
      new Map([['u1', { monto: -50, motivo: 'Bonificación por obra' }]]),
    );
    assert.equal(u1.ajusteManual, -50);
    assert.equal(u1.motivoAjuste, 'Bonificación por obra');
    assert.equal(u1.total, 350);
    assert.ok(u1.detalle.some((l) => l.concepto === 'Ajuste: Bonificación por obra'));
  });

  it('una línea por gasto, con su id', () => {
    const [u1] = calcularBoletas([gasto(100), gasto(200, NaturalezaGasto.ORDINARIO, 'g2')], unidades, PARAMETROS);
    assert.deepEqual(
      u1.detalle.map((l) => [l.gastoId, l.monto]),
      [
        ['g1', 40],
        ['g2', 80],
      ],
    );
  });
});
