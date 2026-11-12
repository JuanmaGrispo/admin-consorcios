import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ABIERTO_MS, Disyuntor, FALLAS_PARA_ABRIR, VENTANA_LLAMADAS } from './disyuntor';

describe('Disyuntor', () => {
  it(`se abre con ${FALLAS_PARA_ABRIR} fallas y se cierra a los 5 minutos`, () => {
    let ahora = 0;
    const d = new Disyuntor(() => ahora);
    for (let i = 0; i < FALLAS_PARA_ABRIR - 1; i++) d.registrar(false);
    assert.equal(d.abierto, false);
    d.registrar(false);
    assert.equal(d.abierto, true);
    ahora += ABIERTO_MS - 1;
    assert.equal(d.abierto, true);
    ahora += 1;
    assert.equal(d.abierto, false);
  });

  it(`sólo cuentan las fallas de las últimas ${VENTANA_LLAMADAS} llamadas`, () => {
    const d = new Disyuntor(() => 0);
    for (let i = 0; i < FALLAS_PARA_ABRIR - 1; i++) d.registrar(false);
    for (let i = 0; i < VENTANA_LLAMADAS; i++) d.registrar(true);
    d.registrar(false);
    assert.equal(d.abierto, false);
  });
});
