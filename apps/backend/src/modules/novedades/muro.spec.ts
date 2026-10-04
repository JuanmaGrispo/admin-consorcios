import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearSobre, type EventoDomus } from '../../core/mensajeria/eventos';
import { novedadDeEvento } from './muro';

describe('novedades automáticas del muro', () => {
  it('una asamblea convocada sale con fecha, hora y lugar', () => {
    const evento = crearSobre('asamblea.creada', 'c1', {
      asamblea_id: 'as1',
      titulo: 'Ordinaria 2026',
      fecha: '2026-10-12',
      hora: '19:00',
      lugar: 'SUM',
    }) as EventoDomus;
    assert.deepEqual(novedadDeEvento(evento), {
      titulo: 'Asamblea convocada: Ordinaria 2026',
      cuerpo: 'Se convocó la asamblea "Ordinaria 2026" para el 12/10/2026 a las 19:00 en SUM. Confirmá tu asistencia desde el portal.',
    });
  });

  it('un título largo se recorta a lo que entra en la columna', () => {
    const evento = crearSobre('votacion.nueva', 'c1', {
      votacion_id: 'v1',
      titulo: 'x'.repeat(200),
      fecha_cierre: '2026-10-12T22:00:00.000Z',
      mayoria_necesaria: 'ABSOLUTA',
    }) as EventoDomus;
    assert.equal(novedadDeEvento(evento)!.titulo.length, 150);
  });

  it('un reclamo cerrado no va al muro: es de un vecino, no del edificio', () => {
    const evento = crearSobre('reclamo.cerrado', 'c1', {
      reclamo_id: 'r1',
      codigo: 'RC-2026-0001',
      unidad_id: 'u1',
      usuario_id: 'v1',
      categoria: 'Plomería',
      resolucion: null,
    }) as EventoDomus;
    assert.equal(novedadDeEvento(evento), null);
  });
});
