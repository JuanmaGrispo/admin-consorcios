require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, createHmac } = require('node:crypto');
const { Client } = require('pg');

const base = process.env.ACEPTACION_BASE_URL;
async function pedir(ruta, body, headers = {}) {
  const r = await fetch(base + ruta, { method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ACEPTACION_TOKEN}`, ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function conectar() {
  const url = new URL(process.env.ACEPTACION_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/domus_aceptacion');
  const db = new Client({ connectionString: url.toString() }); await db.connect(); return db;
}

test('C5/C6: fallo antes y después del INSERT outbox revierte reclamo, timeline y clave', async () => {
  const db = await conectar();
  try {
    for (const momento of ['BEFORE', 'AFTER']) {
      await db.query(`CREATE FUNCTION fallar_aceptacion() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF convert_from(NEW.contenido,'UTF8') LIKE '%Fallo-aceptacion-%' THEN
        RAISE EXCEPTION 'fallo inducido después de escritura de negocio'; END IF; RETURN NEW; END $$`);
      await db.query(`CREATE TRIGGER fallo_aceptacion ${momento} INSERT ON evento_outbox FOR EACH ROW EXECUTE FUNCTION fallar_aceptacion()`);
      const body = { ...JSON.parse(process.env.ACEPTACION_RECLAMO_JSON), titulo: 'Fallo-aceptacion-' + randomUUID() };
      const clave = randomUUID();
      try {
        const r = await pedir('/reclamos', body, { 'Idempotency-Key': clave });
        assert.equal(r.status, 500); assert.ok(!JSON.stringify(r.body).includes('fallo inducido'));
        assert.equal((await db.query('SELECT id FROM reclamo WHERE titulo=$1', [body.titulo])).rowCount, 0);
        assert.equal((await db.query('SELECT clave FROM solicitud_idempotente WHERE clave=$1', [clave])).rowCount, 0);
        assert.equal((await db.query(`SELECT id FROM evento_outbox WHERE convert_from(contenido,'UTF8') LIKE $1`, ['%' + body.titulo + '%'])).rowCount, 0);
      } finally { await db.query('DROP TRIGGER fallo_aceptacion ON evento_outbox; DROP FUNCTION fallar_aceptacion()'); }
      assert.equal((await pedir('/reclamos', body, { 'Idempotency-Key': clave })).status, 201);
      assert.equal((await db.query('SELECT e.id FROM reclamo_evento e JOIN reclamo r ON r.id=e.reclamo_id WHERE r.titulo=$1', [body.titulo])).rowCount, 1);
    }
  } finally { await db.end(); }
});

test('C5 pagos: webhook concurrente conserva un recibo, boleta y avisos; reintegro concilia saldo', async () => {
  const db = await conectar();
  try {
    const { rows: [b] } = await db.query(`SELECT b.id,b.unidad_id FROM boleta b JOIN liquidacion l ON l.id=b.liquidacion_id
      WHERE NOT EXISTS(SELECT 1 FROM pago p WHERE p.boleta_id=b.id) ORDER BY l.periodo DESC LIMIT 1`);
    const r = await pedir('/pagos/mercadopago/preferencia', { boletaId: b.id }); assert.equal(r.status, 201);
    const pagoId = r.body.pagoId;
    const mpId = String(Date.now());
    const control = async (status) => fetch(process.env.ACEPTACION_PROVEEDOR_URL + '/__control', { method: 'POST', body: JSON.stringify({ modo: 'ok',
      pagos: { [mpId]: { id: Number(mpId), status, status_detail: null, external_reference: pagoId, transaction_amount: 100, date_approved: new Date().toISOString() } } }) });
    await control('approved');
    const reqId = randomUUID(), ts = String(Date.now());
    const firma = createHmac('sha256', process.env.ACEPTACION_MP_SECRET).update(`id:${mpId};request-id:${reqId};ts:${ts};`).digest('hex');
    const headers = { 'x-signature': `ts=${ts},v1=${firma}`, 'x-request-id': reqId };
    const enviar = () => pedir('/pagos/webhook/mercadopago', { type: 'payment', data: { id: mpId } }, headers);
    const respuestas = await Promise.all(Array.from({ length: 5 }, enviar));
    assert.ok(respuestas.every((r) => r.status === 200));
    const { rows: [pago] } = await db.query('SELECT recibo_numero,estado FROM pago WHERE id=$1', [pagoId]);
    assert.equal(pago.estado, 'APROBADO'); assert.match(pago.recibo_numero, /^0001-[0-9]{8,}$/);
    assert.equal((await db.query('SELECT estado FROM boleta WHERE id=$1', [b.id])).rows[0].estado, 'PAGADA');
    const avisos = (await db.query(`SELECT id FROM evento_outbox WHERE routing='aviso.directo' AND convert_from(contenido,'UTF8')::jsonb #>> '{payload,origen}'=$1`, [`pago:${pagoId}`])).rowCount;
    assert.ok(avisos >= 1);
    await enviar();
    assert.equal((await db.query(`SELECT id FROM evento_outbox WHERE routing='aviso.directo' AND convert_from(contenido,'UTF8')::jsonb #>> '{payload,origen}'=$1`, [`pago:${pagoId}`])).rowCount, avisos);
    await control('refunded'); assert.equal((await enviar()).status, 200);
    assert.equal((await db.query('SELECT estado FROM boleta WHERE id=$1', [b.id])).rows[0].estado, 'PENDIENTE');
    assert.equal((await db.query('SELECT recibo_numero FROM pago WHERE id=$1', [pagoId])).rows[0].recibo_numero, pago.recibo_numero);
  } finally { await db.end(); }
});
