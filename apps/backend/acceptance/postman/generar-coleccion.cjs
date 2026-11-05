// Genera domus.postman_collection.json a partir de casos.cjs.
// Uso: node acceptance/postman/generar-coleccion.cjs
// La colección generada se versiona; casos.cjs es la fuente que se edita.
const fs = require('node:fs');
const path = require('node:path');
const { carpetas } = require('./casos.cjs');

const TOKENS = { super: 'tokenSuper', admin: 'tokenAdmin', vecino: 'tokenVecino', ajeno: 'tokenAjeno', nuevo: 'tokenNuevo' };

// Fechas relativas al día de la corrida, para que la colección no venza.
const preparar = `
const hoy = new Date();
const dia = (n) => { const d = new Date(hoy); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mes = (n) => { const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + n, 1)); return d.toISOString().slice(0, 7); };
if (!pm.collectionVariables.get('run')) {
  pm.collectionVariables.set('run', Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  pm.collectionVariables.set('fechaReserva', dia(3));
  pm.collectionVariables.set('fechaBloqueo', dia(5));
  pm.collectionVariables.set('desdeCalendario', dia(0));
  pm.collectionVariables.set('hastaCalendario', dia(30));
  pm.collectionVariables.set('fechaAsamblea', dia(7) + 'T19:00:00.000Z');
  pm.collectionVariables.set('fechaAsambleaPasada', dia(-1) + 'T19:00:00.000Z');
  pm.collectionVariables.set('aperturaVotacion', new Date(Date.now() - 60000).toISOString());
  pm.collectionVariables.set('cierreVotacion', dia(10) + 'T23:00:00.000Z');
  pm.collectionVariables.set('periodo1', mes(1));
  pm.collectionVariables.set('periodo2', mes(2));
  pm.collectionVariables.set('uuidInexistente', '00000000-0000-4000-8000-000000000000');
  if (!pm.variables.get('mpPagoId')) pm.collectionVariables.set('mpPagoId', '9000001');
}`.trim();

function item(c) {
  const [rutaBase, query] = c.url.split('?');
  const segmentos = rutaBase.split('/').filter(Boolean);
  const url = {
    raw: '{{baseUrl}}' + c.url,
    host: ['{{baseUrl}}'],
    path: segmentos,
    ...(query ? { query: query.split('&').map((p) => { const [key, ...v] = p.split('='); return { key, value: v.join('=') }; }) } : {}),
  };
  const header = [];
  if (c.rol) header.push({ key: 'Authorization', value: `Bearer {{${TOKENS[c.rol]}}}` });
  for (const [key, value] of Object.entries(c.headers || {})) header.push({ key, value });
  let body;
  if (c.archivo) {
    body = { mode: 'formdata', formdata: [{ key: 'archivo', type: 'file', src: c.archivo }] };
  } else if (c.body !== undefined) {
    header.push({ key: 'Content-Type', value: 'application/json' });
    body = { mode: 'raw', raw: JSON.stringify(c.body, null, 2), options: { raw: { language: 'json' } } };
  }
  const esperados = [].concat(c.espera);
  const test = [
    `pm.test('${c.tipo === 'error' ? 'Error' : 'Éxito'}: responde ${esperados.join(' o ')}', () => pm.expect(pm.response.code).to.be.oneOf(${JSON.stringify(esperados)}));`,
  ];
  if (c.tipo === 'error' && esperados.every((s) => s >= 400)) {
    test.push(`pm.test('Error en formato Problem Details', () => pm.expect(pm.response.headers.get('Content-Type') || '').to.include('application/problem+json'));`);
  }
  if (c.guardar) test.push(`if (pm.response.code < 300) { const j = pm.response.headers.get('Content-Type')?.includes('json') ? pm.response.json() : {}; ${c.guardar} }`);
  const event = [{ listen: 'test', script: { type: 'text/javascript', exec: test } }];
  if (c.pre) event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: [c.pre] } });
  return {
    name: `${c.tipo === 'error' ? '[error]' : '[éxito]'} ${c.nombre}`,
    request: { method: c.m, header, url, ...(body ? { body } : {}), description: c.descripcion || '' },
    event,
  };
}

const coleccion = {
  info: {
    name: 'Domus API',
    description: 'Un caso de éxito y al menos uno de error por endpoint de la API de Domus. Generada por acceptance/postman/generar-coleccion.cjs desde casos.cjs; corre con Newman en la corrida integral (pnpm back test:aceptacion:integral --newman). Variables de entrada: baseUrl, password, vecinoEmail, adminId, vecinoId, consorcioId, unidadId, unidad2Id, categoriaId, boletaId, boleta2Id, notificacionId y mpSecret (mpPagoId es opcional).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  // Sin cookies: cada pedido usa sólo su token. Si no, la cookie httpOnly del último
  // ingreso se mezcla con el Bearer y los casos "sin sesión" dejan de serlo.
  protocolProfileBehavior: { disableCookies: true },
  event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: preparar.split('\n') } }],
  variable: [],
  item: carpetas.map((f) => ({ name: f.nombre, item: f.casos.map(item) })),
};

const destino = path.join(__dirname, 'domus.postman_collection.json');
fs.writeFileSync(destino, JSON.stringify(coleccion, null, 2) + '\n');
const casos = carpetas.flatMap((f) => f.casos);
const porEndpoint = new Map();
for (const c of casos) {
  const e = porEndpoint.get(c.ep) || { exito: 0, error: 0 };
  e[c.tipo === 'error' ? 'error' : 'exito']++;
  porEndpoint.set(c.ep, e);
}
const incompletos = [...porEndpoint].filter(([, e]) => !e.exito || !e.error).map(([ep]) => ep);
console.log(`${casos.length} casos (${casos.filter((c) => c.tipo === 'error').length} de error) para ${porEndpoint.size} endpoints -> ${path.relative(process.cwd(), destino)}`);
if (incompletos.length) {
  console.error('Endpoints sin éxito o sin error: ' + incompletos.join(', '));
  process.exitCode = 1;
}
if (process.argv.includes('--endpoints')) console.log([...porEndpoint.keys()].sort().join('\n'));
