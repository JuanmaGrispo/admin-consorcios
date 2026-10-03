import { Injectable } from '@nestjs/common';
import { EstadoAsamblea, EstadoReserva, VinculoUnidad } from '../../database/entities';
import { AsambleasService } from '../asambleas/asambleas.service';
import type { UsuarioActual } from '../auth/auth.types';
import { ExpensasService, type SaldoDeUnidad } from '../expensas/expensas.service';
import { ReclamosService } from '../reclamos/reclamos.service';
import { ReservasService } from '../reservas/reservas.service';
import { UnidadesService } from '../unidades/unidades.service';
import { UsuariosService } from '../usuarios/usuarios.service';

/** Una de las unidades del vecino, con su situación de hoy. */
export interface UnidadDeInicio {
  id: string;
  etiqueta: string;
  coeficiente: number;
  vinculo: VinculoUnidad;
  esTitular: boolean;
  consorcio: {
    id: string;
    nombre: string;
    calle: string | null;
    numero: string | null;
    barrio: string | null;
  };
  /** La boleta vigente y su saldo, o null si el consorcio nunca emitió. */
  expensas: SaldoDeUnidad | null;
  reclamosAbiertos: number;
}

/** Lo que se le viene al vecino: una asamblea citada o una reserva aprobada. */
export type EventoProximo =
  | {
      tipo: 'ASAMBLEA';
      id: string;
      titulo: string;
      fecha: Date;
      lugar: string | null;
      estado: EstadoAsamblea;
      consorcioId: string;
    }
  | {
      tipo: 'RESERVA';
      id: string;
      /** El nombre del amenity. */
      titulo: string;
      fecha: Date;
      fin: Date;
      unidadId: string;
      amenityId: string;
    };

export interface Inicio {
  usuario: { id: string; nombre: string; apellido: string; avatarUrl: string | null };
  unidades: UnidadDeInicio[];
  proximosEventos: EventoProximo[];
}

/** Hasta cuándo mirar reservas: el inicio muestra lo cercano, no la agenda entera. */
const DIAS_DE_RESERVAS = 30;
const MAXIMO_EVENTOS = 10;
const DIA_MS = 24 * 3600 * 1000;

/**
 * La pantalla de inicio del vecino. No tiene datos propios: junta en una sola
 * respuesta lo que el celular necesita apenas abre la app, para que no tenga
 * que encadenar cuatro llamadas antes de pintar la primera pantalla.
 *
 * Todavía le falta el muro de novedades, porque su módulo no existe. Se agrega
 * acá cuando exista; mientras tanto no viaja, en vez de viajar vacío y
 * hacerle creer al front que no hay nada.
 */
@Injectable()
export class InicioService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly unidades: UnidadesService,
    private readonly expensas: ExpensasService,
    private readonly reclamos: ReclamosService,
    private readonly asambleas: AsambleasService,
    private readonly reservas: ReservasService,
  ) {}

  async paraElVecino(usuario: UsuarioActual): Promise<Inicio> {
    const persona = await this.usuarios.findOne(usuario.id);
    const vinculos = await this.unidades.unidadesDelVecino(usuario.id);

    const unidades = await Promise.all(
      vinculos.map(async (v): Promise<UnidadDeInicio> => {
        const { unidad } = v;
        return {
          id: unidad.id,
          etiqueta: unidad.etiqueta,
          coeficiente: unidad.coeficiente,
          vinculo: v.vinculo,
          esTitular: v.esTitular,
          consorcio: {
            id: unidad.consorcio.id,
            nombre: unidad.consorcio.nombre,
            calle: unidad.consorcio.calle,
            numero: unidad.consorcio.numero,
            barrio: unidad.consorcio.barrio,
          },
          expensas: await this.expensas.saldoDeUnidad(unidad.id),
          reclamosAbiertos: await this.contarReclamosAbiertos(usuario, unidad.id),
        };
      }),
    );

    return {
      usuario: {
        id: usuario.id,
        nombre: persona?.nombre ?? '',
        apellido: persona?.apellido ?? '',
        avatarUrl: persona?.avatarUrl ?? null,
      },
      unidades,
      proximosEventos: await this.proximosEventos(usuario),
    };
  }

  /**
   * Asambleas convocadas o en curso y reservas aprobadas que todavía no
   * empezaron, mezcladas y de la más cercana a la más lejana.
   */
  private async proximosEventos(usuario: UsuarioActual): Promise<EventoProximo[]> {
    const tope = new Date(Date.now() + DIAS_DE_RESERVAS * DIA_MS).toISOString().slice(0, 10);
    const [asambleas, reservas] = await Promise.all([
      this.asambleas.proximasDelVecino(usuario),
      this.reservas.listar(usuario, {
        estado: EstadoReserva.APROBADA,
        situacion: 'proximas',
        hasta: tope,
        pagina: 1,
        limite: 100,
      }),
    ]);

    const eventos: EventoProximo[] = [
      ...asambleas.map(
        (a): EventoProximo => ({
          tipo: 'ASAMBLEA',
          id: a.id,
          titulo: a.titulo,
          fecha: a.fechaHora,
          lugar: a.lugar ?? a.linkVideollamada ?? null,
          estado: a.estado,
          consorcioId: a.consorcioId,
        }),
      ),
      ...reservas.items.map(
        (r): EventoProximo => ({
          tipo: 'RESERVA',
          id: r.id,
          titulo: r.amenity?.nombre ?? '',
          fecha: r.inicio,
          fin: r.fin,
          unidadId: r.unidadId,
          amenityId: r.amenityId,
        }),
      ),
    ];

    return eventos
      .sort((x, y) => x.fecha.getTime() - y.fecha.getTime())
      .slice(0, MAXIMO_EVENTOS);
  }

  /**
   * Cuántos reclamos abiertos tiene la unidad. Se pide una página de uno: lo
   * único que se usa es el total, y traer la lista entera para contarla sería
   * cargar datos que nadie va a mirar.
   */
  private async contarReclamosAbiertos(
    usuario: UsuarioActual,
    unidadId: string,
  ): Promise<number> {
    const { total } = await this.reclamos.listar(usuario, {
      unidadId,
      situacion: 'abiertos',
      pagina: 1,
      limite: 1,
    });
    return total;
  }
}
