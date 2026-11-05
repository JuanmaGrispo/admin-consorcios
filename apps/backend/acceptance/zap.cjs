const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

// Usa exclusivamente el entorno descartable que prepara ejecutar-integral.cjs.
module.exports = async function zap({ env, datos, db, ejecutar, hasta, contenedorBackend }) {
  const carpeta = path.resolve(__dirname, process.argv.includes('--csp') ? 'resultados/zap-csp' : 'resultados/zap');
  fs.mkdirSync(carpeta, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'zap-hooks.py'), path.join(carpeta, 'zap-hooks.py'));
  const informePath = path.join(carpeta, 'resumen.json');
  const informe = { fecha: new Date().toISOString(), resultado: 'en ejecución',
    commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).stdout.trim(),
    cambiosSinCommit: true, modo: 'production', transporte: 'HTTP local, sin evaluación TLS',
    autenticacion: 'Cookie httpOnly obtenida por login real de SUPER_ADMIN; variables efímeras, omitida de los reportes',
    limites: ['Sin navegador AJAX: el spider web recorre HTML y enlaces, no ejecuta la SPA.',
      'API limitada a los métodos y rutas del OpenAPI filtrado; no es cobertura total de endpoints ni de roles.',
      'Política API de ZAP, máximo 10 minutos y 1 minuto por regla; no es una prueba de carga.'], escaneos: [] };
  const guardar = () => fs.writeFileSync(informePath, JSON.stringify(informe, null, 2));
  guardar();
  assert.equal(new URL(env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(new URL(env.DATABASE_URL).pathname, '/domus_aceptacion');
  const imagen = 'ghcr.io/zaproxy/zaproxy:stable';
  const inspeccion = spawnSync('docker', ['image', 'inspect', imagen, '--format', '{{json .RepoDigests}}'], { encoding: 'utf8', windowsHide: true });
  assert.equal(inspeccion.status, 0, 'Descargar antes la imagen oficial: docker pull ghcr.io/zaproxy/zaproxy:stable');
  informe.imagen = JSON.parse(inspeccion.stdout)[0];
  const host = 'host.docker.internal';
  const api = `http://${host}:4400`;
  const web = `http://${host}:3300`;
  const local = env.ACEPTACION_BASE_URL;
  const cookie = `domus_session=${env.ACEPTACION_TOKEN}`;
  const ocultar = (texto) => texto.replaceAll(env.ACEPTACION_TOKEN, '[SESION_OMITIDA]')
    .replaceAll(env.SEED_PASSWORD, '[PASSWORD_OMITIDA]');
  const sesion = async () => {
    const r = await fetch(local + '/auth/me', { headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000) });
    assert.equal(r.status, 200, 'El escaneo necesita conservar una sesión válida');
    const u = await r.json(); assert.equal(u.id, datos.superId); assert.equal(u.rol, 'SUPER_ADMIN');
    return { status: r.status, rol: u.rol };
  };
  informe.sesionAntes = await sesion();

  // Exporta OpenAPI sin abrir Swagger en producción ni modificar la aplicación.
  const exportador = `(async()=>{const {NestFactory}=require('@nestjs/core'); const {SwaggerModule,DocumentBuilder}=require('@nestjs/swagger'); const {AppModule}=require('./dist/app.module'); const app=await NestFactory.create(AppModule,{logger:false}); try {app.setGlobalPrefix('api'); console.log(JSON.stringify(SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Domus ZAP local').setVersion('1').build())));} finally {await app.close();}})().catch(()=>process.exit(1));`;
  const exportado = spawnSync('docker', ['exec', contenedorBackend, 'node', '-e', exportador], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(exportado.status, 0, 'No se pudo exportar OpenAPI desde el backend descartable');
  const spec = JSON.parse(exportado.stdout.trim());
  spec.servers = [{ url: api }];
  const reclamo = (await db.query('SELECT id FROM reclamo ORDER BY id LIMIT 1')).rows[0].id;
  const reemplazos = { '/api/consorcios/{id}': datos.consorcioId, '/api/boletas/{id}': datos.boletaId, '/api/reclamos/{id}': reclamo };
  const lecturas = new Set(['/api/auth/me', '/api/consorcios', '/api/consorcios/{id}', '/api/boletas', '/api/boletas/{id}',
    '/api/reclamos', '/api/reclamos/{id}', '/api/usuarios', '/api/unidades', '/api/novedades', '/api/panel', '/api/health']);
  const paths = {};
  for (const [ruta, operaciones] of Object.entries(spec.paths)) {
    if (lecturas.has(ruta) && operaciones.get) {
      const get = operaciones.get;
      for (const parametro of get.parameters || []) {
        if (parametro.in === 'path') { parametro.schema = { type: 'string', enum: [reemplazos[ruta]] }; parametro.example = reemplazos[ruta]; }
        if (parametro.name === 'consorcioId') { parametro.schema = { type: 'string', enum: [datos.consorcioId] }; parametro.example = datos.consorcioId; }
      }
      paths[ruta] = { get };
    }
  }
  assert.ok(paths['/api/auth/me'] && paths['/api/boletas'] && paths['/api/reclamos'], 'Faltan rutas de control del alcance');
  const post = spec.paths['/api/reclamos'].post;
  post.requestBody = { required: true, content: { 'application/json': { schema: { type: 'object', required: ['unidadId','categoriaId','titulo','descripcion'], properties: {
    unidadId: { type: 'string', enum: [datos.unidadId] }, categoriaId: { type: 'string', enum: [datos.categoriaId] },
    titulo: { type: 'string', default: 'Reclamo ZAP local' }, descripcion: { type: 'string', default: 'Datos descartables de seguridad' },
  } }, example: { unidadId: datos.unidadId, categoriaId: datos.categoriaId, titulo: 'Reclamo ZAP local', descripcion: 'Datos descartables de seguridad' } } } };
  paths['/api/reclamos'].post = post;
  spec.paths = paths;
  // La autenticación se inyecta como Cookie; no solicitar un bearer al importador.
  delete spec.security;
  for (const p of Object.values(paths)) for (const op of Object.values(p)) delete op.security;
  fs.writeFileSync(path.join(carpeta, 'openapi-alcance.json'), JSON.stringify(spec, null, 2));
  informe.operaciones = Object.entries(paths).flatMap(([ruta, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${ruta}`));
  guardar();

  let frontend;
  const front = path.resolve(__dirname, '../../frontend');
  const next = path.join(front, 'node_modules/next/dist/bin/next');
  const frontEnv = { ...env, NODE_ENV: 'production', NEXT_PUBLIC_API_URL: local, NEXT_PUBLIC_STORAGE_URL: env.SUPABASE_PUBLIC_URL,
    ACEPTACION_CSP: 'SI' };
  const escanear = async (nombre, script, opciones) => {
    const contenedor = `domus-zap-${nombre}`;
    for (const sufijo of ['.log', '.html', '.json', '-sesion-antes.json', '-sesion-despues.json', '-trafico.json', '-control-post.json']) {
      fs.rmSync(path.join(carpeta, nombre + sufijo), { force: true });
    }
    const log = fs.openSync(path.join(carpeta, `${nombre}.log`), 'w');
    const inicio = Date.now();
    let codigo;
    try {
      codigo = await new Promise((resolve, reject) => {
        const hijo = spawn('docker', ['run', '--rm', '--name', contenedor, '--add-host', `${host}:host-gateway`,
          '--mount', `type=bind,source=${carpeta},target=/zap/wrk`,
          '--env', 'ZAP_AUTH_HEADER', '--env', 'ZAP_AUTH_HEADER_VALUE', '--env', 'ZAP_AUTH_HEADER_SITE', '--env', 'ZAP_SCAN_NAME', '--env', 'ZAP_RECLAMO_JSON',
          informe.imagen, script, ...opciones, '--hook', '/zap/wrk/zap-hooks.py', '-r', `${nombre}.html`, '-J', `${nombre}.json`, '-T', '5', '-s'],
        { env: { ...env, ZAP_AUTH_HEADER: 'Cookie', ZAP_AUTH_HEADER_VALUE: cookie, ZAP_AUTH_HEADER_SITE: host, ZAP_SCAN_NAME: nombre,
          ZAP_RECLAMO_JSON: JSON.stringify({ unidadId: datos.unidadId, categoriaId: datos.categoriaId, titulo: 'Reclamo ZAP local', descripcion: 'Datos descartables de seguridad' }) },
          stdio: ['ignore', log, log], windowsHide: true });
        hijo.once('error', reject); hijo.once('exit', resolve);
      });
    } finally {
      fs.closeSync(log);
      // Las sesiones son efímeras y aun así se omiten de reportes y logs.
      for (const archivo of [`${nombre}.log`, `${nombre}.html`, `${nombre}.json`]) {
        const destino = path.join(carpeta, archivo);
        if (fs.existsSync(destino)) fs.writeFileSync(destino, ocultar(fs.readFileSync(destino, 'utf8')));
      }
    }
    assert.ok([0, 1, 2].includes(codigo), `ZAP ${nombre} falló al ejecutarse (código ${codigo}); revisar el log`);
    const reporte = JSON.parse(fs.readFileSync(path.join(carpeta, `${nombre}.json`), 'utf8'));
    for (const fase of ['antes', 'despues']) {
      const prueba = JSON.parse(fs.readFileSync(path.join(carpeta, `${nombre}-sesion-${fase}.json`), 'utf8'));
      assert.equal(prueba.valido, true, `ZAP ${nombre}: falta acreditar autenticación ${fase}`);
    }
    const trafico = JSON.parse(fs.readFileSync(path.join(carpeta, `${nombre}-trafico.json`), 'utf8'));
    if (nombre === 'activo-api') {
      assert.ok(trafico.operacionesCon2xx.length > 0, 'El escaneo activo no acreditó acceso autenticado a negocio');
      const control = JSON.parse(fs.readFileSync(path.join(carpeta, 'activo-api-control-post.json'), 'utf8'));
      assert.equal(control.estado, 201, 'Falta acreditar el alta de control mediante ZAP');
      assert.ok(trafico.operacionesCon2xx.includes(`POST ${api}/api/reclamos`), 'Falta el POST válido en el historial de ZAP');
    }
    const alertas = (reporte.site || []).flatMap((s) => (s.alerts || []).map((a) => ({ id: a.pluginid, nombre: a.name || a.alert, riesgo: a.riskdesc, instancias: a.count })));
    informe.escaneos.push({ nombre, codigoZAP: codigo, duracionSegundos: Math.round((Date.now() - inicio) / 1000), versionZAP: reporte['@version'], trafico, alertas });
    guardar(); console.log(`ZAP ${nombre}: ejecutado, código ${codigo}, ${alertas.length} tipos de alerta.`);
  };
  try {
    await ejecutar(process.execPath, [next, 'build'], { cwd: front, env: frontEnv });
    const log = fs.openSync(path.join(carpeta, 'frontend.log'), 'w');
    frontend = spawn(process.execPath, [next, 'start', '--port', '3300', '--hostname', '0.0.0.0'],
      { cwd: front, env: frontEnv, stdio: ['ignore', log, log], windowsHide: true, detached: process.platform !== 'win32' });
    fs.closeSync(log);
    await hasta(async () => (await fetch('http://127.0.0.1:3300/login', { signal: AbortSignal.timeout(2000) })).ok, 90_000);
    await ejecutar(process.execPath, [path.join(front, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.aceptacion.config.ts'], { cwd: front, env: frontEnv });
    informe.navegadorProduccion = 'Playwright: regresión web y controles CSP aprobados'; guardar();
    await escanear('baseline-web', 'zap-baseline.py', ['-t', `${web}/consorcios/${datos.consorcioId}`, '-m', '1', '--autooff']);
    await escanear('activo-api', 'zap-api-scan.py', ['-t', '/zap/wrk/openapi-alcance.json', '-f', 'openapi',
      '-z', '-config ascan.maxScanDurationInMins=10 -config ascan.maxRuleDurationInMins=1 -config ascan.threadPerHost=2']);
    informe.sesionDespues = await sesion();
    informe.resultado = 'escaneos ejecutados; revisar hallazgos'; guardar();
  } catch (e) { informe.resultado = 'fallido'; informe.error = ocultar(e.message); guardar(); throw e;
  } finally {
    if (frontend && frontend.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(frontend.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else process.kill(-frontend.pid, 'SIGTERM');
    }
  }
};
