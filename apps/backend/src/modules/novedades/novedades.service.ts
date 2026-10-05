import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { EventoDomus } from '../../core/mensajeria/eventos';
import { PublicadorEventos } from '../../core/mensajeria/publicador-eventos';
import { Novedad, TipoAdjunto } from '../../database/entities';
import { ArchivosService } from '../archivos/archivos.service';
import { DestinoArchivo } from '../archivos/tipos-archivo';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { ActualizarNovedadDto } from './dto/actualizar-novedad.dto';
import { CrearNovedadDto } from './dto/crear-novedad.dto';
import { ListarNovedadesQuery } from './dto/listar-novedades.query';
import { novedadDeEvento } from './muro';
import { NovedadesRepository } from './novedades.repository';

/** Al vecino le viaja si la leyó; al administrador, cuántos la leyeron. */
export type NovedadVista = Novedad & { leida?: boolean; lecturas?: number };

const tipoDeAdjunto = (url: string): TipoAdjunto => {
  if (/\.pdf$/i.test(url)) return TipoAdjunto.PDF;
  if (/\.(jpe?g|png|webp)$/i.test(url)) return TipoAdjunto.IMAGEN;
  return TipoAdjunto.OTRO;
};

@Injectable()
export class NovedadesService {
  private readonly logger = new Logger(NovedadesService.name);

  constructor(
    private readonly novedades: NovedadesRepository,
    private readonly archivos: ArchivosService,
    private readonly eventos: PublicadorEventos,
  ) {}

  async listar(usuario: UsuarioActual, query: ListarNovedadesQuery) {
    const gestor = esGestor(usuario);
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const { items, total } = await this.novedades.listar({
      consorcioIds: gestor
        ? consorciosGestionados(usuario)
        : await this.novedades.consorciosDelVecino(usuario.id),
      consorcioId: query.consorcioId,
      soloVisibles: !gestor || !query.incluirInactivas,
      pagina,
      limite,
    });
    return {
      items: await this.conLecturas(usuario, items),
      total,
      pagina,
      paginas: Math.ceil(total / limite) || 1,
    };
  }

  async findOne(usuario: UsuarioActual, id: string): Promise<NovedadVista> {
    const [novedad] = await this.conLecturas(usuario, [await this.exigirVisible(usuario, id)]);
    return novedad;
  }

  /** Para el inicio del vecino: lo último del muro de sus edificios. */
  async ultimasDelVecino(usuario: UsuarioActual, cantidad: number): Promise<NovedadVista[]> {
    return (await this.listar(usuario, { pagina: 1, limite: cantidad })).items;
  }

  async crear(usuario: UsuarioActual, dto: CrearNovedadDto): Promise<NovedadVista> {
    if (!gestiona(usuario, dto.consorcioId)) {
      throw new NotFoundException(`Consorcio ${dto.consorcioId} no existe`);
    }
    for (const adjunto of dto.adjuntos ?? []) {
      this.archivos.exigirPropia(adjunto.url, DestinoArchivo.NOVEDADES);
    }

    const novedad = await this.novedades.crear(
      {
        consorcioId: dto.consorcioId,
        autorId: usuario.id,
        titulo: dto.titulo.trim(),
        cuerpo: dto.cuerpo.trim(),
        fijada: dto.fijada ?? false,
        publicadaAt: new Date(),
      },
      (dto.adjuntos ?? []).map((a) => ({ url: a.url, nombre: a.nombre ?? null, tipo: tipoDeAdjunto(a.url) })),
    );

    this.eventos.publicar('novedad.publicada', novedad.consorcioId, {
      novedad_id: novedad.id,
      titulo: novedad.titulo,
    });
    return novedad;
  }

  /**
   * Lo que publica el muro por un evento de dominio. El autor es el
   * administrador del consorcio: la novedad sale en su nombre, como si la
   * hubiera escrito él.
   */
  async publicarAutomatica(evento: EventoDomus): Promise<void> {
    const contenido = novedadDeEvento(evento);
    if (!contenido || !evento.consorcio_id) return;

    const autorId = await this.novedades.administradorDe(evento.consorcio_id);
    if (!autorId) {
      this.logger.warn(`El consorcio ${evento.consorcio_id} no existe: ${evento.tipo_evento} no va al muro`);
      return;
    }

    await this.novedades.crearDesdeEvento(evento.evento_id, 'muro-novedades', {
      consorcioId: evento.consorcio_id,
      autorId,
      ...contenido,
      publicadaAt: new Date(evento.timestamp),
    });
  }

  async actualizar(usuario: UsuarioActual, id: string, dto: ActualizarNovedadDto): Promise<Novedad> {
    const novedad = await this.exigirVisible(usuario, id);
    return this.novedades.actualizar(novedad, dto);
  }

  async marcarLeida(usuario: UsuarioActual, id: string): Promise<void> {
    if (esGestor(usuario)) {
      throw new ForbiddenException('Las lecturas son de los vecinos');
    }
    await this.exigirVisible(usuario, id);
    await this.novedades.marcarLeida(id, usuario.id);
  }

  /** 404 y no 403 para lo que no puede ver: un 403 confirmaría que existe. */
  private async exigirVisible(usuario: UsuarioActual, id: string): Promise<Novedad> {
    const novedad = await this.novedades.findById(id);
    const visible =
      novedad &&
      (esGestor(usuario)
        ? gestiona(usuario, novedad.consorcioId)
        : novedad.activa &&
          novedad.publicadaAt !== null &&
          (await this.novedades.consorciosDelVecino(usuario.id)).includes(novedad.consorcioId));
    if (!visible) throw new NotFoundException(`La novedad ${id} no existe`);
    return novedad;
  }

  private async conLecturas(usuario: UsuarioActual, items: Novedad[]): Promise<NovedadVista[]> {
    const ids = items.map((n) => n.id);
    if (esGestor(usuario)) {
      const lecturas = await this.novedades.contarLecturas(ids);
      return items.map((n) => ({ ...n, lecturas: lecturas.get(n.id) ?? 0 }));
    }
    const leidas = await this.novedades.leidasPor(usuario.id, ids);
    return items.map((n) => ({ ...n, leida: leidas.has(n.id) }));
  }
}
