import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NumberConversionError, type NumberConversionClient } from './number-conversion.client';
import { NumerosEnLetrasService } from './numeros-en-letras.service';

/** Un cliente que contesta lo que se le diga y cuenta las llamadas. */
function clienteQue(responder: (n: number) => Promise<string>) {
  const llamadas: number[] = [];
  const client = {
    numeroEnPalabras: (n: number) => {
      llamadas.push(n);
      return responder(n);
    },
  } as unknown as NumberConversionClient;
  return { client, llamadas };
}

const SON = 'SON PESOS CIENTO CUARENTA Y CINCO MIL TRESCIENTOS VEINTE CON 50/100';

describe('NumerosEnLetrasService', () => {
  it('usa la respuesta del servicio, traducida al español', async () => {
    const { client, llamadas } = clienteQue(async () => 'one hundred and forty five thousand three hundred and twenty');
    assert.equal(await new NumerosEnLetrasService(client).importe(145_320.5), SON);
    // Al servicio se le pregunta por el entero: los centavos van como fracción.
    assert.deepEqual(llamadas, [145_320]);
  });

  it('si el servicio no responde, escribe localmente', async () => {
    const { client } = clienteQue(async () => {
      throw new NumberConversionError('No respondió');
    });
    assert.equal(await new NumerosEnLetrasService(client).importe(145_320.5), SON);
  });

  it('si el servicio contesta otro número, escribe localmente', async () => {
    const { client } = clienteQue(async () => 'one thousand');
    assert.equal(await new NumerosEnLetrasService(client).importe(145_320.5), SON);
  });

  it('recuerda lo que ya verificó y no vuelve a llamar', async () => {
    const { client, llamadas } = clienteQue(async () => 'twenty');
    const service = new NumerosEnLetrasService(client);
    await service.importe(20);
    assert.equal(await service.importe(20.75), 'SON PESOS VEINTE CON 75/100');
    assert.equal(llamadas.length, 1);
  });

  it('una caída no queda recordada: la próxima vez vuelve a preguntar', async () => {
    let caido = true;
    const { client, llamadas } = clienteQue(async () => {
      if (caido) throw new NumberConversionError('No respondió');
      return 'twenty';
    });
    const service = new NumerosEnLetrasService(client);
    await service.importe(20);
    caido = false;
    await service.importe(20);
    assert.equal(llamadas.length, 2);
  });
});
