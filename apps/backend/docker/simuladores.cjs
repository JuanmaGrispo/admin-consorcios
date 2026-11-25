/**
 * Simuladores de los servicios externos para `docker compose up`, así el
 * sistema completo levanta en una máquina limpia sin cuentas de terceros.
 * Sólo datos ficticios: no cobra, no guarda en la nube y no envía mails reales.
 *
 *   HTTP :4010
 *     Mercado Pago  POST /checkout/preferences, GET /checkout/preferences/:id,
 *                   GET /v1/payments/:id, GET /v1/payments/search
 *                   GET /checkout/:id  → checkout simulado para aprobar o rechazar
 *     Storage       POST|DELETE /storage/v1/object/:bucket/:ruta
 *                   GET /storage/v1/object/public/:bucket/:ruta
 *     SOAP          POST /webservicesserver/NumberConversion.wso  → NumberToWords
 *                   GET /soap  → elegir cómo responde: bien, Fault de negocio,
 *                                Fault técnico, lento (6 s) o caído
 *     Bandeja       GET /correos  → los mails que mandó el backend
 *   SMTP :2525      acepta cualquier usuario y guarda los mensajes en memoria
 *
 * Los simuladores de las pruebas de aceptación son otros (acceptance/): esos
 * inyectan fallas; éstos están pensados para la demo.
 */
const { createServer } = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PUERTO_HTTP = Number(process.env.PUERTO_HTTP || 4010);
const PUERTO_SMTP = Number(process.env.PUERTO_SMTP || 2525);
// Lo que ve el navegador (el checkout y las imágenes se abren desde ahí).
const PUBLICO = (process.env.URL_PUBLICA || `http://localhost:${PUERTO_HTTP}`).replace(/\/$/, '');
const CARPETA = path.resolve(process.env.CARPETA_STORAGE || '/datos/storage');

// ── SOAP NumberConversion ─────────────────────────────────────────────────
// Imita al servicio público de DataAccess: mismo sobre, mismo namespace y las
// palabras en inglés con el mismo formato ("one hundred and forty five ...").
const NS_SOAP = 'http://www.dataaccess.com/webservicesserver/';
const MODOS_SOAP = {
  ok: 'Responde bien',
  'fault-negocio': 'Fault de negocio (soap:Client: el pedido no es válido)',
  'fault-tecnico': 'Fault técnico (soap:Server: falla del servicio)',
  lento: 'Lento: tarda 6 s en contestar',
  caido: 'Caído: corta la conexión sin responder',
};
let modoSoap = 'ok';
let pedidosSoap = 0;

const UNO_A_19 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const DECENAS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ESCALAS_EN = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];

function menosDeMil(n) {
  const partes = [];
  if (n >= 100) partes.push(`${UNO_A_19[Math.floor(n / 100)]} hundred`);
  const resto = n % 100;
  if (resto) {
    if (partes.length) partes.push('and');
    partes.push(resto < 20 ? UNO_A_19[resto] : DECENAS_EN[Math.floor(resto / 10)] + (resto % 10 ? ` ${UNO_A_19[resto % 10]}` : ''));
  }
  return partes.join(' ');
}

function enIngles(n) {
  if (n === 0) return 'zero';
  const partes = [];
  for (const [valor, nombre] of ESCALAS_EN) {
    if (n >= valor) { partes.push(`${menosDeMil(Math.floor(n / valor))} ${nombre}`); n %= valor; }
  }
  if (n) partes.push(menosDeMil(n));
  return partes.join(' ');
}

