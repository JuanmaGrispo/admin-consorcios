import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EstadoAsistencia } from '../../database/entities';
import { calcularQuorum, porcentajeDeQuorum } from './quorum';

const { ASISTE, NO_ASISTE, SIN_RESPONDER, CON_PODER } = EstadoAsistencia;
const a = (estado: EstadoAsistencia, coeficienteAplicado: number) => ({ estado, coeficienteAplicado });

describe('calcularQuorum', () => {
  it('sin asistencias da 0% y no alcanza', () => {
    const q = calcularQuorum([], 60);
    assert.equal(q.porcentaje, 0);
    assert.equal(q.alcanzado, false);
    assert.equal(q.faltanPuntos, 60);
    assert.equal(q.faltanUnidades, null);
  });

  it('suma ASISTE y CON_PODER; NO_ASISTE y SIN_RESPONDER no suman', () => {
    const q = calcularQuorum(
      [a(ASISTE, 30), a(CON_PODER, 20), a(NO_ASISTE, 25), a(SIN_RESPONDER, 25)],
      60,
    );
    assert.equal(q.porcentaje, 50);
    assert.equal(q.alcanzado, false);
    assert.equal(q.faltanPuntos, 10);
    assert.deepEqual(q.conteo, { ASISTE: 1, NO_ASISTE: 1, SIN_RESPONDER: 1, CON_PODER: 1 });
  });

  it('alcanza cuando el porcentaje iguala al requerido', () => {
    const q = calcularQuorum([a(ASISTE, 60), a(NO_ASISTE, 40)], 60);
    assert.equal(q.alcanzado, true);
    assert.equal(q.faltanPuntos, 0);
    assert.equal(q.faltanUnidades, 0);
  });

  it('redondea a dos decimales', () => {
    const q = calcularQuorum([a(ASISTE, 1), a(SIN_RESPONDER, 1), a(SIN_RESPONDER, 1)], 50);
    assert.equal(q.porcentaje, 33.33);
  });

  it('faltanUnidades toma primero las sin responder de mayor coeficiente', () => {
    const q = calcularQuorum(
      [a(ASISTE, 40), a(SIN_RESPONDER, 5), a(SIN_RESPONDER, 15), a(SIN_RESPONDER, 10), a(NO_ASISTE, 30)],
      60,
    );
    // 40 + 15 = 55 no alcanza; 40 + 15 + 10 = 65 sí.
    assert.equal(q.faltanUnidades, 2);
  });

  it('faltanUnidades es null si ni con todas las sin responder alcanza', () => {
    const q = calcularQuorum([a(ASISTE, 20), a(SIN_RESPONDER, 10), a(NO_ASISTE, 70)], 60);
    assert.equal(q.faltanUnidades, null);
  });
});

describe('porcentajeDeQuorum', () => {
  it('es 0 si el total es 0', () => {
    assert.equal(porcentajeDeQuorum(0, 0), 0);
  });

  it('redondea a dos decimales', () => {
    assert.equal(porcentajeDeQuorum(2, 3), 66.67);
  });
});
