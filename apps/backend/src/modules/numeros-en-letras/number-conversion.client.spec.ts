import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { NumberConversionClient, NumberConversionError } from './number-conversion.client';

const config = { get: () => undefined } as unknown as ConfigService;

/** La respuesta real del servicio, copiada de una llamada. */
const RESPUESTA = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <m:NumberToWordsResponse xmlns:m="http://www.dataaccess.com/webservicesserver/">
      <m:NumberToWordsResult>one hundred and forty five thousand three hundred and twenty </m:NumberToWordsResult>
    </m:NumberToWordsResponse>
  </soap:Body>
</soap:Envelope>`;

describe('NumberConversionClient', () => {
  const fetchOriginal = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it('manda el sobre SOAP y devuelve las palabras', async () => {
    let enviado = '';
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      enviado = String(init.body);
      return new Response(RESPUESTA, { status: 200 });
    }) as typeof fetch;

    const palabras = await new NumberConversionClient(config).numeroEnPalabras(145_320);
    assert.equal(palabras, 'one hundred and forty five thousand three hundred and twenty');
    assert.match(enviado, /<ubiNum>145320<\/ubiNum>/);
  });

  it('un error HTTP es un NumberConversionError', async () => {
    globalThis.fetch = (async () => new Response('<fault/>', { status: 500 })) as typeof fetch;
    await assert.rejects(new NumberConversionClient(config).numeroEnPalabras(1), NumberConversionError);
  });

  it('una caída de red es un NumberConversionError', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await assert.rejects(new NumberConversionClient(config).numeroEnPalabras(1), NumberConversionError);
  });

  it('una respuesta sin resultado es un NumberConversionError', async () => {
    globalThis.fetch = (async () => new Response('<html>mantenimiento</html>', { status: 200 })) as typeof fetch;
    await assert.rejects(new NumberConversionClient(config).numeroEnPalabras(1), NumberConversionError);
  });
});
