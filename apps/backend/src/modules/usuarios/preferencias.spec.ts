import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CanalNotificacion, CategoriaNotificacion } from '../../database/entities';
import { armarPreferencias } from './preferencias';

describe('armarPreferencias', () => {
  it('sin nada guardado, todo habilitado y sólo el mail disponible', () => {
    const grilla = armarPreferencias([]);
    assert.deepEqual(grilla.map((c) => [c.canal, c.disponible]), [
      ['EMAIL', true],
      ['WHATSAPP', false],
      ['PUSH', false],
    ]);
    assert.ok(grilla.every((c) => c.categorias.length === 4 && c.categorias.every((x) => x.habilitado)));
  });

  it('lo guardado pisa el default', () => {
    const [email] = armarPreferencias([
      { canal: CanalNotificacion.EMAIL, categoria: CategoriaNotificacion.COMUNICADOS, habilitado: false },
    ]);
    const comunicados = email.categorias.find((c) => c.categoria === CategoriaNotificacion.COMUNICADOS);
    assert.equal(comunicados?.habilitado, false);
  });
});
