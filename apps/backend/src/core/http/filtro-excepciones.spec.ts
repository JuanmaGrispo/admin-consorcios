import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createRequire } from 'node:module';
import type * as Tipos from 'express';
import { FiltroExcepciones, limpiarParaLog } from './filtro-excepciones';

// express no es dependencia directa: se usa el de platform-express.
const express = createRequire(require.resolve('@nestjs/platform-express'))('express') as () => Tipos.Express;

/** Una app Express real con el filtro enchufado como lo hace Nest. */
async function pedir(metodo: string, ruta: string, falla: () => never) {
  const app = express();
  const filtro = new FiltroExcepciones();
  app.get('/cosas', () => falla());
  app.post('/cosas', () => falla());
  app.use((req: Tipos.Request, res: Tipos.Response) =>
    filtro.catch(new NotFoundException(`Cannot ${req.method} ${req.path}`), {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as never),
  );
  const servidor = createServer(app);
  await new Promise<void>((r) => servidor.listen(0, r));
  const { port } = servidor.address() as { port: number };
  try {
    const r = await fetch(`http://127.0.0.1:${port}${ruta}`, { method: metodo });
    return { status: r.status, allow: r.headers.get('allow') };
  } finally {
    servidor.close();
  }
}

describe('FiltroExcepciones', () => {
  it('un método no previsto en una ruta que existe es 405 con Allow', async () => {
    const r = await pedir('DELETE', '/cosas', () => { throw new Error('x'); });
    assert.equal(r.status, 405);
    assert.match(r.allow ?? '', /GET/);
    assert.match(r.allow ?? '', /POST/);
  });

  it('una ruta que no existe sigue siendo 404', async () => {
    const r = await pedir('GET', '/nada', () => { throw new Error('x'); });
    assert.equal(r.status, 404);
  });

  it('un error no controlado es 500 genérico con id y sin detalle', () => {
    let cuerpo: Record<string, unknown> = {};
    const res = { status: () => ({ json: (c: Record<string, unknown>) => (cuerpo = c) }) };
    const req = { method: 'GET', originalUrl: '/x', ip: '1.1.1.1' };
    new FiltroExcepciones().catch(new Error('select * from secreto'), {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as never);
    assert.equal(cuerpo.statusCode, 500);
    assert.ok(typeof cuerpo.id === 'string');
    assert.doesNotMatch(JSON.stringify(cuerpo), /secreto/);
  });

  it('un 403 conserva su respuesta', () => {
    let status = 0;
    const res = { status: (s: number) => { status = s; return { json: () => undefined }; } };
    const req = { method: 'GET', originalUrl: '/x', ip: '1.1.1.1', path: '/x' };
    new FiltroExcepciones().catch(new ForbiddenException('no'), {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as never);
    assert.equal(status, 403);
  });

  it('limpiarParaLog saca los saltos de línea', () => {
    assert.equal(limpiarParaLog('a@b.com\r\nFALSO'), 'a@b.com FALSO');
  });
});
