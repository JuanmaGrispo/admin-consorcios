require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { HttpException } = require('@nestjs/common');
const { FiltroExcepciones } = require('../src/core/http/filtro-excepciones');

test('C8: contrato del filtro para todos los códigos de error exigidos', async (t) => {
  for (const status of [400, 401, 403, 404, 409, 412, 422, 429, 500, 502, 503, 504]) {
    await t.test(String(status), () => {
      const cabeceras = {};
      let cuerpo;
      let codigo;
      const res = {
        setHeader: (nombre, valor) => { cabeceras[nombre.toLowerCase()] = valor; },
        type: (valor) => { cabeceras['content-type'] = valor; return res; },
        status: (valor) => { codigo = valor; return res; },
        json: (valor) => { cuerpo = valor; return res; },
      };
      const req = { method: 'GET', originalUrl: '/api/prueba', path: '/api/prueba', ip: '127.0.0.1' };
      const excepcion = status === 500 ? new Error('detalle interno reservado') : new HttpException('Error controlado', status);
      new FiltroExcepciones().catch(excepcion, {
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      });
      assert.equal(codigo, status);
      assert.match(cabeceras['content-type'] ?? '', /^application\/problem\+json/);
      assert.equal(cuerpo.status, status);
      for (const campo of ['type', 'title', 'instance']) assert.ok(typeof cuerpo[campo] === 'string' && cuerpo[campo].length);
      assert.equal(cuerpo.instance, req.originalUrl);
      assert.equal(cuerpo.stack, undefined);
      assert.ok(!JSON.stringify(cuerpo).includes('detalle interno reservado'));
    });
  }
});
