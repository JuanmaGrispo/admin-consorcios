require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { setTimeout: esperar } = require('node:timers/promises');
const { ConfigService } = require('@nestjs/config');
const { MercadoPagoClient } = require('../src/modules/pagos/mercado-pago.client');
const { ArchivosClient } = require('../src/modules/archivos/archivos.client');

test('C1: proveedores lentos se cancelan en 5 s y comunican indisponibilidad', { timeout: 15_000 }, async (t) => {
  const timers = new Set();
  let canceladas = 0;
  let solicitudes = 0;
  const servidor = createServer((req, res) => {
    solicitudes++;
    res.on('close', () => { if (!res.writableEnded) canceladas++; });
    req.resume();
    const timer = setTimeout(() => {
      timers.delete(timer);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'preferencia-prueba', init_point: 'https://example.test', status: 'approved' }));
    }, 6500);
    timers.add(timer);
  });
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const original = global.fetch;
  // Redirige transporte hacia un proveedor HTTP real; conserva las opciones,
  // incluido el AbortSignal que construye el client de producción.
  global.fetch = (url, opciones) => original(`${base}${new URL(url).pathname}`, opciones);
  const config = new ConfigService({
    MP_ACCESS_TOKEN: 'valor-simulado', SUPABASE_URL: base,
    SUPABASE_SERVICE_ROLE_KEY: 'valor-simulado',
  });
  const mp = new MercadoPagoClient(config);
  const archivos = new ArchivosClient(config);
  const casos = [
    ['consulta de pago', () => mp.obtenerPago('1')],
    ['creación de preferencia', () => mp.crearPreferencia({ titulo: 'Prueba', monto: 1, referencia: 'prueba' })],
    ['subida de archivo', () => archivos.subir('prueba.png', Buffer.from('prueba'), 'image/png')],
    ['borrado de archivo', () => archivos.borrar('prueba.png')],
  ];
  try {
    const resultados = await Promise.all(casos.map(async ([nombre, ejecutar]) => {
      const inicio = performance.now();
      let error;
      try { await ejecutar(); } catch (e) { error = e; }
      return { nombre, error, tiempo: performance.now() - inicio };
    }));
    // Ejecutar cada subtest permite ver todos los incumplimientos en una corrida.
    for (const resultado of resultados) {
      await t.test(resultado.nombre, () => {
        assert.ok(resultado.tiempo <= 5250, `Demoró ${Math.round(resultado.tiempo)} ms; presupuesto 5000 ms (tolerancia de medición 250 ms)`);
        assert.ok(resultado.error, 'El proveedor lento no debe terminar como una operación exitosa');
        assert.equal(resultado.error.getStatus?.(), 503, 'Comunicar indisponibilidad mediante excepción HTTP 503');
      });
    }
    await esperar(50);
    await t.test('cancela las cuatro conexiones sin reintentar escrituras', () => {
      assert.equal(canceladas, 4);
      assert.equal(solicitudes, 4);
    });
  } finally {
    global.fetch = original;
    for (const timer of timers) clearTimeout(timer);
    servidor.closeAllConnections();
    await new Promise((resolve) => servidor.close(resolve));
  }
});