const sobreSoap = (cuerpo) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${cuerpo}</soap:Body></soap:Envelope>`;
const faultSoap = (codigo, texto) => sobreSoap(`<soap:Fault><faultcode>soap:${codigo}</faultcode><faultstring>${html(texto)}</faultstring></soap:Fault>`);

async function responderSoap(req, res) {
  pedidosSoap++;
  const xml = (await leer(req)).toString();
  const escribir = (status, cuerpo) => { res.writeHead(status, { 'Content-Type': 'text/xml; charset=utf-8' }); res.end(cuerpo); };
  if (modoSoap === 'caido') return req.socket.destroy();
  if (modoSoap === 'lento') await new Promise((r) => setTimeout(r, 6_000));
  if (modoSoap === 'fault-tecnico') return escribir(500, faultSoap('Server', 'Servicio no disponible (simulado)'));
  const numero = /<(?:\w+:)?ubiNum>\s*(\d{1,15})\s*<\/(?:\w+:)?ubiNum>/.exec(xml)?.[1];
  if (modoSoap === 'fault-negocio' || numero === undefined) {
    return escribir(500, faultSoap('Client', numero === undefined ? 'Falta ubiNum o no es un entero' : 'Número rechazado (simulado)'));
  }
  // Como el servicio real, con un espacio al final.
  escribir(200, sobreSoap(`<m:NumberToWordsResponse xmlns:m="${NS_SOAP}"><m:NumberToWordsResult>${enIngles(Number(numero))} </m:NumberToWordsResult></m:NumberToWordsResponse>`));
}

const preferencias = new Map();
const pagos = new Map();
const correos = [];
let proximoPago = 1_000_000_001;

const html = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = (res, status, cuerpo) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cuerpo)); };
const pagina = (res, titulo, cuerpo) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(titulo)}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#222}
.aviso{background:#fff4d6;border:1px solid #e5c56b;padding:.6rem .8rem;border-radius:6px}button{font:inherit;padding:.6rem 1.2rem;margin:.3rem;border-radius:6px;border:1px solid #888;cursor:pointer}
.ok{background:#1f7a44;color:#fff;border-color:#1f7a44}article{border:1px solid #ddd;border-radius:6px;padding:.8rem;margin:.8rem 0}pre{white-space:pre-wrap;font-size:.85rem}</style>
<h1>${html(titulo)}</h1>${cuerpo}</html>`);
};

function rutaSegura(bucket, ruta) {
  const destino = path.resolve(CARPETA, bucket, ruta);
  if (!destino.startsWith(CARPETA + path.sep)) return null;
  return destino;
}

