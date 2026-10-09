import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estadoDeCobranza,
  hoyEn,
  morosidad,
  pendiente,
  periodosHasta,
  porcentajeCobrado,
  sumar,
} from './indicadores';

describe('indicadores del panel', () => {
  it('la morosidad es lo vencido sobre lo emitido', () => {
    assert.equal(morosidad(1_414_250, 8_412_560), 16.8);
    assert.equal(morosidad(0, 0), 0);
  });

  it('el porcentaje cobrado', () => {
    assert.equal(porcentajeCobrado(33_612_940, 38_947_180), 86.3);
  });

  it('el estado del consorcio según su morosidad', () => {
    assert.equal(estadoDeCobranza(false, 0), 'SIN_EMITIR');
    assert.equal(estadoDeCobranza(true, 3.1), 'AL_DIA');
    assert.equal(estadoDeCobranza(true, 10), 'ATENCION');
    assert.equal(estadoDeCobranza(true, 24.7), 'MOROSIDAD_ALTA');
  });

  it('suma en centavos', () => {
    const total = sumar([
      { emitido: 0.1, cobrado: 0.1, vencido: 0, unidadesVencidas: 0 },
      { emitido: 0.2, cobrado: 0, vencido: 0.2, unidadesVencidas: 1 },
    ]);
    assert.deepEqual(total, { emitido: 0.3, cobrado: 0.1, vencido: 0.2, unidadesVencidas: 1 });
    assert.equal(pendiente(total), 0.2);
  });

  it('lo pendiente no es negativo aunque se haya cobrado de más', () => {
    assert.equal(pendiente({ emitido: 100, cobrado: 150, vencido: 0, unidadesVencidas: 0 }), 0);
  });

  it('los seis períodos que terminan en uno, cruzando el año', () => {
    assert.deepEqual(periodosHasta('2026-08', 6), [
      '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
    assert.deepEqual(periodosHasta('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
  });

  it('hoy en la zona del edificio y no en UTC', () => {
    // 02:00 UTC del 5 son las 23:00 del 4 en Buenos Aires.
    assert.equal(hoyEn('America/Argentina/Buenos_Aires', new Date('2026-09-05T02:00:00Z')), '2026-09-04');
  });
});
