require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DataSource } = require('typeorm');
const { ConfigService } = require('@nestjs/config');
const { ArchivosClient } = require('../src/modules/archivos/archivos.client');
const { CompensacionArchivosRepository } = require('../src/modules/archivos/compensacion-archivos.repository');
const { CompensacionArchivosService } = require('../src/modules/archivos/compensacion-archivos.service');

test('C5 Storage: referencias, mantenimiento y borrado compensatorio idempotente', async () => {
  const url = new URL(process.env.ACEPTACION_DATABASE_URL); assert.equal(url.hostname, '127.0.0.1');
  const db = await new DataSource({ type: 'postgres', url: url.toString() }).initialize();
  const client = new ArchivosClient(new ConfigService(process.env));
  const service = new CompensacionArchivosService(new CompensacionArchivosRepository(db), client);
  const archivo = process.env.ACEPTACION_ARCHIVO_URL;
  try {
    assert.equal((await service.ejecutar(archivo)).aplicado, false);
    assert.equal(client.rutaDeUrl(process.env.SUPABASE_PUBLIC_URL + '/storage/v1/object/public/domus/avatares/dueno/%2e%2e/otro.png'), null);
    if (process.env.ACEPTACION_ARCHIVO_FASE === 'activo') {
      await assert.rejects(service.ejecutar(archivo, true, true), /mantenimiento/);
      await db.query('UPDATE usuario SET avatar_url=$1 WHERE id=$2', [archivo, process.env.ACEPTACION_SUPER_ID]);
      try { await assert.rejects(service.ejecutar(archivo), /referenciado/); }
      finally { await db.query('UPDATE usuario SET avatar_url=NULL WHERE id=$1', [process.env.ACEPTACION_SUPER_ID]); }
    } else {
      assert.equal((await service.ejecutar(archivo, true, true)).aplicado, true);
      assert.equal((await service.ejecutar(archivo, true, true)).aplicado, true);
    }
  } finally { await db.destroy(); }
});
