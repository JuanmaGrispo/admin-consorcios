import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Body, Controller, ForbiddenException, Get, Module, Post } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IsString } from 'class-validator';
import { configurarApp } from './configurar-app';

class CosaDto {
  @IsString()
  nombre: string;
}

@Controller('cosas')
class CosasController {
  @Get() listar() { return []; }
  @Post() crear(@Body() dto: CosaDto) { return dto; }
  @Get('roto') roto() { throw new Error('select * from usuarios -- secreto'); }
  @Get('prohibido') prohibido() { throw new ForbiddenException('no'); }
}

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })], controllers: [CosasController] })
class PruebaModule {}

/** Levanta la app con la misma configuración que main.ts, sin base de datos. */
async function levantar(env: string) {
  process.env.NODE_ENV = env;
  process.env.CORS_ORIGINS = 'https://domus.test';
  const app = await NestFactory.create<NestExpressApplication>(PruebaModule, { logger: false });
  configurarApp(app);
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', 'localhost');
  return { app, base };
}

describe('configurarApp — desarrollo', () => {
  let ctx: Awaited<ReturnType<typeof levantar>>;
  before(async () => { ctx = await levantar('development'); });
  after(() => ctx.app.close());

  it('no anuncia Express y manda las cabeceras de seguridad', async () => {
    const r = await fetch(`${ctx.base}/api/cosas`);
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('strict-transport-security') ?? '', /max-age=/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  });

  it('un método no previsto es 405 con Allow, y una ruta inexistente 404', async () => {
    const r = await fetch(`${ctx.base}/api/cosas`, { method: 'DELETE' });
    assert.equal(r.status, 405);
    assert.match(r.headers.get('allow') ?? '', /GET/);
    assert.equal((await fetch(`${ctx.base}/api/nada`)).status, 404);
  });

  it('un error interno es 500 genérico con id y sin detalle', async () => {
    const r = await fetch(`${ctx.base}/api/cosas/roto`);
    const cuerpo = await r.json();
    assert.equal(r.status, 500);
    assert.ok(cuerpo.id);
    assert.doesNotMatch(JSON.stringify(cuerpo), /select|secreto|usuarios/);
  });

  it('un 403 conserva su código y un campo de más es 400', async () => {
    assert.equal((await fetch(`${ctx.base}/api/cosas/prohibido`)).status, 403);
    const r = await fetch(`${ctx.base}/api/cosas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: 'x', rol: 'SUPER_ADMIN' }),
    });
    assert.equal(r.status, 400);
  });

  it('CORS: un origen ajeno no recibe Access-Control-Allow-Origin', async () => {
    const ajeno = await fetch(`${ctx.base}/api/cosas`, { headers: { origin: 'https://malo.test' } });
    assert.equal(ajeno.headers.get('access-control-allow-origin'), null);
    const propio = await fetch(`${ctx.base}/api/cosas`, { headers: { origin: 'https://domus.test' } });
    assert.equal(propio.headers.get('access-control-allow-origin'), 'https://domus.test');
    assert.equal(propio.headers.get('access-control-allow-credentials'), 'true');
  });

  it('Swagger está disponible en desarrollo', async () => {
    assert.equal((await fetch(`${ctx.base}/docs`)).status, 200);
  });
});

describe('configurarApp — producción', () => {
  let ctx: Awaited<ReturnType<typeof levantar>>;
  before(async () => { ctx = await levantar('production'); });
  after(() => { ctx.app.close(); process.env.NODE_ENV = 'test'; });

  it('/docs responde 404 y la CSP está activa', async () => {
    assert.equal((await fetch(`${ctx.base}/docs`)).status, 404);
    const r = await fetch(`${ctx.base}/api/cosas`);
    assert.ok(r.headers.get('content-security-policy'));
  });
});
