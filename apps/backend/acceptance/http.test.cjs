const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { Client } = require('pg');

// Separada de src/**/*.spec.ts: escribe únicamente sobre fixtures descartables.
function entorno() {
  for (const nombre of ['ACEPTACION_BASE_URL', 'ACEPTACION_TOKEN', 'ACEPTACION_RECLAMO_JSON', 'ACEPTACION_CONSORCIO_ID']) {
    assert.ok(process.env[nombre], `Falta ${nombre}; ver docs/aceptacion-integracion-resiliencia.md`);
  }
  assert.equal(process.env.ACEPTACION_ESCRITURA, 'SI', 'Se requieren fixtures descartables y ACEPTACION_ESCRITURA=SI');
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.ACEPTACION_BASE_URL).hostname), 'La API de aceptación debe ser local');
  return JSON.parse(process.env.ACEPTACION_RECLAMO_JSON);
}

async function pedir(ruta, { autenticado = true, token = process.env.ACEPTACION_TOKEN, ...opciones } = {}) {
  const respuesta = await fetch(`${process.env.ACEPTACION_BASE_URL.replace(/\/$/, '')}${ruta}`, {
    ...opciones,
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/json',
      ...(autenticado ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });
  return { status: respuesta.status, headers: respuesta.headers, body: await respuesta.json() };
}

function problema(respuesta, status) {
  assert.equal(respuesta.status, status);
  assert.match(respuesta.headers.get('content-type') ?? '', /^application\/problem\+json\b/i);
  assert.equal(respuesta.body.status, status);
  for (const campo of ['type', 'title', 'instance']) {
    assert.equal(typeof respuesta.body[campo], 'string', `Falta ${campo}`);
    assert.ok(respuesta.body[campo].length);
  }
  assert.equal(respuesta.body.stack, undefined);
}

test('C8: errores HTTP usan Problem Details', async () => {
  entorno();
  problema(await pedir('/consorcios', { autenticado: false }), 401);
  problema(await pedir('/consorcios/no-es-uuid'), 400);
  problema(await pedir(`/consorcios/${randomUUID()}`), 404);
});

test('sesión: inactividad y rol se consultan nuevamente usando el mismo JWT', async () => {
  entorno();
  const conexion = new URL(process.env.ACEPTACION_DATABASE_URL);
  assert.equal(conexion.hostname,'127.0.0.1'); assert.equal(conexion.pathname,'/domus_aceptacion');
  const db = new Client({ connectionString: conexion.toString() }); await db.connect();
  const id = process.env.ACEPTACION_SUPER_ID;
  const {rows:[anterior]} = await db.query('SELECT rol,activo FROM usuario WHERE id=$1',[id]);
  try {
    await db.query('UPDATE usuario SET activo=false WHERE id=$1',[id]);
    problema(await pedir('/consorcios'),401);
    await db.query("UPDATE usuario SET activo=true,rol='VECINO' WHERE id=$1",[id]);
    problema(await pedir('/consorcios',{method:'POST',body:'{}'}),403);
  } finally {
    await db.query('UPDATE usuario SET rol=$1,activo=$2 WHERE id=$3',[anterior.rol,anterior.activo,id]);
    await db.end();
  }
  assert.equal((await pedir('/consorcios')).status,200);
});

test('C6: espera acotada del bloqueo devuelve Retry-After y permite reintento', async () => {
  const fixture = entorno();
  const conexion = new URL(process.env.ACEPTACION_DATABASE_URL);
  assert.equal(conexion.hostname,'127.0.0.1'); assert.equal(conexion.pathname,'/domus_aceptacion');
  const db = new Client({ connectionString: conexion.toString() }); await db.connect();
  const clave = randomUUID(), titulo='Bloqueo '+clave;
  const crear = () => pedir('/reclamos',{method:'POST',headers:{'Idempotency-Key':clave},body:JSON.stringify({...fixture,titulo})});
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`reclamos:${process.env.ACEPTACION_SUPER_ID}:${clave}`]);
    const inicio=Date.now(), r=await crear();
    problema(r,503); assert.equal(r.headers.get('retry-after'),'3');
    assert.ok(Date.now()-inicio<5500,'La espera debe estar acotada a tres segundos más margen de ejecución');
    assert.equal((await db.query('SELECT id FROM reclamo WHERE titulo=$1',[titulo])).rowCount,0);
  } finally { await db.query('ROLLBACK'); await db.end(); }
  const primero=await crear(), repetido=await crear();
  assert.equal(primero.status,201); assert.deepEqual(repetido.body,primero.body);
});

