import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildConnectionOptions } from './database.options';

const leer = (valores: Record<string, string>) => (key: string) => valores[key];

describe('buildConnectionOptions — pool', () => {
  it('sin DB_POOL_MAX queda el default del driver', () => {
    const opciones = buildConnectionOptions(leer({ DATABASE_URL: 'postgresql://u:p@h:5432/db' }));
    assert.equal(opciones.extra, undefined);
  });

  it('DB_POOL_MAX fija el máximo, con URL y con DB_* sueltos', () => {
    assert.deepEqual(buildConnectionOptions(leer({ DATABASE_URL: 'postgresql://u:p@h:5432/db', DB_POOL_MAX: '30' })).extra, { max: 30 });
    assert.deepEqual(buildConnectionOptions(leer({ DB_POOL_MAX: '25' })).extra, { max: 25 });
  });

  it('un valor inválido se ignora en lugar de romper la conexión', () => {
    for (const valor of ['', '0', '-5', '2.5', 'muchas']) {
      assert.equal(buildConnectionOptions(leer({ DB_POOL_MAX: valor })).extra, undefined, valor);
    }
  });
});
