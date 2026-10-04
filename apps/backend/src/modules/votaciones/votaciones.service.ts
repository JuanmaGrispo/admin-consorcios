import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Notificador } from '../../core/notificaciones/notificador';
import {
  EstadoAsamblea,
  EstadoVotacion,
  ResultadoVotacion,
  RolUsuario,
  TipoPuntoOrden,
  Votacion,
  Voto,
} from '../../database/entities';
import { ArchivosService } from '../archivos/archivos.service';
import { DestinoArchivo } from '../archivos/tipos-archivo';
import { calcularQuorum } from '../asambleas/quorum';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { ExpensasService } from '../expensas/expensas.service';
import { CreateVotacionDto } from './dto/create-votacion.dto';
import { ListarVotacionesQuery } from './dto/listar-votaciones.query';
import { ReemplazarOpcionesDto } from './dto/reemplazar-opciones.dto';
import { UpdateVotacionDto } from './dto/update-votacion.dto';
import { VotarDto } from './dto/votar.dto';
import { VotoPresencialDto } from './dto/voto-presencial.dto';
import { escrutar, type Escrutinio } from './escrutinio';
import { armarPadron, pesoTotal, type UnidadHabilitada } from './padron';
import { ETIQUETA_A_FAVOR, ETIQUETA_EN_CONTRA, VotacionesRepository } from './votaciones.repository';


/** Si una votación de asamblea no dice cuánto dura, se toma la asamblea entera. */
const HORAS_POR_DEFECTO = 3;
const HORA_MS = 3600 * 1000;

const ASAMBLEA_CERRADA = [EstadoAsamblea.CERRADA, EstadoAsamblea.CERRADA_SIN_QUORUM];

const r2 = (n: number) => Math.round(n * 100) / 100;

type Canal = 'app' | 'presencial';

/** Lo que se muestra de un voto: nunca la entidad `Usuario` entera (trae el hash). */
function vistaVoto(voto: Voto) {
  return {
    unidadId: voto.unidadId,
    opcionId: voto.opcionId,
    anticipado: voto.anticipado,
    createdAt: voto.createdAt,
    emitidoPor: voto.emitidoPor
      ? { id: voto.emitidoPor.id, nombre: voto.emitidoPor.nombre, apellido: voto.emitidoPor.apellido }
      : { id: voto.emitidoPorId },
    cargadoPorLaAdministracion: voto.emitidoPor ? voto.emitidoPor.rol !== RolUsuario.VECINO : false,
  };
}

@Injectable()
export class VotacionesService {
  private readonly logger = new Logger(VotacionesService.name);

