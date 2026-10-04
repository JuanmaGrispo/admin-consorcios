import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { despachar, MAX_INTENTOS } from './despacho';
import { crearSobre } from './eventos';

const mensaje = Buffer.from(
  JSON.stringify(crearSobre('novedad.publicada', 'c1', { novedad_id: 'n1', titulo: 'Corte de agua' })),
);

describe('despachar', () => {
  it('confirma lo que se procesó bien', async () => {
    let recibido = '';
    const decision = await despachar(mensaje, 0, async (e) => void (recibido = e.tipo_evento));
    assert.equal(decision, 'ok');
    assert.equal(recibido, 'novedad.publicada');
  });

  it('reintenta lo que falló mientras queden intentos', async () => {
    const falla = async () => {
      throw new Error('SMTP caído');
    };
    assert.equal(await despachar(mensaje, 0, falla), 'reintentar');
    assert.equal(await despachar(mensaje, MAX_INTENTOS - 1, falla), 'reintentar');
    assert.equal(await despachar(mensaje, MAX_INTENTOS, falla), 'descartar');
  });

  it('un mensaje roto va directo a la DLQ, sin llegar al handler', async () => {
    let llamado = false;
    const manejar = async () => void (llamado = true);
    assert.equal(await despachar(Buffer.from('no es json'), 0, manejar), 'descartar');
    assert.equal(await despachar(Buffer.from('{"tipo_evento":"x"}'), 0, manejar), 'descartar');
    assert.equal(llamado, false);
  });
});
