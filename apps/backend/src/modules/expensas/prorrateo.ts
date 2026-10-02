import { CriterioProrrateo, NaturalezaGasto, PeriodicidadMora } from '../../database/entities';

/**
 * El cálculo de las boletas de una liquidación, sin base ni Nest: entra lo que
 * hay que repartir y sale cuánto paga cada unidad. Vive aparte del service
 * para poder testearlo con números a mano.
 *
 * Todo se hace en centavos enteros. Con decimales de JS, repartir $1.000 en
 * tres partes da 333,33 × 3 = 999,99 y un centavo se pierde; acá los centavos
 * que sobran del redondeo se asignan uno por uno, así que la suma de las
 * boletas es exactamente el total de los gastos.
 */

export interface GastoAProrratear {
  id: string;
  descripcion: string;
  monto: number;
  naturaleza: NaturalezaGasto;
}

export interface UnidadAProrratear {
  id: string;
  coeficiente: number;
}

/** Lo que la unidad quedó debiendo de la boleta anterior. */
export interface DeudaUnidad {
  saldo: number;
  /** Días entre el vencimiento de esa boleta y la fecha del cálculo. */
  diasAtraso: number;
}

export interface AjusteUnidad {
  monto: number;
  motivo: string | null;
}

export interface ParametrosProrrateo {
  criterio: CriterioProrrateo;
  porcentajeFondoReserva: number;
  tasaInteresMora: number;
  periodicidadMora: PeriodicidadMora;
}

export interface LineaDetalle {
  gastoId: string | null;
  concepto: string;
  monto: number;
}

export interface BoletaCalculada {
  unidadId: string;
  coeficienteAplicado: number;
  importeOrdinarias: number;
  importeExtraordinarias: number;
  fondoReserva: number;
  saldoAnterior: number;
  interesesMora: number;
  ajusteManual: number;
  motivoAjuste: string | null;
  total: number;
  detalle: LineaDetalle[];
}

/** `concepto` es varchar(120) en `boleta_detalle`. */
const LARGO_CONCEPTO = 120;

export const aCentavos = (pesos: number) => Math.round(pesos * 100);
export const aPesos = (centavos: number) => centavos / 100;
const concepto = (texto: string) => texto.slice(0, LARGO_CONCEPTO);

/** Prefijo de la línea de ajuste: el repositorio la busca por él para reemplazarla. */
export const PREFIJO_AJUSTE = 'Ajuste: ';
export const conceptoAjuste = (motivo: string | null) =>
  concepto(`${PREFIJO_AJUSTE}${motivo ?? 'sin motivo'}`);

/**
 * Reparte `centavos` en proporción a `pesos`, por el método del resto mayor:
 * cada uno recibe la parte entera de lo que le toca y los centavos que faltan
 * van a los de mayor resto (a igual resto, al primero). La suma del resultado
 * es siempre exactamente `centavos`.
 *
 * Los pesos se pasan a enteros (diezmilésimos, la precisión del coeficiente) y
 * la cuenta se hace con BigInt: monto × peso puede pasar 2^53.
 */
export function repartir(centavos: number, pesos: number[]): number[] {
  const enteros = pesos.map((p) => BigInt(Math.round(p * 10_000)));
  const suma = enteros.reduce((a, b) => a + b, 0n);
  if (suma === 0n) throw new Error('No hay entre quiénes repartir');

  const total = BigInt(centavos);
  const partes = enteros.map((p) => (total * p) / suma);
  const restos = enteros.map((p, i) => ({ i, resto: (total * p) % suma }));

  let faltan = Number(total - partes.reduce((a, b) => a + b, 0n));
  restos.sort((a, b) => (a.resto === b.resto ? a.i - b.i : a.resto > b.resto ? -1 : 1));
  for (const { i } of restos) {
    if (faltan === 0) break;
    partes[i] += 1n;
    faltan--;
  }
  return partes.map(Number);
}

/**
 * Interés simple sobre la deuda. La tasa del consorcio es mensual o diaria
 * según `periodicidadMora`; la mensual se prorratea por día (30 días = 1 mes)
 * para que una semana de atraso no cobre un mes entero.
 */