async function leer(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  return Buffer.concat(partes);
}

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, PUBLICO);
    const p = url.pathname;

    if (p === '/salud') return json(res, 200, { ok: true });

    // ── Mercado Pago ──────────────────────────────────────────────────────
    if (req.method === 'POST' && p === '/checkout/preferences') {
      const datos = JSON.parse((await leer(req)).toString() || '{}');
      const id = 'pref-' + randomUUID();
      preferencias.set(id, { ...datos, id });
      return json(res, 201, { id, init_point: `${PUBLICO}/checkout/${id}` });
    }
    let m = p.match(/^\/checkout\/preferences\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      return preferencias.has(m[1]) ? json(res, 200, { id: m[1], init_point: `${PUBLICO}/checkout/${m[1]}` }) : json(res, 404, { message: 'not_found' });
    }
    m = p.match(/^\/checkout\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      const pref = preferencias.get(m[1]);
      if (!pref) return pagina(res, 'Checkout simulado', '<p>La preferencia no existe (¿se reinició el simulador?).</p>');
      const item = pref.items?.[0] ?? {};
      return pagina(res, 'Checkout simulado de Mercado Pago', `
<p class="aviso">Simulador local: no se cobra nada.</p>
<p><strong>${html(item.title ?? 'Pago')}</strong><br>Importe: $ ${html(Number(item.unit_price ?? 0).toLocaleString('es-AR'))}</p>
<form method="post" action="/checkout/${html(m[1])}/aprobado"><button class="ok">Pagar (aprobado)</button></form>
<form method="post" action="/checkout/${html(m[1])}/rechazado"><button>Simular tarjeta rechazada</button></form>`);
    }
    m = p.match(/^\/checkout\/([^/]+)\/(aprobado|rechazado)$/);
    if (req.method === 'POST' && m) {
      const pref = preferencias.get(m[1]);
      if (!pref) return json(res, 404, { message: 'not_found' });
      const aprobado = m[2] === 'aprobado';
      const pago = {
        id: proximoPago++,
        status: aprobado ? 'approved' : 'rejected',
        status_detail: aprobado ? 'accredited' : 'cc_rejected_insufficient_amount',
        external_reference: pref.external_reference ?? null,
        transaction_amount: Number(pref.items?.[0]?.unit_price ?? 0),
        date_approved: aprobado ? new Date().toISOString() : null,
        date_created: new Date().toISOString(),
        payment_method_id: 'visa',
        card: { last_four_digits: '4242' },
      };
      pagos.set(String(pago.id), pago);
      const vuelta = new URL(aprobado ? pref.back_urls?.success : pref.back_urls?.failure);
      vuelta.searchParams.set('external_reference', pago.external_reference ?? '');
      vuelta.searchParams.set('payment_id', String(pago.id));
      vuelta.searchParams.set('collection_status', pago.status);
      res.writeHead(303, { Location: vuelta.toString() });
      return res.end();
    }
    if (req.method === 'GET' && p === '/v1/payments/search') {
      const ref = url.searchParams.get('external_reference');
      const results = [...pagos.values()].filter((x) => x.external_reference === ref).sort((a, b) => b.id - a.id);
      return json(res, 200, { results });
    }
    m = p.match(/^\/v1\/payments\/([^/]+)$/);
    if (req.method === 'GET' && m) return pagos.has(m[1]) ? json(res, 200, pagos.get(m[1])) : json(res, 404, { message: 'not_found' });

    // ── Storage ───────────────────────────────────────────────────────────
    m = p.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (req.method === 'GET' && m) {
      const destino = rutaSegura(m[1], decodeURIComponent(m[2]));
      if (!destino || !fs.existsSync(destino)) return json(res, 404, { message: 'not_found' });
      const tipo = fs.existsSync(destino + '.tipo') ? fs.readFileSync(destino + '.tipo', 'utf8') : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': tipo, 'Cross-Origin-Resource-Policy': 'cross-origin' });
      return fs.createReadStream(destino).pipe(res);
    }
    m = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (m && (req.method === 'POST' || req.method === 'DELETE')) {
      const destino = rutaSegura(m[1], decodeURIComponent(m[2]));
      if (!destino) return json(res, 400, { message: 'ruta inválida' });
      if (req.method === 'DELETE') {
        if (!fs.existsSync(destino)) return json(res, 404, { message: 'not_found' });
        fs.rmSync(destino); fs.rmSync(destino + '.tipo', { force: true });
        return json(res, 200, { message: 'deleted' });
      }
      if (fs.existsSync(destino)) return json(res, 409, { message: 'duplicate' });
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, await leer(req));
      fs.writeFileSync(destino + '.tipo', req.headers['content-type'] || 'application/octet-stream');
      return json(res, 200, { Key: `${m[1]}/${m[2]}` });
    }

    // ── SOAP NumberConversion ─────────────────────────────────────────────
    if (req.method === 'POST' && p === '/webservicesserver/NumberConversion.wso') return await responderSoap(req, res);
    if (req.method === 'GET' && p === '/soap') {
      const botones = Object.entries(MODOS_SOAP).map(([modo, texto]) => `<form method="post" action="/soap/${modo}">
<button${modo === modoSoap ? ' class="ok"' : ''}>${html(texto)}</button></form>`).join('');
      return pagina(res, 'Simulador SOAP NumberConversion', `
<p class="aviso">Importe en letras de boletas y recibos. Modo actual: <strong>${html(MODOS_SOAP[modoSoap])}</strong>.
Pedidos recibidos: ${pedidosSoap}. Si falla, el backend escribe las letras localmente y el PDF sale igual.
El backend recuerda los importes que ya verificó: para ver la falla, probá con un importe nuevo.</p>${botones}`);
    }
    m = p.match(/^\/soap\/([\w-]+)$/);
    if (req.method === 'POST' && m) {
      if (!(m[1] in MODOS_SOAP)) return json(res, 400, { message: 'modo desconocido', modos: Object.keys(MODOS_SOAP) });
      modoSoap = m[1];
      console.log(`SOAP: modo ${modoSoap}`);
      res.writeHead(303, { Location: '/soap' });
      return res.end();
    }

    // ── Bandeja de mails ──────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/correos') {
      const lista = correos.slice().reverse().map((c) => `<article><strong>${html(c.asunto)}</strong><br>
<small>Para: ${html(c.para)} · ${html(c.fecha)}</small><details><summary>Ver mensaje</summary><pre>${html(c.crudo)}</pre></details></article>`).join('');
      return pagina(res, `Bandeja simulada (${correos.length})`, '<p class="aviso">Mails que mandó el backend al SMTP simulado. No salen a Internet.</p>' + (lista || '<p>Todavía no hay mails.</p>'));
    }

    json(res, 404, { message: 'not_found' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { message: 'error del simulador' });
  }
});

