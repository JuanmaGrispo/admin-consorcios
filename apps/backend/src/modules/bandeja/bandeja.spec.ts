import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearSobre } from '../../core/mensajeria/eventos';
import { TipoNotificacion } from '../../database/entities';
import { avisoDeBandeja } from './bandeja';

describe('avisoDeBandeja', () => {
  it('las expensas emitidas', () => {
    const aviso = avisoDeBandeja(
      crearSobre('expensas.emitidas', 'c1', {
        liquidacion_id: 'l1',
        periodo: '2026-08',
        unidades_afectadas: ['u1'],
        fecha_vencimiento: '2026-09-10',
      }),
    );
    assert.equal(aviso.tipo, TipoNotificacion.BOLETA);
    assert.match(aviso.titulo, /^Ya está disponible la boleta de agosto/i);
    assert.deepEqual([aviso.entidadTipo, aviso.entidadId], ['liquidacion', 'l1']);
  });

  it('un aviso directo toma título, cuerpo y entidad de su origen', () => {
    const aviso = avisoDeBandeja(
      crearSobre('aviso.directo', null, {
        destinatario_id: 'v1',
        asunto: 'Tu reclamo RC-2026-0184 pasó a "En curso"',
        cuerpo: 'Asignado a Gasparini Servicios.',
        origen: 'reclamo:5b1f2c4e-8a3d-4e6f-9b2a-1c3d4e5f6a7b',
      }),
    );
    assert.equal(aviso.tipo, TipoNotificacion.RECLAMO);
    assert.equal(aviso.titulo, 'Tu reclamo RC-2026-0184 pasó a "En curso"');
    assert.deepEqual([aviso.entidadTipo, aviso.entidadId], ['reclamo', '5b1f2c4e-8a3d-4e6f-9b2a-1c3d4e5f6a7b']);
  });

  it('un id de origen que no es uuid no se guarda como entidad', () => {
    const aviso = avisoDeBandeja(
      crearSobre('aviso.directo', null, { destinatario_id: 'v1', asunto: 'Hola', cuerpo: '…', origen: 'reclamo:r1' }),
    );
    assert.deepEqual([aviso.entidadTipo, aviso.entidadId], [null, null]);
  });

  it('un origen desconocido no inventa entidad ni rompe', () => {
    const aviso = avisoDeBandeja(
      crearSobre('aviso.directo', null, { destinatario_id: 'v1', asunto: 'Hola', cuerpo: '…', origen: 'otro' }),
    );
    assert.equal(aviso.tipo, TipoNotificacion.NOVEDAD);
    assert.equal(aviso.entidadId, null);
  });
});
