import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RolUsuario } from '../../database/entities';
import { manualDelRol, PANTALLA_DE_SECCION, parsearSecciones } from './manual';
import { desenvolver, ManualClient, SIN_RESPUESTA } from './manual.client';
import { rutaPermitida } from './politica';

describe('manual', () => {
  it('corta las secciones por su ancla', () => {
    const s = parsearSecciones('# Título\n\nintro\n\n## Uno {#uno}\n\nTexto 1\n\n## Dos {#dos}\nTexto 2\n');
    assert.deepEqual(s, [
      { titulo: 'Uno', ancla: 'uno', texto: 'Texto 1' },
      { titulo: 'Dos', ancla: 'dos', texto: 'Texto 2' },
    ]);
  });

  for (const rol of [RolUsuario.VECINO, RolUsuario.ADMINISTRADOR] as const) {
    it(`el manual del ${rol} no repite anclas y cada pantalla existe`, () => {
      const { secciones, anclas } = manualDelRol(rol);
      assert.equal(anclas.size, secciones.length);
      for (const [ancla, ruta] of Object.entries(PANTALLA_DE_SECCION[rol])) {
        assert.ok(anclas.has(ancla), `${ancla} no es una sección del manual`);
        assert.ok(rutaPermitida(rol, ruta), `${ruta} no es una pantalla del ${rol}`);
      }
    });
  }

  it('al vecino no le llega el manual del administrador', () => {
    assert.equal(manualDelRol(RolUsuario.VECINO).anclas.has('primera-liquidacion'), false);
  });
});

describe('ManualClient', () => {
  const manual = new ManualClient();

  const casos: [RolUsuario.VECINO | RolUsuario.ADMINISTRADOR, string, string][] = [
    [RolUsuario.VECINO, '¿Cómo pago las expensas?', 'pagar-expensa'],
    [RolUsuario.VECINO, 'quiero reservar el SUM', 'reservar-amenity'],
    [RolUsuario.VECINO, 'cómo cancelo una reserva', 'cancelar-reserva'],
    [RolUsuario.VECINO, 'tengo una pérdida de agua, cómo abro un reclamo', 'abrir-reclamo'],
    [RolUsuario.ADMINISTRADOR, '¿cómo registro un pago por transferencia?', 'registrar-pago'],
    [RolUsuario.ADMINISTRADOR, 'cómo hago mi primera liquidación', 'primera-liquidacion'],
  ];
  for (const [rol, pregunta, ancla] of casos) {
    it(`"${pregunta}" → ${ancla}`, () => {
      const r = manual.responder(rol, pregunta);
      assert.equal(r.fuentes[0]?.ancla, ancla);
      assert.equal(r.derivar_a_humano, false);
    });
  }

  it('une los renglones de un párrafo y respeta pasos y párrafos', () => {
    assert.equal(
      desenvolver('Antes de\nempezar.\n\n1. Andá a\n   Cobranzas.\n2. Tocá **Pagar**.'),
      'Antes de empezar.\n\n1. Andá a Cobranzas.\n2. Tocá **Pagar**.',
    );
  });

  it('lo que el manual no cubre deriva a la administración', () => {
    const r = manual.responder(RolUsuario.VECINO, '¿quién ganó el partido ayer?');
    assert.equal(r.respuesta, SIN_RESPUESTA);
    assert.equal(r.derivar_a_humano, true);
    assert.equal(r.confianza, 'baja');
  });
});
