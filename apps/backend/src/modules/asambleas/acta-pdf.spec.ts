import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Asamblea,
  Asistencia,
  EstadoAsistencia,
  ResultadoVotacion,
  TipoAsamblea,
  TipoPuntoOrden,
} from '../../database/entities';
import { generarActaPdf } from './acta-pdf';
import { calcularQuorum } from './quorum';

const ASAMBLEA = {
  id: 'as1',
  titulo: 'Asamblea ordinaria · 2º semestre',
  tipo: TipoAsamblea.ORDINARIA,
  fechaHora: new Date('2026-09-12T22:00:00Z'),
  lugar: 'SUM del edificio',
  quorumRequerido: 60,
  puntoOrdenDias: [
    { id: 'p2', orden: 2, titulo: 'Cambio de la bomba de agua', descripcion: 'Presupuesto de $ 3.480.000', tipo: TipoPuntoOrden.CON_VOTACION },
    { id: 'p1', orden: 1, titulo: 'Lectura del acta anterior', descripcion: null, tipo: TipoPuntoOrden.INFORMATIVO },
  ],
} as unknown as Asamblea;

const asistencia = (etiqueta: string, estado: EstadoAsistencia, coef: number, apoderado?: string) =>
  ({
    unidadId: etiqueta,
    unidad: { etiqueta },
    estado,
    coeficienteAplicado: coef,
    apoderadoUnidad: apoderado ? { etiqueta: apoderado } : null,
  }) as unknown as Asistencia;

const ASISTENCIAS = [
  asistencia('4º A', EstadoAsistencia.ASISTE, 40),
  asistencia('4º D', EstadoAsistencia.CON_PODER, 25, '4º A'),
  asistencia('3º B', EstadoAsistencia.NO_ASISTE, 35),
];

describe('generarActaPdf', () => {
  it('genera un PDF válido con o sin padrón', async () => {
    const consorcio = { nombre: 'Av. Rivadavia 4820', calle: 'Av. Rivadavia', numero: '4820', ciudad: 'CABA' };
    const conPadron = await generarActaPdf({
      asamblea: ASAMBLEA,
      consorcio,
      quorum: calcularQuorum(ASISTENCIAS, 60),
      asistencias: ASISTENCIAS,
      votaciones: [{ puntoOrdenDiaId: 'p2', titulo: 'Bomba', resultado: ResultadoVotacion.APROBADA }],
    });
    assert.equal(conPadron.subarray(0, 5).toString(), '%PDF-');

    const borrador = await generarActaPdf({ asamblea: ASAMBLEA, consorcio, quorum: null, asistencias: [], votaciones: [] });
    assert.equal(borrador.subarray(0, 5).toString(), '%PDF-');
  });
});
