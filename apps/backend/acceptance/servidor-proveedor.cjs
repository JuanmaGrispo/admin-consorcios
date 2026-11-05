const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');

/** Simulador separado del backend; solo acepta tráfico local y datos ficticios. */
module.exports = async function proveedor() {
  const estado = { modo: 'ok', solicitudes: 0, canceladas: 0, pagos: {}, objetos: {} };
  const timers = new Set();
  const servidor = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/storage/v1/object/public/domus/csp.png') {
      res.setHeader('Content-Type', 'image/png');
      res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1kAAAAASUVORK5CYII=', 'base64'));
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (req.url === '/__control') {
      if (req.method === 'POST') { Object.assign(estado, JSON.parse(Buffer.concat(chunks).toString())); estado.solicitudes = 0; estado.canceladas = 0; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(estado)); return;
    }
    estado.solicitudes++;
    const storage = req.url.startsWith('/storage/v1/object/');
    let status = 200;
    if (storage && estado.modo !== 'rechazo') {
      if (req.method === 'POST') estado.objetos[req.url] = true;
      if (req.method === 'DELETE') { if (!estado.objetos[req.url]) status = 404; delete estado.objetos[req.url]; }
    }
    const contenido = { id: 'pref-' + randomUUID(), init_point: 'http://checkout.example.test', results: [] };
    const id = req.url.split('/').pop();
    const json = JSON.stringify(estado.pagos[id] ?? contenido);
    let timer;
    res.on('close', () => { if (!res.writableEnded) estado.canceladas++; if (timer) { clearTimeout(timer); timers.delete(timer); } });
    if (estado.modo === 'corte') { res.destroy(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (estado.modo === 'rechazo') { res.writeHead(422); res.end('{"error":"rechazo simulado"}'); return; }
    if (estado.modo === 'lento-cuerpo') { res.writeHead(200); res.write(json.slice(0, 1)); }
    if (estado.modo.startsWith('lento-')) {
      timer = setTimeout(() => { timers.delete(timer); res.end(estado.modo === 'lento-cuerpo' ? json.slice(1) : json); }, 6500);
      timers.add(timer);
    } else { res.statusCode = status; res.end(json); }
  });
  await new Promise((r) => servidor.listen(0, '0.0.0.0', r));
  return { url: `http://127.0.0.1:${servidor.address().port}`, estado,
    cerrar: () => new Promise((r) => { for (const t of timers) clearTimeout(t); servidor.closeAllConnections(); servidor.close(r); }) };
};