  constructor(
    private readonly votaciones: VotacionesRepository,
    private readonly consorcios: ConsorciosService,
    private readonly expensas: ExpensasService,
    private readonly archivos: ArchivosService,
    private readonly notificador: Notificador,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  async listar(usuario: UsuarioActual, query: ListarVotacionesQuery) {
    await this.cerrarVencidas();
    const filtro = esGestor(usuario)
      ? { consorcioIds: consorciosGestionados(usuario), ocultarBorradores: false }
      : { consorcioIds: await this.votaciones.consorciosDelUsuario(usuario.id), ocultarBorradores: true };
    return this.votaciones.listar(query, filtro);
  }

  async findOne(usuario: UsuarioActual, id: string) {
    await this.cerrarVencidas();
    const votacion = await this.buscarConPermiso(usuario, id);
    const { padron, votos, escrutinio } = await this.contar(votacion);
    const total = pesoTotal(padron);

    if (esGestor(usuario)) {
      return {
        ...votacion,
        padron: { unidades: padron.size, pesoTotal: total },
        escrutinio,
      };
    }

    const misUnidades = [...padron.values()]
      .filter((u) => u.votantes.includes(usuario.id))
      .map((u) => {
        const voto = votos.find((v) => v.unidadId === u.unidadId);
        return {
          unidadId: u.unidadId,
          etiqueta: u.etiqueta,
          // "Tu voto vale 1,74%": sobre el padrón, no sobre lo emitido.
          pesoPorcentaje: total > 0 ? r2((u.peso / total) * 100) : 0,
          voto: voto ? vistaVoto(voto) : null,
        };
      });
    const verParcial = votacion.mostrarParcial || votacion.estado === EstadoVotacion.CERRADA;
    return { ...votacion, misUnidades, escrutinio: verParcial ? escrutinio : null };
  }

  /** El padrón con quién votó y por qué canal: para que el admin sepa a quién le falta. */
  async padronConVotos(usuario: UsuarioActual, id: string) {
    await this.cerrarVencidas();
    const votacion = await this.exigirVotacion(usuario, id);
    const { padron, votos } = await this.contar(votacion);
    return [...padron.values()].map((u) => {
      const voto = votos.find((v) => v.unidadId === u.unidadId);
      return { unidadId: u.unidadId, etiqueta: u.etiqueta, peso: u.peso, voto: voto ? vistaVoto(voto) : null };
    });
  }

  /** Para el inicio del vecino. */
  async abiertasDelVecino(usuario: UsuarioActual): Promise<Votacion[]> {
    await this.cerrarVencidas();
    const consorcioIds = await this.votaciones.consorciosDelUsuario(usuario.id);
    if (consorcioIds.length === 0) return [];
    return this.votaciones.abiertas(consorcioIds);
  }

  // ── ABM ────────────────────────────────────────────────────────────────────

  async crear(usuario: UsuarioActual, dto: CreateVotacionDto) {
    if (!gestiona(usuario, dto.consorcioId)) {
      throw new NotFoundException(`Consorcio ${dto.consorcioId} no existe`);
    }
    let asambleaId: string | null = null;
    let apertura = dto.apertura ? new Date(dto.apertura) : undefined;
    let cierre = dto.cierre ? new Date(dto.cierre) : undefined;

    if (dto.puntoOrdenDiaId) {
      const punto = await this.votaciones.findPunto(dto.puntoOrdenDiaId);
      if (!punto) throw new BadRequestException('Ese punto del orden del día no existe');
      if (punto.tipo !== TipoPuntoOrden.CON_VOTACION) {
        throw new BadRequestException('El punto no es CON_VOTACION: no se vota');
      }
      if (punto.asamblea.consorcioId !== dto.consorcioId) {
        throw new BadRequestException('El punto es de una asamblea de otro consorcio');
      }
      if (ASAMBLEA_CERRADA.includes(punto.asamblea.estado)) {
        throw new ConflictException('La asamblea ya está cerrada');
      }
      if (await this.votaciones.puntoTieneVotacion(punto.id)) {
        throw new ConflictException('Ese punto del orden del día ya tiene su votación');
      }
      asambleaId = punto.asambleaId;
      apertura ??= punto.asamblea.fechaHora;
      cierre ??= new Date(apertura.getTime() + HORAS_POR_DEFECTO * HORA_MS);
    } else {
      await this.consorcios.findOne(dto.consorcioId);
      if (!apertura || !cierre) {
        throw new BadRequestException('Una votación independiente necesita apertura y cierre');
      }
    }

    exigirVentana(apertura, cierre);
    const extras = exigirExtrasValidas(dto.opciones ?? []);
    if (dto.adjuntoUrl) this.archivos.exigirPropia(dto.adjuntoUrl, DestinoArchivo.VOTACIONES);

    const id = await this.votaciones.crear(
      {
        consorcioId: dto.consorcioId,
        asambleaId,
        puntoOrdenDiaId: dto.puntoOrdenDiaId ?? null,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        adjuntoUrl: dto.adjuntoUrl ?? null,
        padron: dto.padron,
        formaConteo: dto.formaConteo,
        mayoria: dto.mayoria,
        desempate: dto.desempate,
        permiteVotoAnticipado: dto.permiteVotoAnticipado,
        mostrarParcial: dto.mostrarParcial,
        bloqueaConDeuda: dto.bloqueaConDeuda,
        apertura,
        cierre,
      },
      extras,
    );
    return this.findOne(usuario, id);
  }

  async editar(usuario: UsuarioActual, id: string, dto: UpdateVotacionDto) {
    const votacion = await this.exigirVotacion(usuario, id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'editar');

    const apertura = dto.apertura ? new Date(dto.apertura) : votacion.apertura;
    const cierre = dto.cierre ? new Date(dto.cierre) : votacion.cierre;
    exigirVentana(apertura, cierre);
    if (dto.adjuntoUrl && dto.adjuntoUrl !== votacion.adjuntoUrl) {
      this.archivos.exigirPropia(dto.adjuntoUrl, DestinoArchivo.VOTACIONES);
    }

    const { apertura: _a, cierre: _c, ...resto } = dto;
    await this.votaciones.actualizar(id, { ...resto, apertura, cierre });
    return this.findOne(usuario, id);
  }

  async reemplazarOpciones(usuario: UsuarioActual, id: string, dto: ReemplazarOpcionesDto) {
    const votacion = await this.exigirVotacion(usuario, id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'cambiar las opciones de');
    await this.votaciones.reemplazarOpciones(id, exigirExtrasValidas(dto.opciones));
    return this.findOne(usuario, id);
  }

  async eliminar(usuario: UsuarioActual, id: string): Promise<void> {
    const votacion = await this.exigirVotacion(usuario, id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'eliminar');
    await this.votaciones.eliminar(id);
  }

  // ── Ciclo ──────────────────────────────────────────────────────────────────

  async publicar(usuario: UsuarioActual, id: string) {
    const votacion = await this.exigirVotacion(usuario, id);
    exigirEstado(votacion, [EstadoVotacion.BORRADOR], 'publicar');

    if (votacion.asamblea) {
      if (![EstadoAsamblea.CONVOCADA, EstadoAsamblea.EN_CURSO].includes(votacion.asamblea.estado)) {
        throw new ConflictException('Se publica con la asamblea convocada o en curso');
      }
    } else if (votacion.cierre.getTime() <= Date.now()) {
      throw new BadRequestException('El cierre ya pasó: corregilo antes de publicar');
    }

    await this.votaciones.actualizar(id, { estado: EstadoVotacion.ABIERTA });
    await this.avisarPublicacion(votacion);
    return this.findOne(usuario, id);
  }

  async cerrar(usuario: UsuarioActual, id: string) {
    const votacion = await this.exigirVotacion(usuario, id);
    exigirEstado(votacion, [EstadoVotacion.ABIERTA], 'cerrar');
    await this.cerrarVotacion(votacion);
    return this.findOne(usuario, id);
  }

  // ── Votos ──────────────────────────────────────────────────────────────────

  async votar(usuario: UsuarioActual, id: string, dto: VotarDto) {
    if (esGestor(usuario)) {
      throw new ForbiddenException('La administración carga votos presenciales, por unidad');
    }
    await this.cerrarVencidas();
    const votacion = await this.buscarConPermiso(usuario, id);
    const { anticipado } = exigirQueAcepteVotos(votacion, 'app');

    const padron = await this.padronDe(votacion);
    const mias = [...padron.values()].filter((u) => u.votantes.includes(usuario.id));
    const unidad = elegirUnidad(mias, dto.unidadId);
    return this.emitir(votacion, unidad, dto.opcionId, usuario, anticipado);
  }

  async votarPresencial(usuario: UsuarioActual, id: string, unidadId: string, dto: VotoPresencialDto) {
    await this.cerrarVencidas();
    const votacion = await this.exigirVotacion(usuario, id);
    exigirQueAcepteVotos(votacion, 'presencial');

    const unidad = (await this.padronDe(votacion)).get(unidadId);
    if (!unidad) throw new BadRequestException('Esa unidad no está en el padrón de esta votación');
    return this.emitir(votacion, unidad, dto.opcionId, usuario, false);
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private async emitir(
    votacion: Votacion,
    unidad: UnidadHabilitada,
    opcionId: string,
    usuario: UsuarioActual,
    anticipado: boolean,
  ) {
    if (!votacion.opcionVotos?.some((o) => o.id === opcionId)) {
      throw new BadRequestException('Esa opción no es de esta votación');
    }
    if (votacion.bloqueaConDeuda && (await this.expensas.tieneDeudaVencida(unidad.unidadId))) {
      throw new ForbiddenException('La unidad tiene expensas vencidas: no puede votar en esta votación');
    }

    const previo = await this.votaciones.findVoto(votacion.id, unidad.unidadId);
    if (previo) throw yaVoto(unidad, previo);

    const voto = await this.votaciones.crearVoto({
      votacionId: votacion.id,
      unidadId: unidad.unidadId,
      opcionId,
      emitidoPorId: usuario.id,
      coeficienteAplicado: unidad.peso,
      anticipado,
    });
    // Otro voto de la misma unidad entró entre el chequeo y el INSERT.
    if (!voto) throw yaVoto(unidad, await this.votaciones.findVoto(votacion.id, unidad.unidadId));
    return vistaVoto(voto);
  }

  private async padronDe(votacion: Votacion) {
    const unidades = await this.votaciones.unidadesParaPadron(votacion.consorcioId);
    return armarPadron(unidades, votacion.padron, votacion.formaConteo);
  }

  private async contar(
    votacion: Votacion,
    sinQuorum = false,
  ): Promise<{ padron: Map<string, UnidadHabilitada>; votos: Voto[]; escrutinio: Escrutinio }> {
    const padron = await this.padronDe(votacion);
    const votos = await this.votaciones.votosDe(votacion.id);
    const opciones = votacion.opcionVotos ?? [];
    const fija = (etiqueta: string) => opciones.find((o) => o.esFija && o.etiqueta === etiqueta)?.id ?? '';

    const escrutinio = escrutar(
      opciones.map((o) => ({ id: o.id, etiqueta: o.etiqueta })),
      votos.map((v) => ({ opcionId: v.opcionId, peso: v.coeficienteAplicado })),
      {
        mayoria: votacion.mayoria,
        desempate: votacion.desempate,
        aFavorId: fija(ETIQUETA_A_FAVOR),
        enContraId: fija(ETIQUETA_EN_CONTRA),
        pesoPadron: pesoTotal(padron),
        sinQuorum,
      },
    );
    return { padron, votos, escrutinio };
  }

  /** Una de asamblea sin quórum en la asamblea no decide nada: queda SIN_QUORUM. */
  private async cerrarVotacion(votacion: Votacion): Promise<ResultadoVotacion> {
    let sinQuorum = false;
    if (votacion.asambleaId && votacion.asamblea) {
      const asistencias = await this.votaciones.asistenciasDe(votacion.asambleaId);
      sinQuorum = !calcularQuorum(asistencias, votacion.asamblea.quorumRequerido).alcanzado;
    }
    const { escrutinio } = await this.contar(votacion, sinQuorum);
    await this.votaciones.actualizar(votacion.id, {
      estado: EstadoVotacion.CERRADA,
      resultado: escrutinio.resultado,
    });
    return escrutinio.resultado;
  }

  /** Sin cron: cada consulta cierra las independientes que ya pasaron su cierre. */
  private async cerrarVencidas(): Promise<void> {
    for (const votacion of await this.votaciones.abiertasVencidas()) {
      await this.cerrarVotacion(votacion);
    }
  }

  /** 404 y no 403 para lo que no puede ver: un 403 confirmaría que existe. */
  private async exigirVotacion(usuario: UsuarioActual, id: string): Promise<Votacion> {
    const votacion = await this.votaciones.findById(id);
    if (!votacion || !gestiona(usuario, votacion.consorcioId)) {
      throw new NotFoundException(`La votación ${id} no existe`);
    }
    return votacion;
  }

  private async buscarConPermiso(usuario: UsuarioActual, id: string): Promise<Votacion> {
    if (esGestor(usuario)) return this.exigirVotacion(usuario, id);

    const votacion = await this.votaciones.findById(id);
    if (!votacion) throw new NotFoundException(`La votación ${id} no existe`);
    const consorcios = await this.votaciones.consorciosDelUsuario(usuario.id);
    if (votacion.estado === EstadoVotacion.BORRADOR || !consorcios.includes(votacion.consorcioId)) {
      throw new NotFoundException(`La votación ${id} no existe`);
    }
    return votacion;
  }

  /** Nunca corta la operación: si el aviso falla, la votación ya quedó publicada. */
  private async avisarPublicacion(votacion: Votacion) {
    try {
      const vecinos = await this.votaciones.vecinosDelConsorcio(votacion.consorcioId);
      const cierre = votacion.cierre.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
      });
      await Promise.allSettled(
        vecinos.map((destinatarioId) =>
          this.notificador.enviar({
            destinatarioId,
            asunto: `Nueva votación: ${votacion.titulo}`,
            cuerpo: `Se abrió la votación "${votacion.titulo}". Cierra el ${cierre}.`,
            origen: `votacion:${votacion.id}`,
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(`No se pudo avisar la votación ${votacion.id}: ${String(error)}`);
    }
  }
}

function exigirEstado(votacion: Votacion, permitidos: EstadoVotacion[], accion: string) {
  if (!permitidos.includes(votacion.estado)) {
    throw new ConflictException(`No se puede ${accion} una votación en estado ${votacion.estado}`);
  }
}

function exigirVentana(apertura: Date, cierre: Date) {
  if (Number.isNaN(apertura.getTime()) || Number.isNaN(cierre.getTime())) {
    throw new BadRequestException('Apertura y cierre tienen que ser fechas válidas');
  }
  if (cierre.getTime() <= apertura.getTime()) {
    throw new BadRequestException('El cierre tiene que ser posterior a la apertura');
  }
}

/** Sin repetidas, y ninguna que se haga pasar por "A favor" o "En contra". */
function exigirExtrasValidas(extras: string[]): string[] {
  const limpias = extras.map((e) => e.trim());
  const vistas = new Set([ETIQUETA_A_FAVOR.toLowerCase(), ETIQUETA_EN_CONTRA.toLowerCase()]);
  for (const etiqueta of limpias) {
    const clave = etiqueta.toLowerCase();
    if (vistas.has(clave)) {
      throw new BadRequestException(`La opción "${etiqueta}" está repetida o es una de las fijas`);
    }
    vistas.add(clave);
  }
  return limpias;
}

/**
 * Cuándo se acepta un voto. Independiente: entre apertura y cierre, sólo desde
 * la app. De asamblea: con la asamblea en curso; desde la app también antes,
 * si la votación permite voto anticipado.
 */
function exigirQueAcepteVotos(votacion: Votacion, canal: Canal): { anticipado: boolean } {
  if (votacion.estado !== EstadoVotacion.ABIERTA) {
    throw new ConflictException('La votación no está abierta');
  }

  if (!votacion.asambleaId) {
    if (canal === 'presencial') {
      throw new BadRequestException('Una votación independiente se vota sólo desde la app');
    }
    const ahora = Date.now();
    if (ahora < votacion.apertura.getTime()) throw new ConflictException('La votación todavía no abrió');
    if (ahora >= votacion.cierre.getTime()) throw new ConflictException('La votación ya cerró');
    return { anticipado: false };
  }

  const estado = votacion.asamblea?.estado;
  if (estado === EstadoAsamblea.EN_CURSO) return { anticipado: false };
  if (canal === 'app' && votacion.permiteVotoAnticipado && estado === EstadoAsamblea.CONVOCADA) {
    return { anticipado: true };
  }
  throw new ConflictException('Esta votación se vota durante la asamblea');
}

function elegirUnidad(mias: UnidadHabilitada[], pedida?: string): UnidadHabilitada {
  if (mias.length === 0) {
    throw new ForbiddenException('No estás habilitado para votar en esta votación');
  }
  if (pedida) {
    const unidad = mias.find((u) => u.unidadId === pedida);
    if (!unidad) throw new ForbiddenException('No podés votar por esa unidad');
    return unidad;
  }
  if (mias.length > 1) {
    throw new BadRequestException('Votás por más de una unidad: indicá por cuál');
  }
  return mias[0];
}

function yaVoto(unidad: UnidadHabilitada, voto: Voto | null): ConflictException {
  if (!voto) return new ConflictException(`La unidad ${unidad.etiqueta} ya votó`);
  const cuando = voto.createdAt.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const canal =
    voto.emitidoPor && voto.emitidoPor.rol !== RolUsuario.VECINO
      ? 'lo cargó la administración'
      : 'desde la app';
  return new ConflictException(`La unidad ${unidad.etiqueta} ya votó el ${cuando} (${canal})`);
}
