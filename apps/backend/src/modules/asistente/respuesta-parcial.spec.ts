import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { respuestaParcial } from './respuesta-parcial';

describe('respuestaParcial', () => {
  it('todavía no empezó la respuesta', () => {
    assert.equal(respuestaParcial(''), null);
    assert.equal(respuestaParcial('{"respu'), null);
  });

  it('devuelve lo que llegó hasta ahora', () => {
    assert.equal(respuestaParcial('{"respuesta":"Andá a **Exp'), 'Andá a **Exp');
  });

  it('termina en la comilla de cierre y no lee lo que sigue', () => {
    assert.equal(respuestaParcial('{"respuesta":"Listo.","fuentes":[{"seccion":"X"'), 'Listo.');
  });

  it('decodifica los escapes de JSON', () => {
    const completo = JSON.stringify({ respuesta: 'Paso 1:\n"Pagar" \\ ñ á' });
    assert.equal(respuestaParcial(completo), 'Paso 1:\n"Pagar" \\ ñ á');
  });

  it('un escape cortado a la mitad espera a la próxima vuelta', () => {
    assert.equal(respuestaParcial('{"respuesta":"Hola\\'), 'Hola');
    assert.equal(respuestaParcial('{"respuesta":"Hola \\u00'), 'Hola ');
  });

  it('con cada pedazo nuevo el texto sólo crece', () => {
    const completo = JSON.stringify({ respuesta: 'Andá a "Expensas"\ny tocá Pagar.', fuentes: [] });
    let anterior = '';
    for (let n = 1; n <= completo.length; n++) {
      const parcial = respuestaParcial(completo.slice(0, n)) ?? '';
      assert.ok(parcial.startsWith(anterior), `${n}: "${parcial}" no sigue a "${anterior}"`);
      anterior = parcial;
    }
    assert.equal(anterior, 'Andá a "Expensas"\ny tocá Pagar.');
  });
});
