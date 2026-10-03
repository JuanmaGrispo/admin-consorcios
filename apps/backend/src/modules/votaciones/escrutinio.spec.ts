import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CriterioDesempate, MayoriaRequerida, ResultadoVotacion } from '../../database/entities';
import { escrutar, type ReglasEscrutinio } from './escrutinio';

const OPCIONES = [
  { id: 'si', etiqueta: 'A favor' },
  { id: 'no', etiqueta: 'En contra' },
  { id: 'abs', etiqueta: 'Abstención' },
];

const reglas = (over: Partial<ReglasEscrutinio> = {}): ReglasEscrutinio => ({
  mayoria: MayoriaRequerida.SIMPLE_PRESENTES,
  desempate: CriterioDesempate.RECHAZADA,
  aFavorId: 'si',
  enContraId: 'no',
  pesoPadron: 100,
  ...over,
});

const v = (opcionId: string, peso: number) => ({ opcionId, peso });

describe('escrutar', () => {
  it('suma por opción y calcula porcentajes sobre lo emitido', () => {
    const e = escrutar(OPCIONES, [v('si', 30), v('no', 20), v('abs', 50)], reglas());
    assert.deepEqual(
      e.opciones.map((o) => [o.opcionId, o.peso, o.porcentaje, o.votos]),
      [
        ['si', 30, 30, 1],
        ['no', 20, 20, 1],
        ['abs', 50, 50, 1],
      ],
    );
    assert.equal(e.pesoEmitido, 100);
    assert.equal(e.participacion, 100);
  });

  it('simple: aprueba si A favor supera a En contra, sin contar abstenciones', () => {
    const e = escrutar(OPCIONES, [v('si', 10), v('no', 5), v('abs', 80)], reglas());
    assert.equal(e.resultado, ResultadoVotacion.APROBADA);
  });

  it('simple: rechaza si En contra gana', () => {
    const e = escrutar(OPCIONES, [v('si', 5), v('no', 10)], reglas());
    assert.equal(e.resultado, ResultadoVotacion.RECHAZADA);
  });

  it('simple: el empate lo decide el desempate', () => {
    const empate = [v('si', 10), v('no', 10)];
    assert.equal(escrutar(OPCIONES, empate, reglas()).resultado, ResultadoVotacion.RECHAZADA);
    assert.equal(
      escrutar(OPCIONES, empate, reglas({ desempate: CriterioDesempate.APROBADA })).resultado,
      ResultadoVotacion.APROBADA,
    );
  });

  it('absoluta: necesita más de la mitad del padrón, voten o no', () => {
    const r = reglas({ mayoria: MayoriaRequerida.ABSOLUTA });
    assert.equal(escrutar(OPCIONES, [v('si', 40)], r).resultado, ResultadoVotacion.RECHAZADA);
    assert.equal(escrutar(OPCIONES, [v('si', 50.01)], r).resultado, ResultadoVotacion.APROBADA);
    assert.equal(escrutar(OPCIONES, [v('si', 50)], r).resultado, ResultadoVotacion.RECHAZADA);
  });

  it('dos tercios: aprueba desde 2/3 del padrón', () => {
    const r = reglas({ mayoria: MayoriaRequerida.DOS_TERCIOS, pesoPadron: 3 });
    assert.equal(escrutar(OPCIONES, [v('si', 2)], r).resultado, ResultadoVotacion.APROBADA);
    assert.equal(escrutar(OPCIONES, [v('si', 1.9999)], r).resultado, ResultadoVotacion.RECHAZADA);
  });

  it('sin votos es SIN_QUORUM', () => {
    assert.equal(escrutar(OPCIONES, [], reglas()).resultado, ResultadoVotacion.SIN_QUORUM);
  });

  it('una asamblea sin quórum da SIN_QUORUM aunque haya votos', () => {
    const e = escrutar(OPCIONES, [v('si', 90)], reglas({ sinQuorum: true }));
    assert.equal(e.resultado, ResultadoVotacion.SIN_QUORUM);
  });

  it('los flotantes no inventan un ganador', () => {
    // 0.1 + 0.2 da 0.30000000000000004 en punto flotante.
    const e = escrutar(OPCIONES, [v('si', 0.1), v('si', 0.2), v('no', 0.3)], reglas());
    assert.equal(e.resultado, ResultadoVotacion.RECHAZADA);
  });
});
