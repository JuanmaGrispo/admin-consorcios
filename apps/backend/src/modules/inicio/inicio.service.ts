import { Injectable } from '@nestjs/common';
import { VinculoUnidad } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ExpensasService, type SaldoDeUnidad } from '../expensas/expensas.service';
import { ReclamosService } from '../reclamos/reclamos.service';
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

export interface Inicio {
  usuario: { id: string; nombre: string; apellido: string; avatarUrl: string | null };
  unidades: UnidadDeInicio[];
}

/**
 * La pantalla de inicio del vecino. No tiene datos propios: junta en una sola
 * respuesta lo que el celular necesita apenas abre la app, para que no tenga
 * que encadenar cuatro llamadas antes de pintar la primera pantalla.
 *
 * Todavía le faltan dos bloques del diseño —los próximos eventos (asambleas y
 * reservas) y el muro de novedades—, porque sus módulos no existen. Se agregan
 * acá cuando existan; mientras tanto no viajan, en vez de viajar vacíos y
 * hacerle creer al front que no hay nada.
 */
@Injectable()
export class InicioService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly unidades: UnidadesService,
    private readonly expensas: ExpensasService,
    private readonly reclamos: ReclamosService,
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
    };
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