export function calcularMora(
  saldo: number,
  diasAtraso: number,
  tasa: number,
  periodicidad: PeriodicidadMora,
): number {
  if (saldo <= 0 || diasAtraso <= 0 || tasa <= 0) return 0;
  const periodos = periodicidad === PeriodicidadMora.DIARIA ? diasAtraso : diasAtraso / 30;
  return aPesos(Math.round(aCentavos(saldo) * (tasa / 100) * periodos));
}

export function calcularBoletas(
  gastos: GastoAProrratear[],
  unidades: UnidadAProrratear[],
  parametros: ParametrosProrrateo,
  deudas: Map<string, DeudaUnidad> = new Map(),
  ajustes: Map<string, AjusteUnidad> = new Map(),
): BoletaCalculada[] {
  const porPartesIguales = parametros.criterio === CriterioProrrateo.PARTES_IGUALES;
  const pesos = unidades.map((u) => (porPartesIguales ? 1 : u.coeficiente));
  const coeficienteIgual = Number((100 / unidades.length).toFixed(4));

  // Por unidad: centavos acumulados por naturaleza y las líneas de detalle.
  const acumulado = unidades.map(() => ({
    [NaturalezaGasto.ORDINARIO]: 0,
    [NaturalezaGasto.EXTRAORDINARIO]: 0,
    [NaturalezaGasto.FONDO_RESERVA]: 0,
    detalle: [] as LineaDetalle[],
  }));

  for (const gasto of gastos) {
    const partes = repartir(aCentavos(gasto.monto), pesos);
    partes.forEach((centavos, i) => {
      acumulado[i][gasto.naturaleza] += centavos;
      acumulado[i].detalle.push({
        gastoId: gasto.id,
        concepto: concepto(gasto.descripcion),
        monto: aPesos(centavos),
      });
    });
  }

  return unidades.map((unidad, i) => {
    const a = acumulado[i];
    const detalle = a.detalle;

    // El fondo de reserva es un porcentaje de las ordinarias de la unidad,
    // más lo que se haya cargado como gasto de naturaleza FONDO_RESERVA.
    const fondoPorcentaje = Math.round(
      (a[NaturalezaGasto.ORDINARIO] * parametros.porcentajeFondoReserva) / 100,
    );
    if (fondoPorcentaje > 0) {
      detalle.push({
        gastoId: null,
        concepto: `Fondo de reserva (${parametros.porcentajeFondoReserva}%)`,
        monto: aPesos(fondoPorcentaje),
      });
    }

    const deuda = deudas.get(unidad.id);
    const saldo = deuda && deuda.saldo > 0 ? aCentavos(deuda.saldo) : 0;
    const mora = deuda
      ? aCentavos(
          calcularMora(
            deuda.saldo,
            deuda.diasAtraso,
            parametros.tasaInteresMora,
            parametros.periodicidadMora,
          ),
        )
      : 0;
    if (saldo > 0) {
      detalle.push({ gastoId: null, concepto: 'Saldo anterior impago', monto: aPesos(saldo) });
    }
    if (mora > 0) {
      detalle.push({ gastoId: null, concepto: 'Intereses por mora', monto: aPesos(mora) });
    }

    const ajuste = ajustes.get(unidad.id);
    const ajusteCentavos = ajuste ? aCentavos(ajuste.monto) : 0;
    if (ajusteCentavos !== 0) {
      detalle.push({
        gastoId: null,
        concepto: conceptoAjuste(ajuste?.motivo ?? null),
        monto: aPesos(ajusteCentavos),
      });
    }

    const fondo = a[NaturalezaGasto.FONDO_RESERVA] + fondoPorcentaje;
    const total =
      a[NaturalezaGasto.ORDINARIO] +
      a[NaturalezaGasto.EXTRAORDINARIO] +
      fondo +
      saldo +
      mora +
      ajusteCentavos;

    return {
      unidadId: unidad.id,
      coeficienteAplicado: porPartesIguales ? coeficienteIgual : unidad.coeficiente,
      importeOrdinarias: aPesos(a[NaturalezaGasto.ORDINARIO]),
      importeExtraordinarias: aPesos(a[NaturalezaGasto.EXTRAORDINARIO]),
      fondoReserva: aPesos(fondo),
      saldoAnterior: aPesos(saldo),
      interesesMora: aPesos(mora),
      ajusteManual: aPesos(ajusteCentavos),
      motivoAjuste: ajusteCentavos !== 0 ? (ajuste?.motivo ?? null) : null,
      total: aPesos(total),
      detalle,
    };
  });
}
