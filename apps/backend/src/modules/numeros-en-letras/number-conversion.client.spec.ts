import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { NumberConversionClient, NumberConversionError, NumberConversionFault } from './number-conversion.client';

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

/** Un soap:Fault como los que manda un servicio SOAP 1.1. */
const fault = (codigo: string, texto: string) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<soap:Fault><faultcode>${codigo}</faultcode><faultstring>${texto}</faultstring></soap:Fault>
</soap:Body></soap:Envelope>`;

describe('NumberConversionClient — soap:Fault', () => {
  const fetchOriginal = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });
  const conRespuesta = (cuerpo: string, status: number) => {
    globalThis.fetch = (async () => new Response(cuerpo, { status })) as typeof fetch;
    return new NumberConversionClient(config).numeroEnPalabras(1);
  };

  it('un soap:Client es un Fault de negocio, con su código y su texto', async () => {
    await assert.rejects(conRespuesta(fault('soap:Client', 'Número inválido'), 500), (e: NumberConversionFault) => {
      assert.ok(e instanceof NumberConversionFault);
      assert.equal(e.tipo, 'negocio');
      assert.equal(e.codigo, 'soap:Client');
      assert.equal(e.detalle, 'Número inválido');
      return true;
    });
  });

  it('un soap:Server es un Fault técnico', async () => {
    await assert.rejects(conRespuesta(fault('soap:Server', 'Caído'), 500), (e: NumberConversionFault) => e.tipo === 'tecnico');
  });

  it('un Fault que llega con HTTP 200 también es un Fault', async () => {
    await assert.rejects(conRespuesta(fault('soap:Client', 'x'), 200), NumberConversionFault);
  });
});

/**
 * Contrato con el simulador que levanta `docker compose up`: el cliente real
 * contra docker/simuladores.cjs en cada modo. Si el simulador deja de imitar
 * al servicio, esto falla.
 */
describe('NumberConversionClient contra el simulador SOAP del compose', () => {
  const puerto = 41_000 + Math.floor(Math.random() * 2_000);
  const base = `http://127.0.0.1:${puerto}`;
  const carpeta = mkdtempSync(path.join(tmpdir(), 'domus-sim-'));
  let simulador: ChildProcess;
  const cliente = new NumberConversionClient({
    get: () => `${base}/webservicesserver/NumberConversion.wso`,
  } as unknown as ConfigService);
  const modo = (m: string) => fetch(`${base}/soap/${m}`, { method: 'POST', redirect: 'manual' });

  before(async () => {
    simulador = spawn(process.execPath, [path.resolve(__dirname, '../../../docker/simuladores.cjs')], {
      env: { ...process.env, PUERTO_HTTP: String(puerto), PUERTO_SMTP: String(puerto + 1), CARPETA_STORAGE: carpeta },
      stdio: 'ignore',
    });
    for (let i = 0; i < 100; i++) {
      if (await fetch(`${base}/salud`).then((r) => r.ok, () => false)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('El simulador no levantó');
  });
  after(() => {
    simulador?.kill();
    rmSync(carpeta, { recursive: true, force: true });
  });

  it('responde como el servicio real', async () => {
    await modo('ok');
    assert.equal(await cliente.numeroEnPalabras(145_320), 'one hundred and forty five thousand three hundred and twenty');
  });

  it('Fault de negocio y Fault técnico', async () => {
    await modo('fault-negocio');
    await assert.rejects(cliente.numeroEnPalabras(1), (e: NumberConversionFault) => e.tipo === 'negocio');
    await modo('fault-tecnico');
    await assert.rejects(cliente.numeroEnPalabras(1), (e: NumberConversionFault) => e.tipo === 'tecnico');
  });

  it('caído es un NumberConversionError, sin Fault', async () => {
    await modo('caido');
    await assert.rejects(cliente.numeroEnPalabras(1), (e: Error) => e instanceof NumberConversionError && !(e instanceof NumberConversionFault));
  });

  it('lento corta a los 3 s', async () => {
    await modo('lento');
    const inicio = Date.now();
    await assert.rejects(cliente.numeroEnPalabras(1), NumberConversionError);
    assert.ok(Date.now() - inicio < 4_500, `tardó ${Date.now() - inicio} ms`);
    await modo('ok');
  });
});
