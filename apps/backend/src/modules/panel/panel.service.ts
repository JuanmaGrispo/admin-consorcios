import { Injectable } from '@nestjs/common';
import { EstadoAsamblea, EstadoReserva, EstadoVotacion } from '../../database/entities';
import { AsambleasService } from '../asambleas/asambleas.service';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { ExpensasService } from '../expensas/expensas.service';
import type { CobranzaDeLiquidacion } from '../expensas/expensas.repository';
import { ReclamosService } from '../reclamos/reclamos.service';
import { ZONA_POR_DEFECTO } from '../reservas/horario';
import { ReservasService } from '../reservas/reservas.service';
import { VotacionesService } from '../votaciones/votaciones.service';
import {
  type EstadoCobranza,
  estadoDeCobranza,
  hoyEn,
  morosidad,
  pendiente,
  periodosHasta,
  porcentajeCobrado,
  sumar,
} from './indicadores';

/** Cuántos meses muestra el gráfico de cobranza. */
const MESES_DE_SERIE = 6;
/** Desde cuántos días de atraso una deuda pide atención. */
const DIAS_DEUDA_ANTIGUA = 60;
/** Cuántos días puede quedar un reclamo nuevo sin proveedor antes de avisar. */
const DIAS_RECLAMO_SIN_ASIGNAR = 2;
/** Hasta cuántos días adelante se mira el quórum de las asambleas convocadas. */
const DIAS_ASAMBLEA_PROXIMA = 15;
const DIA_MS = 24 * 3600 * 1000;

export type Atencion =
  | { tipo: 'DEUDA_ANTIGUA'; consorcioId: string; consorcio: string; unidades: number; saldo: number; dias: number }
  | {
      tipo: 'LIQUIDACION_SIN_EMITIR';
      consorcioId: string;
      consorcio: string;
      periodo: string;
      /** null si ni siquiera se abrió la liquidación del período. */
      fechaVencimiento: string | null;
    }
  | {
      tipo: 'QUORUM_BAJO';
      asambleaId: string;
      consorcioId: string;
      consorcio: string;
      fecha: Date;
      quorumPorcentaje: number;
      quorumRequerido: number;
    }
  | {
      tipo: 'RECLAMO_SIN_ASIGNAR';
      reclamoId: string;
      codigo: string;
      consorcioId: string;
      consorcio: string;
      unidad: string;
      categoria: string;
      creadoAt: Date;
    };

export interface ConsorcioDelPanel {
  id: string;
  nombre: string;
  calle: string | null;
  numero: string | null;
  barrio: string | null;
  unidades: number;
  emitido: number;
  cobrado: number;
  pendiente: number;
  morosidad: number;
  estado: EstadoCobranza;
}

/**
 * El panel general del administrador: todos sus consorcios de un vistazo. No
 * tiene tablas propias, como el inicio del vecino: junta lo que ya saben
 * expensas, reclamos, reservas, votaciones y asambleas, cada uno con su alcance.
 */
@Injectable()
export class PanelService {
  constructor(
    private readonly consorcios: ConsorciosService,
    private readonly expensas: ExpensasService,
    private readonly reclamos: ReclamosService,
    private readonly reservas: ReservasService,
    private readonly votaciones: VotacionesService,
    private readonly asambleas: AsambleasService,
  ) {}

