import { HttpException, Injectable } from '@nestjs/common';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { EstadoCuentaService } from '../expensas/estado-cuenta.service';
import { ReclamosService } from '../reclamos/reclamos.service';
import { ReservasService } from '../reservas/reservas.service';
import { AsistenteRepository } from './asistente.repository';
import type { RolAsistente } from './politica';

/**
 * Las consultas que puede hacer el asistente. Todas son de lectura, usan el
 * usuario del token y su alcance (los mismos services que las pantallas), y
 * ninguna recibe un id: el modelo no puede pedir datos de otra unidad porque
 * no tiene cómo nombrarla. Devuelven lo justo para responder, sin ids ni
 * datos de contacto.
 */

/** Una herramienta como la ve el modelo. Cada adaptador la traduce al formato de su API, en modo estricto. */
export interface DefinicionHerramienta {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
}

const objeto = (properties: Record<string, unknown>): DefinicionHerramienta['parameters'] => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const CONSULTAR_SALDO: DefinicionHerramienta = {
  name: 'consultar_saldo',
  description:
    'Saldo actual de cada unidad del vecino: boleta vigente, total, pagado, saldo, estado y días para el vencimiento. ' +
    'Usala cuando pregunte cuánto debe, si ya pagó o cuándo vence.',
  parameters: objeto({}),
};

const MIS_RECLAMOS: DefinicionHerramienta = {
  name: 'mis_reclamos',
  description: 'Los últimos reclamos de las unidades del vecino, con su número, título y estado.',
  parameters: objeto({ situacion: { type: 'string', enum: ['abiertos', 'cerrados', 'todos'] } }),
};

const MIS_RESERVAS: DefinicionHerramienta = {
  name: 'mis_reservas',
  description: 'Las reservas de amenities de las unidades del vecino, con su estado y hasta cuándo se pueden cancelar.',
  parameters: objeto({ situacion: { type: 'string', enum: ['proximas', 'pasadas'] } }),
};

const DISPONIBILIDAD_AMENITY: DefinicionHerramienta = {
  name: 'disponibilidad_amenity',
  description:
    'Horarios ocupados y libres de un amenity en una fecha. Recibe el nombre del amenity (o parte) y la fecha AAAA-MM-DD. ' +
    'Sólo informa: no reserva.',
  parameters: objeto({
    amenity: { type: 'string', description: 'Nombre o parte del nombre, por ejemplo "SUM" o "parrilla"' },
    fecha: { type: 'string', description: 'AAAA-MM-DD' },
  }),
};

const DEUDA_ANTIGUA: DefinicionHerramienta = {
  name: 'deuda_antigua',
  description:
    'Para el administrador: por consorcio, cuántas unidades tienen deuda vencida hace más de N días y cuánto suman.',
  parameters: objeto({ dias: { type: 'integer', description: 'Antigüedad mínima de la deuda, en días (30, 60, 90…)' } }),
};

