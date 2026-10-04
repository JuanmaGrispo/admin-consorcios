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
  TipoEventoReclamo,
} from '../../database/entities';
import { ArchivosService } from '../archivos/archivos.service';
import { DestinoArchivo } from '../archivos/tipos-archivo';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { CategoriasReclamoService } from '../categorias-reclamo/categorias-reclamo.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { AsignarProveedorDto } from './dto/asignar-proveedor.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { CrearReclamoDto } from './dto/crear-reclamo.dto';
import { ListarReclamosQuery } from './dto/listar-reclamos.query';
import { MensajeReclamoDto } from './dto/mensaje-reclamo.dto';
import { type AlcanceReclamos, ReclamosRepository } from './reclamos.repository';

@Injectable()
export class ReclamosService {
  constructor(
    private readonly reclamos: ReclamosRepository,
    private readonly notificador: Notificador,
    private readonly categorias: CategoriasReclamoService,
    private readonly proveedores: ProveedoresService,
    private readonly archivos: ArchivosService,
  ) {}

  // ── Lectura ────────────────────────────────────────────────────────────────

  async listar(usuario: UsuarioActual, query: ListarReclamosQuery) {
    const { items, total } = await this.reclamos.listar(query, await this.alcance(usuario));
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
    const eventos = await this.reclamos.findEventos(id, !esGestor(usuario));
    return { ...reclamo, eventos };
  }

  async resumen(usuario: UsuarioActual, consorcioId?: string) {
    return this.reclamos.resumen(consorcioId, await this.alcance(usuario));
  }

  // ── Alta ───────────────────────────────────────────────────────────────────

  async crear(usuario: UsuarioActual, dto: CrearReclamoDto): Promise<Reclamo> {
    // Las fotos se suben antes con `POST /archivos?destino=reclamos`: una URL
    // externa no es una foto del vecino, aunque pase el `@IsUrl()`.
    for (const adjunto of dto.adjuntos ?? []) {
      this.archivos.exigirPropia(adjunto.url, DestinoArchivo.RECLAMOS);
    }

    const unidadId = await this.resolverUnidad(usuario, dto.unidadId);

    const unidad = await this.reclamos.findUnidad(unidadId);
    if (!unidad || (esGestor(usuario) && !gestiona(usuario, unidad.consorcioId))) {
      throw new NotFoundException(`La unidad ${unidadId} no existe`);
    }

    await this.categorias.exigirUsable(dto.categoriaId, unidad.consorcioId);

    // La prioridad la fija quien administra. Si la pudiera elegir el vecino,
    // todos los reclamos entrarían en ALTA y el orden dejaría de significar algo.
    const prioridad = esGestor(usuario)
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
    const interna = esGestor(usuario) && dto.interna === true;

    const evento = await this.reclamos.agregarEvento({
      reclamoId: reclamo.id,
      autorId: usuario.id,
      tipo: interna ? TipoEventoReclamo.NOTA_INTERNA : TipoEventoReclamo.RESPUESTA,
      mensaje: dto.mensaje.trim(),
      visibleParaVecino: !interna,
    });

    if (!interna && esGestor(usuario)) {
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

    await this.proveedores.exigirAsignable(dto.proveedorId, reclamo.consorcioId);
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

  // ── Para otros módulos ─────────────────────────────────────────────────────

  /**
   * Para gastos: el reclamo que originó un gasto tiene que ser del mismo
   * consorcio que la liquidación. La FK sólo garantiza que exista.
   */
  async exigirVinculable(reclamoId: string, consorcioId: string): Promise<Reclamo> {
    const reclamo = await this.reclamos.findById(reclamoId);
    if (!reclamo) throw new BadRequestException(`El reclamo ${reclamoId} no existe`);
    if (reclamo.consorcioId !== consorcioId) {
      throw new BadRequestException(`El reclamo ${reclamo.codigo} es de otro consorcio`);
    }
    return reclamo;
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  private async alcance(usuario: UsuarioActual): Promise<AlcanceReclamos> {
    if (esGestor(usuario)) return { consorcios: consorciosGestionados(usuario) };
    return { unidades: await this.reclamos.unidadesDelUsuario(usuario.id) };
  }

  private async buscarConPermiso(
    usuario: UsuarioActual,
    id: string,
  ): Promise<Reclamo> {
    const reclamo = await this.reclamos.findById(id);
    // 404 y no 403: un 403 confirmaría que ese reclamo existe.
    if (!reclamo) throw new NotFoundException(`El reclamo ${id} no existe`);
    if (esGestor(usuario)) {
      if (!gestiona(usuario, reclamo.consorcioId)) {
        throw new NotFoundException(`El reclamo ${id} no existe`);
      }
      return reclamo;
    }

    const unidades = await this.reclamos.unidadesDelUsuario(usuario.id);
    if (!unidades.includes(reclamo.unidadId)) {
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
    if (esGestor(usuario)) {
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
