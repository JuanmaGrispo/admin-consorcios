import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Notificador } from '../../core/notificaciones/notificador';
import {
  EstadoReclamo,
  PrioridadReclamo,
  Reclamo,
  ReclamoEvento,
  RolUsuario,
  TipoEventoReclamo,
} from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { AsignarProveedorDto } from './dto/asignar-proveedor.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { CrearReclamoDto } from './dto/crear-reclamo.dto';
import { ListarReclamosQuery } from './dto/listar-reclamos.query';
import { MensajeReclamoDto } from './dto/mensaje-reclamo.dto';
import { ReclamosRepository } from './reclamos.repository';

const esAdmin = (usuario: UsuarioActual) => usuario.rol === RolUsuario.ADMINISTRADOR;

@Injectable()
export class ReclamosService {
  constructor(
    private readonly reclamos: ReclamosRepository,
    private readonly notificador: Notificador,
  ) {}

  // ── Lectura ────────────────────────────────────────────────────────────────

  async listar(usuario: UsuarioActual, query: ListarReclamosQuery) {
    const { items, total } = await this.reclamos.listar(
      query,
      await this.unidadesVisibles(usuario),
    );
    const limite = query.limite ?? 20;
    return {
      items,
      total,
      pagina: query.pagina ?? 1,
      paginas: Math.ceil(total / limite) || 1,
    };
  }

  /** Detalle con la timeline, recortada según quién mira. */
  async findOne(usuario: UsuarioActual, id: string) {
    const reclamo = await this.buscarConPermiso(usuario, id);
    const eventos = await this.reclamos.findEventos(id, !esAdmin(usuario));
    return { ...reclamo, eventos };
  }

  async resumen(usuario: UsuarioActual, consorcioId?: string) {
    return this.reclamos.resumen(consorcioId, await this.unidadesVisibles(usuario));
  }

  // ── Alta ───────────────────────────────────────────────────────────────────

  async crear(usuario: UsuarioActual, dto: CrearReclamoDto): Promise<Reclamo> {
    const unidadId = await this.resolverUnidad(usuario, dto.unidadId);

    const unidad = await this.reclamos.findUnidad(unidadId);
    if (!unidad) throw new NotFoundException(`La unidad ${unidadId} no existe`);

    // La prioridad la fija quien administra. Si la pudiera elegir el vecino,
    // todos los reclamos entrarían en ALTA y el orden dejaría de significar algo.
    const prioridad = esAdmin(usuario)
      ? (dto.prioridad ?? PrioridadReclamo.MEDIA)
      : PrioridadReclamo.MEDIA;

    const reclamo = await this.reclamos.crear({
      // El consorcio sale de la unidad, no del pedido: son dos columnas que
      // tienen que coincidir y la unidad es la que manda.
      consorcioId: unidad.consorcioId,
      unidadId,
      creadoPorId: usuario.id,
      categoriaId: dto.categoriaId,
      descripcion: dto.descripcion.trim(),
      prioridad,
      adjuntos: dto.adjuntos ?? [],
    });

    await this.avisar(
      reclamo,
      `Nuevo reclamo ${reclamo.codigo}`,
      `Se registró el reclamo ${reclamo.codigo}: ${reclamo.descripcion}`,
    );

    return reclamo;
  }

  // ── Gestión ────────────────────────────────────────────────────────────────

  /** Mensaje en la timeline: respuesta al vecino o nota interna. */
  async agregarMensaje(
    usuario: UsuarioActual,
    id: string,
    dto: MensajeReclamoDto,
  ): Promise<ReclamoEvento> {
    const reclamo = await this.buscarConPermiso(usuario, id);

    if (reclamo.estado === EstadoReclamo.RESUELTO) {
      throw new BadRequestException(
        `El reclamo ${reclamo.codigo} está resuelto. Reabrilo para seguir la conversación.`,
      );
    }

    // Sólo el administrador escribe notas internas; el vecino no tiene una
    // timeline privada donde esconderlas.
    const interna = esAdmin(usuario) && dto.interna === true;

    const evento = await this.reclamos.agregarEvento({
      reclamoId: reclamo.id,
      autorId: usuario.id,
      tipo: interna ? TipoEventoReclamo.NOTA_INTERNA : TipoEventoReclamo.RESPUESTA,
      mensaje: dto.mensaje.trim(),
      visibleParaVecino: !interna,
    });

    if (!interna && esAdmin(usuario)) {
      await this.avisar(
        reclamo,
        `Respuesta en tu reclamo ${reclamo.codigo}`,
        dto.mensaje.trim(),
      );
    }

    return evento;
  }