test('boletas: paginación sin duplicados y detalle completo con importes numéricos', async () => {
  entorno();
  const token = process.env.ACEPTACION_VECINO_TOKEN;
  const [a,b,detalle,vacia] = await Promise.all([
    pedir('/boletas?pagina=1&limite=20', { token }),
    pedir('/boletas?pagina=2&limite=20', { token }),
    pedir('/boletas/' + process.env.ACEPTACION_BOLETA_ID, { token }),
    pedir('/boletas?pagina=4&limite=20', { token }),
  ]);
  assert.equal(a.status,200); assert.equal(b.status,200); assert.equal(detalle.status,200);
  assert.equal(a.body.total,60); assert.equal(a.body.items.length,20); assert.equal(b.body.items.length,20);
  assert.equal(vacia.status,200); assert.equal(vacia.body.total,60); assert.deepEqual(vacia.body.items,[]);
  assert.equal(new Set([...a.body.items,...b.body.items].map((x)=>x.id)).size,40);
  for (const fila of [...a.body.items,...b.body.items]) {
    assert.equal(fila.emitido,100); assert.equal(fila.coeficienteAplicado,0.2);
    assert.equal(fila.unidad.coeficiente,0.2); assert.equal(typeof fila.estado,'string');
    assert.match(fila.periodo,/^\d{4}-\d{2}$/); assert.match(fila.fechaVencimiento,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof fila.interesesMora,'number'); assert.equal(typeof fila.saldo,'number');
  }
  assert.equal(detalle.body.boletaDetalles.length,3);
  assert.equal(detalle.body.boletaDetalles.reduce((s,d)=>s+d.monto,0),100);
});

test('reclamos: la numeración conserva todos los dígitos al superar 9999', async () => {
  const fixture = entorno();
  const conexion = new URL(process.env.ACEPTACION_DATABASE_URL);
  assert.equal(conexion.hostname,'127.0.0.1'); assert.equal(conexion.pathname,'/domus_aceptacion');
  const db = new Client({ connectionString: conexion.toString() }); await db.connect();
  try {
    const { rows:[{numero}] } = await db.query("SELECT setval('reclamo_numero',greatest((SELECT last_value FROM reclamo_numero),9999),true)::text AS numero");
    const r = await pedir('/reclamos', { method:'POST', headers:{'Idempotency-Key':randomUUID()}, body:JSON.stringify({...fixture,titulo:'Numeración '+randomUUID()}) });
    assert.equal(r.status,201); assert.ok(r.body.codigo.endsWith('-'+(Number(numero)+1)));
  } finally { await db.end(); }
});

test('C6: POST repetido y concurrente conserva recurso y respuesta', async () => {
  const fixture = entorno();
  const conexion = new URL(process.env.ACEPTACION_DATABASE_URL ?? 'http://sin-configurar');
  assert.ok(['localhost', '127.0.0.1'].includes(conexion.hostname), 'C6 requiere ACEPTACION_DATABASE_URL local para contar los recursos');
  assert.equal(conexion.pathname, '/domus_aceptacion');
  const clave = process.env.ACEPTACION_REPETIR_CLAVE || randomUUID();
  assert.ok(clave.length <= 60, 'La clave de prueba debe tener hasta 60 caracteres');
  const headers = { 'Idempotency-Key': clave };
  const titulo = `Aceptación ${clave}`;
  const body = JSON.stringify({ ...fixture, titulo });
  const crear = () => pedir('/reclamos', { method: 'POST', headers, body });
  const respuestas = await Promise.all(Array.from({ length: 10 }, crear));
  respuestas.push(await crear());
  const primera = respuestas[0];
  assert.equal(primera.status, 201);
  assert.ok(primera.body.id);
  for (const respuesta of respuestas.slice(1)) {
    assert.equal(respuesta.status, primera.status);
    assert.deepEqual(respuesta.body, primera.body);
  }
  problema(await pedir('/reclamos', {
    method: 'POST', headers,
    body: JSON.stringify({ ...JSON.parse(body), descripcion: 'Otro contenido para la misma clave.' }),
  }), 409);
  const db = new Client({ connectionString: conexion.toString() });
  await db.connect();
  try {
    const resultado = await db.query('SELECT id FROM reclamo WHERE titulo=$1', [titulo]);
    assert.equal(resultado.rowCount, 1, 'Debe existir exactamente un reclamo, incluso tras reiniciar y repetir');
    assert.equal(resultado.rows[0].id, primera.body.id);
  } finally { await db.end(); }
});

test('C6/C8: clave inválida, ámbito por usuario y permisos actuales', async () => {
  const fixture = entorno();
  const body = JSON.stringify({ ...fixture, titulo: `Ámbito ${randomUUID()}` });
  problema(await pedir('/reclamos', { method: 'POST', headers: { 'Idempotency-Key': 'clave con espacios' }, body }), 400);
  const clave = randomUUID();
  const [a, b] = await Promise.all([
    pedir('/reclamos', { method: 'POST', headers: { 'Idempotency-Key': clave }, body }),
    pedir('/reclamos', { method: 'POST', token: process.env.ACEPTACION_ADMIN_TOKEN, headers: { 'Idempotency-Key': clave }, body }),
  ]);
  assert.equal(a.status, 201); assert.equal(b.status, 201); assert.notEqual(a.body.id, b.body.id);
  problema(await pedir('/reclamos', { method: 'POST', token: process.env.ACEPTACION_AJENO_TOKEN, headers: { 'Idempotency-Key': clave }, body }), 403);
});

