import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const identidades = new SharedArray('identidades', () => JSON.parse(open(__ENV.CARGA_FIXTURES)));

const endpoints = ['listado_boletas', 'detalle_boleta', 'crear_reclamo'];
export const options = {
  vus: 50,
  duration: '5m',
  thresholds: Object.fromEntries(endpoints.flatMap((endpoint) => [
    [`http_reqs{endpoint:${endpoint}}`, ['count>0']],
    [`http_req_duration{endpoint:${endpoint}}`, ['p(95)<500']],
    [`http_req_failed{endpoint:${endpoint}}`, ['rate<0.01']],
    [`checks{endpoint:${endpoint}}`, ['rate>0.99']],
  ])),
};

export function setup() {
  if (__ENV.ACEPTACION_ESCRITURA !== 'SI') throw new Error('Usar fixtures descartables y ACEPTACION_ESCRITURA=SI');
  if (!/^http:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal|domus-aceptacion-backend):\d+\/api$/.test(__ENV.CARGA_BASE_URL)) throw new Error('Se requiere entorno local');
  if (identidades.length < 50) throw new Error('Se requieren 50 identidades');
  for (let i = 0; i < identidades.length; i++) {
    const persona = identidades[i];
    const headers = { Authorization: `Bearer ${persona.token}`, 'Content-Type': 'application/json' };
    const opciones = { headers, tags: { fase: 'calentamiento' }, timeout: '5s' };
    const listado = http.get(`${__ENV.CARGA_BASE_URL}/boletas`, opciones);
    const detalle = http.get(`${__ENV.CARGA_BASE_URL}/boletas/${persona.boletaId}`, opciones);
    if (listado.status !== 200 || !Array.isArray(listado.json('items')) || detalle.status !== 200 || detalle.json('id') !== persona.boletaId) throw new Error('Fixture de boleta no accesible');
    const clave = `calentamiento-${i}-${Date.now()}`;
    const alta = http.post(`${__ENV.CARGA_BASE_URL}/reclamos`, JSON.stringify({ ...persona.reclamo, titulo: clave }), {
      ...opciones, headers: { ...headers, 'Idempotency-Key': clave },
    });
    if (alta.status !== 201 || alta.json('titulo') !== clave) throw new Error('No se pudo calentar el alta de reclamos');
  }
}

export default function () {
  const persona = identidades[(__VU - 1) % identidades.length];
  const base = __ENV.CARGA_BASE_URL.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${persona.token}`, 'Content-Type': 'application/json' };
  for (const [ruta, endpoint] of [['/boletas', endpoints[0]], [`/boletas/${persona.boletaId}`, endpoints[1]]]) {
    const respuesta = http.get(`${base}${ruta}`, { headers, tags: { endpoint }, timeout: '5s' });
    check(respuesta, { 'lectura correcta': (r) => r.status === 200 && (endpoint === endpoints[0] ? Array.isArray(r.json('items')) : r.json('id') === persona.boletaId) }, { endpoint });
  }
  const clave = `carga-${__VU}-${__ITER}-${Date.now()}`;
  const respuesta = http.post(`${base}/reclamos`, JSON.stringify({ ...persona.reclamo, titulo: clave }), {
    headers: { ...headers, 'Idempotency-Key': clave }, tags: { endpoint: endpoints[2] }, timeout: '5s',
  });
  check(respuesta, { 'reclamo creado': (r) => r.status === 201 && Boolean(r.json('id')) && r.json('titulo') === clave }, { endpoint: endpoints[2] });
  sleep(1);
}