  async asignarProveedor(
    usuario: UsuarioActual,
    id: string,
    dto: AsignarProveedorDto,
  ): Promise<Reclamo> {
    const reclamo = await this.buscarConPermiso(usuario, id);

    if (reclamo.estado === EstadoReclamo.RESUELTO) {
      throw new BadRequestException(
        `El reclamo ${reclamo.codigo} está resuelto: no se le puede asignar un proveedor.`,
      );
    }

    reclamo.proveedorId = dto.proveedorId;

    // Asignar un proveedor es, en los hechos, ponerlo en marcha: si seguía en
    // NUEVO pasa solo a EN_CURSO y queda registrado en la timeline.
    const estadoAnterior = reclamo.estado;
    if (reclamo.estado === EstadoReclamo.NUEVO) {
      reclamo.estado = EstadoReclamo.EN_CURSO;
    }

    const actualizado = await this.reclamos.actualizarConEvento(reclamo, {
      reclamoId: reclamo.id,
      autorId: usuario.id,
      tipo: TipoEventoReclamo.ASIGNACION,
      mensaje: dto.mensaje?.trim() ?? null,
      estadoAnterior,
      estadoNuevo: reclamo.estado,
      visibleParaVecino: true,
    });

    await this.avisar(
      actualizado,
      `Tu reclamo ${actualizado.codigo} fue asignado`,
      dto.mensaje?.trim() ??
        `Se asignó un proveedor para atender el reclamo ${actualizado.codigo}.`,
    );

    return actualizado;
  }

  async cambiarEstado(
    usuario: UsuarioActual,
    id: string,
    dto: CambiarEstadoDto,
  ): Promise<Reclamo> {
    const reclamo = await this.buscarConPermiso(usuario, id);
    const estadoAnterior = reclamo.estado;

    if (estadoAnterior === dto.estado) {
      throw new BadRequestException(
        `El reclamo ${reclamo.codigo} ya está en ${dto.estado}`,
      );
    }

    if (
      dto.estado === EstadoReclamo.ESPERANDO_PROVEEDOR &&
      !reclamo.proveedorId
    ) {
      throw new BadRequestException(
        'Para pasar a ESPERANDO_PROVEEDOR primero hay que asignar un proveedor',
      );
    }

    reclamo.estado = dto.estado;

    // La base exige que `cerrado_at` y el estado RESUELTO vayan juntos
    // (CHECK en la tabla), así que resolver y reabrir mueven los dos campos.
    reclamo.cerradoAt = dto.estado === EstadoReclamo.RESUELTO ? new Date() : null;

    const actualizado = await this.reclamos.actualizarConEvento(reclamo, {
      reclamoId: reclamo.id,
      autorId: usuario.id,
      tipo: TipoEventoReclamo.CAMBIO_ESTADO,
      mensaje: dto.mensaje?.trim() ?? null,
      estadoAnterior,
      estadoNuevo: dto.estado,
      visibleParaVecino: true,
    });

    await this.avisar(
      actualizado,
      `Tu reclamo ${actualizado.codigo} cambió de estado`,
      `Pasó de ${estadoAnterior} a ${dto.estado}.` +
        (dto.mensaje ? ` ${dto.mensaje.trim()}` : ''),
    );

    return actualizado;
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  /**
   * `undefined` para el administrador —ve todo— y la lista de unidades
   * vinculadas para el vecino.
   */
  private async unidadesVisibles(
    usuario: UsuarioActual,
  ): Promise<string[] | undefined> {
    if (esAdmin(usuario)) return undefined;
    return this.reclamos.unidadesDelUsuario(usuario.id);
  }

  private async buscarConPermiso(
    usuario: UsuarioActual,
    id: string,
  ): Promise<Reclamo> {
    const reclamo = await this.reclamos.findById(id);
    if (!reclamo) throw new NotFoundException(`El reclamo ${id} no existe`);

    if (esAdmin(usuario)) return reclamo;

    const unidades = await this.reclamos.unidadesDelUsuario(usuario.id);
    if (!unidades.includes(reclamo.unidadId)) {
      // 404 y no 403: un 403 confirmaría que ese reclamo existe.
      throw new NotFoundException(`El reclamo ${id} no existe`);
    }
    return reclamo;
  }

  /**
   * El vecino reclama sobre su unidad. Si tiene una sola, se infiere —el
   * prototipo no le pide elegirla—; si tiene varias, la tiene que indicar.
   */
  private async resolverUnidad(
    usuario: UsuarioActual,
    unidadPedida?: string,
  ): Promise<string> {
    if (esAdmin(usuario)) {
      if (!unidadPedida) {
        throw new BadRequestException(
          'Indicá la unidad: un administrador no está vinculado a ninguna',
        );
      }
      return unidadPedida;
    }

    const unidades = await this.reclamos.unidadesDelUsuario(usuario.id);

    if (unidades.length === 0) {
      throw new ForbiddenException(
        'No estás vinculado a ninguna unidad, así que no podés abrir reclamos',
      );
    }

    if (unidadPedida) {
      if (!unidades.includes(unidadPedida)) {
        throw new ForbiddenException('Esa unidad no es tuya');
      }
      return unidadPedida;
    }

    if (unidades.length > 1) {
      throw new BadRequestException(
        'Tenés más de una unidad: indicá sobre cuál es el reclamo',
      );
    }

    return unidades[0];
  }

  /**
   * Avisa a quien abrió el reclamo. Nunca corta la operación: si el aviso
   * falla, el reclamo ya quedó guardado igual (regla del alcance).
   */
  private async avisar(reclamo: Reclamo, asunto: string, cuerpo: string) {
    await this.notificador.enviar({
      destinatarioId: reclamo.creadoPorId,
      asunto,
      cuerpo,
      origen: `reclamo:${reclamo.id}`,
    });
  }
}