test('C7: dos escrituras concurrentes, headers inválidos y ciclo A-B-A', async () => {
  entorno();
  const ruta = `/consorcios/${process.env.ACEPTACION_CONSORCIO_ID}`;
  const inicial = await pedir(ruta);
  problema(await pedir(ruta, { method: 'PATCH', body: '{}' }), 428);
  for (const valor of ['*', 'W/' + inicial.headers.get('etag'), '"otro"', inicial.headers.get('etag') + ',"otro"']) {
    problema(await pedir(ruta, { method: 'PATCH', headers: { 'If-Match': valor }, body: '{}' }), 400);
  }
  const resultados = await Promise.all(['A', 'B'].map((nombre) => pedir(ruta, { method: 'PATCH',
    headers: { 'If-Match': inicial.headers.get('etag') }, body: JSON.stringify({ nombre }) })));
  assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 412]);
  const actual = await pedir(ruta);
  const vuelta = await pedir(ruta, { method: 'PATCH', headers: { 'If-Match': actual.headers.get('etag') }, body: JSON.stringify({ nombre: inicial.body.nombre }) });
  assert.equal(vuelta.status, 200); assert.notEqual(vuelta.headers.get('etag'), inicial.headers.get('etag'));
  problema(await pedir(ruta, { method: 'PATCH', token: process.env.ACEPTACION_VECINO_TOKEN,
    headers: { 'If-Match': vuelta.headers.get('etag') }, body: '{}' }), 403);
});

test('C8: errores de rol y límite de login en endpoints reales', async () => {
  entorno();
  problema(await pedir('/consorcios', { method: 'POST', token: process.env.ACEPTACION_VECINO_TOKEN, body: '{}' }), 403);
  const email = `inexistente-${randomUUID()}@example.test`;
  let respuesta;
  for (let i = 0; i < 6; i++) respuesta = await pedir('/auth/login', { method: 'POST', autenticado: false, body: JSON.stringify({ email, password: 'clave-incorrecta-de-prueba' }) });
  problema(respuesta, 429);
});

test('C1/C8: proveedor lento, cuerpo lento, corte y rechazo a través de pagos', { timeout: 25_000 }, async () => {
  entorno();
  const db = new Client({ connectionString: process.env.ACEPTACION_DATABASE_URL }); await db.connect();
  const control = async (modo) => fetch(process.env.ACEPTACION_PROVEEDOR_URL + '/__control', { method: 'POST', body: JSON.stringify({ modo }) });
  try {
    for (const [modo, esperado] of [['lento-cabeceras',503], ['lento-cuerpo',503], ['corte',503], ['rechazo',502]]) {
      const { rows: [boleta] } = await db.query('SELECT id FROM boleta b WHERE NOT EXISTS(SELECT 1 FROM pago p WHERE p.boleta_id=b.id) LIMIT 1');
      await control(modo);
      const inicio = performance.now();
      const r = await pedir('/pagos/mercadopago/preferencia', { method: 'POST', body: JSON.stringify({ boletaId: boleta.id }) });
      problema(r, esperado);
      assert.ok(performance.now() - inicio < 5500, 'El request no debe quedar esperando al proveedor');
      const estado = await (await fetch(process.env.ACEPTACION_PROVEEDOR_URL + '/__control')).json();
      assert.equal(estado.solicitudes, 1);
      if (modo !== 'rechazo') {
        const intento = await pedir('/pagos/mercadopago/preferencia', { method: 'POST', body: JSON.stringify({ boletaId: boleta.id }) });
        problema(intento, 409);
        const posterior = await (await fetch(process.env.ACEPTACION_PROVEEDOR_URL + '/__control')).json();
        assert.equal(posterior.solicitudes, 1, 'No repetir un checkout de resultado incierto');
      }
    }
  } finally { await control('ok'); await db.end(); }
});

test('C7: ETag viejo rechaza la segunda escritura sin sobrescribir', async () => {
  entorno();
  const ruta = `/consorcios/${process.env.ACEPTACION_CONSORCIO_ID}`;
  const inicial = await pedir(ruta);
  assert.equal(inicial.status, 200);
  const etag = inicial.headers.get('etag');
  assert.ok(etag, 'GET debe devolver ETag');
  assert.match(etag, /^"/, 'If-Match requiere un ETag fuerte');
  const nombre = `Aceptación ${randomUUID()}`;
  const primero = await pedir(ruta, {
    method: 'PATCH', headers: { 'If-Match': etag }, body: JSON.stringify({ nombre }),
  });
  assert.equal(primero.status, 200);
  problema(await pedir(ruta, {
    method: 'PATCH', headers: { 'If-Match': etag }, body: JSON.stringify({ nombre: 'Escritura desactualizada' }),
  }), 412);
  const final = await pedir(ruta);
  assert.equal(final.status, 200);
  assert.equal(final.body.nombre, nombre);
  assert.ok(final.headers.get('etag'));
  assert.notEqual(final.headers.get('etag'), etag);
});
