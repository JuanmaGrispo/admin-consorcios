import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fechaLegible, mesLegible } from '../../core/formato';
import { crearSobre, type EventoDomus } from '../../core/mensajeria/eventos';
import { redactar } from './plantillas';

describe('plantillas de mail', () => {
  it('formatea período y fecha', () => {
    assert.equal(mesLegible('2026-10'), 'octubre 2026');
    assert.equal(fechaLegible('2026-11-10'), '10/11/2026');
  });

  it('las expensas detallan cada unidad con su total', () => {
    const evento = crearSobre('expensas.emitidas', 'c1', {
      liquidacion_id: 'l1',
      periodo: '2026-10',
      unidades_afectadas: ['u1', 'u2'],
      fecha_vencimiento: '2026-11-10',
    }) as EventoDomus;
    const mail = redactar(evento, {
      nombre: 'Julieta',
      unidades: [
        { etiqueta: '3º B', total: 145320.5 },
        { etiqueta: 'Cochera 4', total: 12000 },
      ],
    });
    assert.equal(mail.asunto, 'Expensas de octubre 2026');
    assert.match(mail.texto, /Hola Julieta/);
    assert.match(mail.texto, /Vencen el 10\/11\/2026/);
    assert.match(mail.texto, /Unidad 3º B: \$\s?145\.320,50/);
    assert.match(mail.texto, /Unidad Cochera 4/);
  });

  it('el resultado de una votación sin quórum se explica', () => {
    const evento = crearSobre('votacion.cerrada', 'c1', {
      votacion_id: 'v1',
      titulo: 'Pintura',
      resultado: 'sin_quorum',
      participacion_pct: 12.5,
    }) as EventoDomus;
    assert.match(redactar(evento, { nombre: 'Ana' }).texto, /no alcanzó el quórum.*12\.5%/);
  });

  it('el html escapa lo que escribió el usuario', () => {
    const evento = crearSobre('aviso.directo', null, {
      destinatario_id: 'v1',
      asunto: 'Respuesta',
      cuerpo: '<script>alert(1)</script>',
      origen: 'reclamo:r1',
    }) as EventoDomus;
    const mail = redactar(evento, { nombre: 'Ana' });
    assert.equal(mail.asunto, 'Respuesta');
    assert.ok(!mail.html.includes('<script>'));
  });
});
