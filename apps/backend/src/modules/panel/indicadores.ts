/**
 * Las cuentas del panel del administrador, sin base: funciones puras que se
 * testean con números a mano, igual que el prorrateo.
 */

export type EstadoCobranza = 'AL_DIA' | 'ATENCION' | 'MOROSIDAD_ALTA' | 'SIN_EMITIR';

/** Desde qué morosidad (%) un consorcio pide atención, y desde cuál es alta. */
export const UMBRAL_ATENCION = 10;
export const UMBRAL_MOROSIDAD_ALTA = 20;

export interface Cobranza {
  emitido: number;
  cobrado: number;
  vencido: number;
  unidadesVencidas: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Morosidad: el saldo de las boletas ya vencidas sobre lo emitido. Lo que
 * todavía no venció no es mora, aunque no esté pagado.
 */
export function morosidad(vencido: number, emitido: number): number {
  return emitido > 0 ? r1((vencido / emitido) * 100) : 0;
}

export function porcentajeCobrado(cobrado: number, emitido: number): number {
  return emitido > 0 ? r1((cobrado / emitido) * 100) : 0;
}

export function estadoDeCobranza(emitida: boolean, morosidadPct: number): EstadoCobranza {
  if (!emitida) return 'SIN_EMITIR';
  if (morosidadPct >= UMBRAL_MOROSIDAD_ALTA) return 'MOROSIDAD_ALTA';
  if (morosidadPct >= UMBRAL_ATENCION) return 'ATENCION';
  return 'AL_DIA';
}

/** Suma varias cobranzas, en centavos para no arrastrar error de redondeo. */
export function sumar(filas: Cobranza[]): Cobranza {
  const c = (n: number) => Math.round(n * 100);
  const total = filas.reduce(
    (t, f) => ({
      emitido: t.emitido + c(f.emitido),
      cobrado: t.cobrado + c(f.cobrado),
      vencido: t.vencido + c(f.vencido),
      unidadesVencidas: t.unidadesVencidas + f.unidadesVencidas,
    }),
    { emitido: 0, cobrado: 0, vencido: 0, unidadesVencidas: 0 },
  );
  return {
    emitido: r2(total.emitido / 100),
    cobrado: r2(total.cobrado / 100),
    vencido: r2(total.vencido / 100),
    unidadesVencidas: total.unidadesVencidas,
  };
}

/** Lo que falta cobrar, nunca negativo. */
export function pendiente(c: Cobranza): number {
  return Math.max(0, r2(c.emitido - c.cobrado));
}

/** Los `cantidad` períodos (AAAA-MM) que terminan en `periodo`, del más viejo al más nuevo. */
export function periodosHasta(periodo: string, cantidad: number): string[] {
  const [anio, mes] = periodo.split('-').map(Number);
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(Date.UTC(anio, mes - 1 - (cantidad - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** La fecha de hoy (AAAA-MM-DD) en la zona del edificio. */
export function hoyEn(zona: string, ahora = new Date()): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: zona });
}