export const HERRAMIENTAS_POR_ROL: Record<RolAsistente, DefinicionHerramienta[]> = {
  [RolUsuario.VECINO]: [CONSULTAR_SALDO, MIS_RECLAMOS, MIS_RESERVAS, DISPONIBILIDAD_AMENITY],
  [RolUsuario.ADMINISTRADOR]: [DEUDA_ANTIGUA, DISPONIBILIDAD_AMENITY],
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_LISTADOS = 10;

/** Un error que el modelo ve como resultado de la herramienta, no una falla del pedido. */
export class EntradaInvalida extends Error {}

const campo = (entrada: unknown, nombre: string): unknown =>
  typeof entrada === 'object' && entrada !== null ? (entrada as Record<string, unknown>)[nombre] : undefined;

@Injectable()
export class HerramientasAsistente {
  constructor(
    private readonly estadoCuenta: EstadoCuentaService,
    private readonly reclamos: ReclamosService,
    private readonly reservas: ReservasService,
    private readonly repo: AsistenteRepository,
  ) {}

  /**
   * Corre una herramienta para el usuario. Una herramienta que no es de su rol
   * o una entrada rara devuelven un error como dato: el modelo lo lee y
   * responde sin ella. Un 404 o 400 de los services también vuelve como dato.
   */
  async ejecutar(usuario: UsuarioActual & { rol: RolAsistente }, nombre: string, entrada: unknown): Promise<unknown> {
    if (!HERRAMIENTAS_POR_ROL[usuario.rol].some((h) => h.name === nombre)) {
      return { error: `La herramienta ${nombre} no está disponible.` };
    }
    try {
      switch (nombre) {
        case 'consultar_saldo':
          return await this.consultarSaldo(usuario);
        case 'mis_reclamos':
          return await this.misReclamos(usuario, campo(entrada, 'situacion'));
        case 'mis_reservas':
          return await this.misReservas(usuario, campo(entrada, 'situacion'));
        case 'disponibilidad_amenity':
          return await this.disponibilidad(usuario, campo(entrada, 'amenity'), campo(entrada, 'fecha'));
        case 'deuda_antigua':
          return await this.deudaAntigua(usuario, campo(entrada, 'dias'));
      }
    } catch (error) {
      if (error instanceof EntradaInvalida || (error instanceof HttpException && error.getStatus() < 500)) {
        return { error: error.message };
      }
      throw error;
    }
  }

  /** Lo que el usuario puede ver, en una línea: sus unidades o los consorcios que administra. */
  async alcance(usuario: UsuarioActual & { rol: RolAsistente }): Promise<string> {
    if (usuario.rol === RolUsuario.ADMINISTRADOR) {
      const nombres = await this.repo.nombresDeConsorcios(usuario.consorcioIds ?? []);
      return `El usuario administra estos consorcios: ${[...nombres.values()].join(', ') || 'ninguno'}.`;
    }
    const unidades = (await this.estadoCuenta.unidadesVisibles(usuario)) ?? [];
    const etiquetas = await this.repo.etiquetasDeUnidades(unidades);
    return `Las unidades del usuario son: ${[...etiquetas.values()].join(', ') || 'ninguna'}.`;
  }

  private async consultarSaldo(usuario: UsuarioActual) {
    const unidades = (await this.estadoCuenta.unidadesVisibles(usuario)) ?? [];
    if (unidades.length === 0) return { unidades: [], nota: 'No tenés unidades vinculadas.' };
    const [etiquetas, saldos] = await Promise.all([
      this.repo.etiquetasDeUnidades(unidades),
      Promise.all(unidades.map((id) => this.estadoCuenta.saldoDeUnidad(id))),
    ]);
    return {
      unidades: unidades.map((id, i) => {
        const s = saldos[i];
        return {
          unidad: etiquetas.get(id) ?? 'Unidad',
          boleta: s
            ? {
                periodo: s.periodo,
                vencimiento: s.fechaVencimiento,
                total: s.total,
                pagado: s.pagado,
                saldo: s.saldo,
                estado: s.estado,
                diasParaVencer: s.diasParaVencer,
                ultimoPago: s.ultimoPago?.fecha ?? null,
              }
            : null,
        };
      }),
    };
  }

  private async misReclamos(usuario: UsuarioActual, situacion: unknown) {
    if (situacion !== 'abiertos' && situacion !== 'cerrados' && situacion !== 'todos') {
      throw new EntradaInvalida('situacion tiene que ser abiertos, cerrados o todos');
    }
    const { items, total } = await this.reclamos.listar(usuario, {
      situacion: situacion === 'todos' ? undefined : situacion,
      pagina: 1,
      limite: LIMITE_LISTADOS,
    });
    return {
      total,
      reclamos: items.map((r) => ({
        numero: r.codigo,
        titulo: r.titulo,
        estado: r.estado,
        categoria: r.categoria?.nombre ?? null,
        unidad: r.unidad?.etiqueta ?? null,
        abierto: r.createdAt,
        cerrado: r.cerradoAt,
      })),
    };
  }

  private async misReservas(usuario: UsuarioActual, situacion: unknown) {
    if (situacion !== 'proximas' && situacion !== 'pasadas') {
      throw new EntradaInvalida('situacion tiene que ser proximas o pasadas');
    }
    const { items, total } = await this.reservas.listar(usuario, { situacion, pagina: 1, limite: LIMITE_LISTADOS });
    return {
      total,
      reservas: items.map((r) => ({
        amenity: r.amenity?.nombre ?? null,
        unidad: r.unidad?.etiqueta ?? null,
        inicio: r.inicio,
        fin: r.fin,
        estado: r.estado,
        cancelableHasta: r.cancelableHasta,
        sena: r.sena ? { monto: r.sena.monto, pagada: r.sena.pagada, devuelta: r.sena.devueltaAt !== null } : null,
      })),
    };
  }

  private async disponibilidad(usuario: UsuarioActual, nombre: unknown, fecha: unknown) {
    if (typeof nombre !== 'string' || nombre.trim().length === 0 || nombre.length > 80) {
      throw new EntradaInvalida('Falta el nombre del amenity');
    }
    if (typeof fecha !== 'string' || !FECHA.test(fecha) || Number.isNaN(Date.parse(fecha))) {
      throw new EntradaInvalida('La fecha tiene que tener el formato AAAA-MM-DD');
    }
    const amenities = await this.reservas.listarAmenities(usuario, { buscar: nombre.trim() });
    if (amenities.length === 0) {
      const todos = await this.reservas.listarAmenities(usuario, {});
      return { error: `No hay un amenity llamado "${nombre}".`, amenities: todos.map((a) => a.nombre) };
    }
    if (amenities.length > 1) {
      return { error: 'Hay más de un amenity con ese nombre: preguntá cuál.', amenities: amenities.map((a) => a.nombre) };
    }
    const [amenity] = amenities;
    const d = await this.reservas.disponibilidad(usuario, amenity.id, { fecha });
    return {
      amenity: amenity.nombre,
      fecha: d.fecha,
      cerrado: d.cerrado,
      horario: `${d.horaApertura} a ${d.horaCierre}`,
      requiereAprobacion: d.requiereAprobacion,
      anticipacionMinimaHoras: d.anticipacionMinimaHoras,
      franjas: d.franjas,
      ocupado: d.ocupado.map((o) => ({ inicio: o.inicio, fin: o.fin, estado: o.estado })),
      bloqueos: d.bloqueos,
    };
  }

  private async deudaAntigua(usuario: UsuarioActual, dias: unknown) {
    if (typeof dias !== 'number' || !Number.isInteger(dias) || dias < 0 || dias > 3650) {
      throw new EntradaInvalida('dias tiene que ser un entero entre 0 y 3650');
    }
    const filas = await this.estadoCuenta.deudaAntigua(usuario, dias);
    const nombres = await this.repo.nombresDeConsorcios(filas.map((f) => f.consorcioId));
    return {
      dias,
      consorcios: filas.map((f) => ({
        consorcio: nombres.get(f.consorcioId) ?? 'Consorcio',
        unidades: f.unidades,
        saldo: f.saldo,
      })),
    };
  }
}
