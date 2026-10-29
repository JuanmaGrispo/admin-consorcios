import { HttpStatus } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EstadoLiquidacion } from '../../database/entities';
import { estadoDe, TransicionInvalida } from './estado-liquidacion';

const { BORRADOR, PRORRATEO, PREVISUALIZACION, EMITIDA, CERRADA } = EstadoLiquidacion;

/** Toda transición inválida es un 409, con un mensaje que explica por qué. */
function invalida(fn: () => unknown, mensaje: RegExp) {
  assert.throws(fn, (e: unknown) => {
    assert.ok(e instanceof TransicionInvalida);
    assert.equal(e.getStatus(), HttpStatus.CONFLICT);
    assert.match(e.message, mensaje);
    return true;
  });
}

describe('estado de la liquidación', () => {
  describe('transiciones válidas', () => {
    it('borrador: se previsualiza', () => {
      assert.equal(estadoDe(BORRADOR).previsualizar(), PREVISUALIZACION);
    });

    it('previsualización: se vuelve a previsualizar y se emite', () => {
      assert.equal(estadoDe(PREVISUALIZACION).previsualizar(), PREVISUALIZACION);
      assert.equal(estadoDe(PREVISUALIZACION).emitir(), EMITIDA);
    });

    it('previsualización sin gastos vuelve a borrador', () => {
      assert.equal(estadoDe(PREVISUALIZACION).sinGastos(), BORRADOR);
      assert.equal(estadoDe(BORRADOR).sinGastos(), BORRADOR);
    });

    it('emitida: se cierra', () => {
      assert.equal(estadoDe(EMITIDA).cerrar(), CERRADA);
    });

    it('sólo borrador y previsualización admiten cambios', () => {
      estadoDe(BORRADOR).exigirEditable();
      estadoDe(PREVISUALIZACION).exigirEditable();
      estadoDe(PREVISUALIZACION).exigirAjustable();
    });
  });

  describe('transiciones inválidas: 409', () => {
    it('no se emite sin previsualizar', () => {
      invalida(() => estadoDe(BORRADOR).emitir(), /Previsualizá/);
    });

    it('no se emite dos veces', () => {
      invalida(() => estadoDe(EMITIDA).emitir(), /ya está EMITIDA/);
      invalida(() => estadoDe(CERRADA).emitir(), /ya está CERRADA/);
    });

    it('sólo se cierra una emitida', () => {
      for (const estado of [BORRADOR, PREVISUALIZACION, CERRADA]) {
        invalida(() => estadoDe(estado).cerrar(), /Sólo se cierra/);
      }
    });

    it('una emitida o cerrada no se edita ni se previsualiza', () => {
      for (const estado of [EMITIDA, CERRADA]) {
        invalida(() => estadoDe(estado).exigirEditable(), /ya son deuda/);
        invalida(() => estadoDe(estado).previsualizar(), /ya son deuda/);
      }
    });

    it('sólo se ajustan boletas en previsualización', () => {
      for (const estado of [BORRADOR, EMITIDA, CERRADA]) {
        invalida(() => estadoDe(estado).exigirAjustable(), /previsualización/);
      }
    });

    it('PRORRATEO no lo usa ningún flujo: no admite nada', () => {
      invalida(() => estadoDe(PRORRATEO).previsualizar(), /ya son deuda/);
      invalida(() => estadoDe(PRORRATEO).emitir(), /ya está/);
      invalida(() => estadoDe(PRORRATEO).cerrar(), /Sólo se cierra/);
    });
  });

  it('sólo las emitidas y cerradas cuentan como deuda', () => {
    const deuda = Object.values(EstadoLiquidacion).filter((e) => estadoDe(e).esDeuda);
    assert.deepEqual(deuda, [EMITIDA, CERRADA]);
  });

  it('sólo la previsualización se recalcula al cambiar un gasto', () => {
    const recalcula = Object.values(EstadoLiquidacion).filter((e) => estadoDe(e).recalculaAlCambiar);
    assert.deepEqual(recalcula, [PREVISUALIZACION]);
  });
});