  async delAdministrador(usuario: UsuarioActual, periodoPedido?: string) {
    const hoy = hoyEn(ZONA_POR_DEFECTO);
    // Sin período, el último emitido: a principios de mes el actual todavía no existe.
    const periodo =
      periodoPedido ?? (await this.expensas.ultimoPeriodoEmitido(usuario)) ?? hoy.slice(0, 7);
    const serie = periodosHasta(periodo, MESES_DE_SERIE);

    const [consorcios, liquidaciones, deudas, resumenReclamos, sinAsignar, aprobadas, pendientes, votaciones, convocadas] =
      await Promise.all([
        this.consorcios.findAll(usuario),
        this.expensas.cobranzasPorLiquidacion(usuario, serie[0], periodo),
        this.expensas.deudaAntigua(usuario, DIAS_DEUDA_ANTIGUA),
        this.reclamos.resumen(usuario),
        this.reclamos.sinAsignar(usuario, DIAS_RECLAMO_SIN_ASIGNAR),
        this.reservasDeHoy(usuario, hoy, EstadoReserva.APROBADA),
        this.reservasDeHoy(usuario, hoy, EstadoReserva.PENDIENTE),
        this.votaciones.listar(usuario, { estado: EstadoVotacion.ABIERTA }),
        this.asambleas.listar(usuario, { estado: EstadoAsamblea.CONVOCADA }),
      ]);

    const nombre = new Map(consorcios.map((c) => [c.id, c.nombre]));
    const emitidas = (fila: CobranzaDeLiquidacion) => fila.estado === 'EMITIDA' || fila.estado === 'CERRADA';
    const delPeriodo = (p: string) => liquidaciones.filter((l) => l.periodo === p && emitidas(l));

    const actual = sumar(delPeriodo(periodo));
    const anteriorPeriodo = serie[serie.length - 2];
    const anteriores = delPeriodo(anteriorPeriodo);
    const anterior = anteriores.length > 0 ? sumar(anteriores) : null;

    const porConsorcio: ConsorcioDelPanel[] = consorcios.map((c) => {
      const fila = liquidaciones.find((l) => l.consorcioId === c.id && l.periodo === periodo);
      const emitida = !!fila && emitidas(fila);
      const cobranza = emitida
        ? fila
        : { emitido: 0, cobrado: 0, vencido: 0, unidadesVencidas: 0 };
      const mora = morosidad(cobranza.vencido, cobranza.emitido);
      return {
        id: c.id,
        nombre: c.nombre,
        calle: c.calle,
        numero: c.numero,
        barrio: c.barrio,
        unidades: c.cantidadUnidades ?? 0,
        emitido: cobranza.emitido,
        cobrado: cobranza.cobrado,
        pendiente: pendiente(cobranza),
        morosidad: mora,
        estado: estadoDeCobranza(emitida, mora),
      };
    });

    const limiteAsamblea = Date.now() + DIAS_ASAMBLEA_PROXIMA * DIA_MS;
    const atencion: Atencion[] = [
      ...deudas.map(
        (d): Atencion => ({
          tipo: 'DEUDA_ANTIGUA',
          consorcioId: d.consorcioId,
          consorcio: nombre.get(d.consorcioId) ?? '',
          unidades: d.unidades,
          saldo: d.saldo,
          dias: DIAS_DEUDA_ANTIGUA,
        }),
      ),
      ...porConsorcio
        .filter((c) => c.estado === 'SIN_EMITIR')
        .map(
          (c): Atencion => ({
            tipo: 'LIQUIDACION_SIN_EMITIR',
            consorcioId: c.id,
            consorcio: c.nombre,
            periodo,
            fechaVencimiento:
              liquidaciones.find((l) => l.consorcioId === c.id && l.periodo === periodo)
                ?.fechaVencimiento ?? null,
          }),
        ),
      ...convocadas
        .filter(
          (a) =>
            a.fechaHora.getTime() <= limiteAsamblea &&
            (a.quorumPorcentaje ?? 0) < a.quorumRequerido,
        )
        .map(
          (a): Atencion => ({
            tipo: 'QUORUM_BAJO',
            asambleaId: a.id,
            consorcioId: a.consorcioId,
            consorcio: nombre.get(a.consorcioId) ?? '',
            fecha: a.fechaHora,
            quorumPorcentaje: a.quorumPorcentaje ?? 0,
            quorumRequerido: a.quorumRequerido,
          }),
        ),
      ...sinAsignar.map(
        (r): Atencion => ({
          tipo: 'RECLAMO_SIN_ASIGNAR',
          reclamoId: r.id,
          codigo: r.codigo,
          consorcioId: r.consorcioId,
          consorcio: nombre.get(r.consorcioId) ?? '',
          unidad: r.unidad.etiqueta,
          categoria: r.categoria.nombre,
          creadoAt: r.createdAt,
        }),
      ),
    ];

    return {
      periodo,
      consorcios: consorcios.length,
      unidades: porConsorcio.reduce((total, c) => total + c.unidades, 0),
      cobranza: {
        emitido: actual.emitido,
        cobrado: actual.cobrado,
        pendiente: pendiente(actual),
        vencido: actual.vencido,
        unidadesVencidas: actual.unidadesVencidas,
        porcentajeCobrado: porcentajeCobrado(actual.cobrado, actual.emitido),
        morosidad: morosidad(actual.vencido, actual.emitido),
        // Para el "+4,8% vs julio": el front calcula la variación.
        anterior: anterior && {
          periodo: anteriorPeriodo,
          emitido: anterior.emitido,
          cobrado: anterior.cobrado,
          morosidad: morosidad(anterior.vencido, anterior.emitido),
        },
      },
      actividadHoy: {
        reclamosAbiertos: resumenReclamos.abiertos,
        reservas: aprobadas + pendientes,
        reservasPendientes: pendientes,
        votacionesActivas: votaciones.length,
      },
      serie: serie.map((p) => {
        const total = sumar(delPeriodo(p));
        return { periodo: p, emitido: total.emitido, cobrado: total.cobrado };
      }),
      atencion,
      porConsorcio,
    };
  }

  private async reservasDeHoy(usuario: UsuarioActual, hoy: string, estado: EstadoReserva) {
    const { total } = await this.reservas.listar(usuario, {
      desde: hoy,
      hasta: hoy,
      estado,
      pagina: 1,
      limite: 1,
    });
    return total;
  }
}
