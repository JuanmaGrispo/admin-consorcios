import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CategoriaNotificacion } from '../../database/entities';
import type { EventoDomus } from '../mensajeria/eventos';
import { categoriaDe } from './categorias';

const evento = (tipo_evento: string, payload: object = {}) =>
  ({ tipo_evento, payload }) as unknown as EventoDomus;
const aviso = (origen: string) => evento('aviso.directo', { origen });

describe('categoriaDe', () => {
  it('cada evento de dominio cae en su categoría', () => {
    assert.equal(categoriaDe(evento('expensas.emitidas')), CategoriaNotificacion.BOLETAS);
    assert.equal(categoriaDe(evento('reclamo.cerrado')), CategoriaNotificacion.RECLAMOS_RESERVAS);
    assert.equal(categoriaDe(evento('asamblea.creada')), CategoriaNotificacion.COMUNICADOS);
    assert.equal(categoriaDe(evento('novedad.publicada')), CategoriaNotificacion.COMUNICADOS);
  });

  it('un aviso directo se clasifica por su origen', () => {
    assert.equal(categoriaDe(aviso('boleta:b1')), CategoriaNotificacion.VENCIMIENTOS);
    assert.equal(categoriaDe(aviso('pago:p1')), CategoriaNotificacion.BOLETAS);
    assert.equal(categoriaDe(aviso('reserva:r1')), CategoriaNotificacion.RECLAMOS_RESERVAS);
  });

  it('un aviso operativo sin categoría sale siempre', () => {
    assert.equal(categoriaDe(aviso('cobro-duplicado:b1')), null);
  });
});