function encabezado(crudo, nombre) {
  const linea = crudo.split('\r\n').find((l) => l.toLowerCase().startsWith(nombre.toLowerCase() + ':'));
  const valor = linea ? linea.slice(nombre.length + 1).trim() : '';
  // Asuntos con acentos llegan como =?UTF-8?B?...?= o =?UTF-8?Q?...?=
  return valor.replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, modo, texto) => modo.toLowerCase() === 'b'
    ? Buffer.from(texto, 'base64').toString('utf8')
    : Buffer.from(texto.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (__, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8'));
}

const smtp = net.createServer((socket) => {
  socket.write('220 smtp.simulado ESMTP\r\n');
  let buffer = '', enDatos = false, contenido = '', esperandoAuth = false;
  socket.on('data', (bytes) => {
    buffer += bytes.toString();
    while (buffer.includes('\r\n')) {
      const i = buffer.indexOf('\r\n');
      const linea = buffer.slice(0, i); buffer = buffer.slice(i + 2);
      if (enDatos) {
        if (linea === '.') {
          enDatos = false;
          correos.push({ para: encabezado(contenido, 'To'), asunto: encabezado(contenido, 'Subject'), fecha: new Date().toLocaleString('es-AR'), crudo: contenido });
          if (correos.length > 500) correos.shift();
          console.log(`✉  ${encabezado(contenido, 'To')} · ${encabezado(contenido, 'Subject')}`);
          contenido = '';
          socket.write('250 Accepted\r\n');
        } else contenido += (linea.startsWith('..') ? linea.slice(1) : linea) + '\r\n';
      } else if (esperandoAuth) { esperandoAuth = false; socket.write('235 Authenticated\r\n'); }
      else if (/^(EHLO|HELO)/i.test(linea)) socket.write('250-smtp.simulado\r\n250 AUTH PLAIN\r\n');
      else if (/^AUTH /i.test(linea)) { if (linea.split(' ').length >= 3) socket.write('235 Authenticated\r\n'); else { esperandoAuth = true; socket.write('334 \r\n'); } }
      else if (/^DATA/i.test(linea)) { enDatos = true; socket.write('354 End with dot\r\n'); }
      else if (/^QUIT/i.test(linea)) socket.end('221 Bye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
  socket.on('error', () => undefined);
});

fs.mkdirSync(CARPETA, { recursive: true });
servidor.listen(PUERTO_HTTP, '0.0.0.0', () => console.log(`Simuladores HTTP en :${PUERTO_HTTP} (público ${PUBLICO})`));
smtp.listen(PUERTO_SMTP, '0.0.0.0', () => console.log(`SMTP simulado en :${PUERTO_SMTP}`));
