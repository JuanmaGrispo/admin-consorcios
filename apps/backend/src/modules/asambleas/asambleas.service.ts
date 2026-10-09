import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PublicadorEventos } from '../../core/mensajeria/publicador-eventos';
import {
  Asamblea,
  Asistencia,
  EstadoAsamblea,
  EstadoAsistencia,
  ModalidadAsamblea,
} from '../../database/entities';
import { ArchivosService } from '../archivos/archivos.service';
import { DestinoArchivo } from '../archivos/tipos-archivo';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { AsambleasRepository } from './asambleas.repository';
import { CargarActaDto } from './dto/cargar-acta.dto';
import { ConfirmarAsistenciaDto } from './dto/confirmar-asistencia.dto';
import { CreateAsambleaDto } from './dto/create-asamblea.dto';
import { ListarAsambleasQuery } from './dto/listar-asambleas.query';
import { RegistrarAsistenciaDto } from './dto/registrar-asistencia.dto';
import { ReemplazarOrdenDiaDto } from './dto/reemplazar-orden-dia.dto';
import { UpdateAsambleaDto } from './dto/update-asamblea.dto';
import { datosDeAsamblea } from './datos-evento';
import { generarActaPdf } from './acta-pdf';
import { calcularQuorum, porcentajeDeQuorum } from './quorum';

const QUORUM_POR_DEFECTO = 60;
const ULTIMAS_CONFIRMACIONES = 10;

/** Mientras se puede responder la asistencia. */
const ASISTENCIA_ABIERTA = [EstadoAsamblea.CONVOCADA, EstadoAsamblea.EN_CURSO];
const CERRADAS = [EstadoAsamblea.CERRADA, EstadoAsamblea.CERRADA_SIN_QUORUM];

/** Lo que se muestra de una asistencia: nunca la entidad `Usuario` entera (trae el hash). */
function vistaAsistencia(a: Asistencia) {
  return {
    id: a.id,
    unidadId: a.unidadId,
    unidad: a.unidad ? { id: a.unidad.id, etiqueta: a.unidad.etiqueta } : null,
    estado: a.estado,
    coeficienteAplicado: a.coeficienteAplicado,
    apoderadoUnidad: a.apoderadoUnidad
      ? { id: a.apoderadoUnidad.id, etiqueta: a.apoderadoUnidad.etiqueta }
      : null,
    confirmadaPor: a.confirmadaPor
      ? { id: a.confirmadaPor.id, nombre: a.confirmadaPor.nombre, apellido: a.confirmadaPor.apellido }
      : null,
    confirmadaAt: a.confirmadaAt,
  };
}

export type AsambleaDelVecino = Asamblea & {
  quorumPorcentaje: number | null;
  miAsistencia: EstadoAsistencia | null;
};

@Injectable()
export class AsambleasService {
  constructor(
    private readonly asambleas: AsambleasRepository,
    private readonly consorcios: ConsorciosService,
    private readonly eventos: PublicadorEventos,
    private readonly archivos: ArchivosService,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  async listar(usuario: UsuarioActual, query: ListarAsambleasQuery) {
    const filtro = esGestor(usuario)
      ? { consorcioIds: consorciosGestionados(usuario), ocultarBorradores: false }
      : { consorcioIds: await this.asambleas.consorciosDelUsuario(usuario.id), ocultarBorradores: true };

    const asambleas = await this.asambleas.listar(query, filtro);
    const agregados = await this.asambleas.agregadosQuorum(asambleas.map((a) => a.id));

    return asambleas.map((a) => {
      const agregado = agregados.get(a.id);
      return {
        ...a,
        quorumPorcentaje: agregado ? porcentajeDeQuorum(agregado.presente, agregado.total) : null,
      };
    });
  }

  async findOne(usuario: UsuarioActual, id: string) {
    const asamblea = await this.buscarConPermiso(usuario, id);
    const asistencias = await this.asambleas.asistencias(id);
    const quorum =
      asistencias.length > 0 ? calcularQuorum(asistencias, asamblea.quorumRequerido) : null;

    if (esGestor(usuario)) {
      const ultimasConfirmaciones = asistencias
        .filter((a) => a.confirmadaAt)
        .sort((x, y) => (y.confirmadaAt as Date).getTime() - (x.confirmadaAt as Date).getTime())
        .slice(0, ULTIMAS_CONFIRMACIONES)
        .map(vistaAsistencia);
      return { ...asamblea, quorum, ultimasConfirmaciones };
    }

    // El vecino no ve nombres de otros vecinos: sólo cómo respondió por sus unidades.
    const mias = await this.asambleas.unidadesDelUsuarioEnConsorcio(usuario.id, asamblea.consorcioId);
    const miAsistencia = asistencias.filter((a) => mias.includes(a.unidadId)).map(vistaAsistencia);
    return { ...asamblea, quorum, miAsistencia };
  }

  /** Para la pantalla de inicio: las asambleas convocadas o en curso de sus consorcios. */
  /** Publica `asamblea.recordatorio` para las que empiezan dentro de 48 h. Lo dispara el cron. */
  async enviarRecordatorios(): Promise<number> {
    const asambleas = await this.asambleas.marcarParaRecordatorio();
    for (const asamblea of asambleas) {
      this.eventos.publicar('asamblea.recordatorio', asamblea.consorcioId, datosDeAsamblea(asamblea));
    }
    return asambleas.length;
  }

  /**
   * Para la pantalla de inicio: las convocadas o en curso de sus consorcios,
   * con el quórum de hoy y lo que respondió por sus unidades ("Confirmá tu
   * asistencia · quórum 54%"). `miAsistencia` es null si no tiene unidad convocada.
   */
  async proximasDelVecino(usuario: UsuarioActual): Promise<AsambleaDelVecino[]> {
    const consorcioIds = await this.asambleas.consorciosDelUsuario(usuario.id);
    if (consorcioIds.length === 0) return [];
    const asambleas = await this.asambleas.proximas(consorcioIds);
    const ids = asambleas.map((a) => a.id);
    const [agregados, mias] = await Promise.all([
      this.asambleas.agregadosQuorum(ids),
      this.asambleas.unidadesDelUsuario(usuario.id).then((u) => this.asambleas.asistenciasDeUnidades(ids, u)),
    ]);

    return asambleas.map((a) => {
      const agregado = agregados.get(a.id);
      const respuestas = mias.filter((m) => m.asambleaId === a.id);
      return {
        ...a,
        quorumPorcentaje: agregado ? porcentajeDeQuorum(agregado.presente, agregado.total) : null,
        // Con varias unidades, alcanza con que falte responder por una.
        miAsistencia:
          respuestas.length === 0
            ? null
            : (respuestas.find((r) => r.estado === EstadoAsistencia.SIN_RESPONDER) ?? respuestas[0]).estado,
      };
    });
  }

  async listarAsistencias(usuario: UsuarioActual, id: string) {
    await this.exigirAsamblea(usuario, id);
    const asistencias = await this.asambleas.asistencias(id);
    return asistencias.map(vistaAsistencia);
  }

  // ── ABM ────────────────────────────────────────────────────────────────────

  async crear(usuario: UsuarioActual, dto: CreateAsambleaDto) {
    if (!gestiona(usuario, dto.consorcioId)) {
      throw new NotFoundException(`Consorcio ${dto.consorcioId} no existe`);
    }
    await this.consorcios.findOne(dto.consorcioId);

    const modalidad = dto.modalidad ?? ModalidadAsamblea.PRESENCIAL;
    const fechaHora = new Date(dto.fechaHora);
    exigirFechaFutura(fechaHora);
    validarModalidad(modalidad, dto.lugar, dto.linkVideollamada);

    const id = await this.asambleas.crear(
      {
        consorcioId: dto.consorcioId,
        creadaPorId: usuario.id,
        titulo: dto.titulo,
        tipo: dto.tipo,
        modalidad,
        fechaHora,
        lugar: dto.lugar ?? null,
        linkVideollamada: dto.linkVideollamada ?? null,
        quorumRequerido: dto.quorumRequerido ?? QUORUM_POR_DEFECTO,
      },
      dto.puntos ?? [],
    );
    return this.findOne(usuario, id);
  }

  async editar(usuario: UsuarioActual, id: string, dto: UpdateAsambleaDto) {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'editar');

    // Se valida el resultado final, no sólo lo que vino en el PATCH.
    const modalidad = dto.modalidad ?? asamblea.modalidad;
    const lugar = dto.lugar !== undefined ? dto.lugar : asamblea.lugar;
    const link = dto.linkVideollamada !== undefined ? dto.linkVideollamada : asamblea.linkVideollamada;
    validarModalidad(modalidad, lugar, link);

    const fechaHora = dto.fechaHora ? new Date(dto.fechaHora) : undefined;
    if (fechaHora) exigirFechaFutura(fechaHora);

    await this.asambleas.actualizar(id, {
      ...(dto.titulo !== undefined && { titulo: dto.titulo }),
      ...(dto.tipo !== undefined && { tipo: dto.tipo }),
      ...(dto.quorumRequerido !== undefined && { quorumRequerido: dto.quorumRequerido }),
      ...(fechaHora && { fechaHora }),
      modalidad,
      lugar: lugar ?? null,
      linkVideollamada: link ?? null,
    });
    return this.findOne(usuario, id);
  }

  async reemplazarOrdenDia(usuario: UsuarioActual, id: string, dto: ReemplazarOrdenDiaDto) {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'cambiar el orden del día de');
    await this.asambleas.reemplazarOrdenDia(id, dto.puntos);
    return this.findOne(usuario, id);
  }

  async eliminar(usuario: UsuarioActual, id: string): Promise<void> {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'eliminar');
    await this.asambleas.eliminar(id);
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  /**
   * Arma el padrón: una asistencia por unidad activa con su coeficiente de hoy.
   * Si después se edita una unidad, el quórum de esta asamblea no cambia.
   */
  async convocar(usuario: UsuarioActual, id: string) {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, [EstadoAsamblea.BORRADOR], 'convocar');
    if (!asamblea.puntoOrdenDias?.length) {
      throw new BadRequestException('Cargá al menos un punto del orden del día antes de convocar');
    }
    exigirFechaFutura(asamblea.fechaHora);

    const unidades = await this.asambleas.unidadesActivas(asamblea.consorcioId);
    if (unidades.length === 0) {
      throw new BadRequestException('El consorcio no tiene unidades activas para convocar');
    }

    await this.asambleas.convocar(
      id,
      unidades.map((u) => ({ unidadId: u.id, coeficienteAplicado: u.coeficiente })),
    );
    this.eventos.publicar('asamblea.creada', asamblea.consorcioId, datosDeAsamblea(asamblea));
    return this.findOne(usuario, id);
  }

  /** No exige quórum: se puede esperar o pasar a segunda convocatoria. */
  async iniciar(usuario: UsuarioActual, id: string) {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, [EstadoAsamblea.CONVOCADA], 'iniciar');
    await this.asambleas.actualizar(id, { estado: EstadoAsamblea.EN_CURSO });
    return this.findOne(usuario, id);
  }

  /** El estado final lo decide el quórum alcanzado, no el administrador. */
  async cerrar(usuario: UsuarioActual, id: string) {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, [EstadoAsamblea.EN_CURSO], 'cerrar');
    if ((await this.asambleas.votacionesAbiertas(id)) > 0) {
      throw new ConflictException('Cerrá primero las votaciones abiertas de esta asamblea');
    }

    const quorum = calcularQuorum(await this.asambleas.asistencias(id), asamblea.quorumRequerido);
    const estado = quorum.alcanzado ? EstadoAsamblea.CERRADA : EstadoAsamblea.CERRADA_SIN_QUORUM;
    await this.asambleas.actualizar(id, { estado });
    return this.findOne(usuario, id);
  }

  /**
   * El borrador del acta en PDF ("Descargar acta" del detalle): quórum,
   * asistencia, orden del día y resultados, para completar, firmar y después
   * subir como acta definitiva con `PATCH /asambleas/:id/acta`.
   */
  async actaBorrador(usuario: UsuarioActual, id: string): Promise<{ buffer: Buffer; nombre: string }> {
    const asamblea = await this.exigirAsamblea(usuario, id);
    const [consorcio, asistencias, votaciones] = await Promise.all([
      this.consorcios.findOne(asamblea.consorcioId),
      this.asambleas.asistencias(id),
      this.asambleas.votacionesDe(id),
    ]);
    const quorum = asistencias.length > 0 ? calcularQuorum(asistencias, asamblea.quorumRequerido) : null;
    const buffer = await generarActaPdf({ asamblea, consorcio, quorum, asistencias, votaciones });
    const fecha = asamblea.fechaHora.toISOString().slice(0, 10);
    return { buffer, nombre: `acta-borrador-${fecha}.pdf` };
  }

  /** El PDF se sube antes con `POST /archivos?destino=actas`; acá sólo se guarda su URL. */
  async cargarActa(usuario: UsuarioActual, id: string, dto: CargarActaDto) {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, CERRADAS, 'cargar el acta de');
    this.archivos.exigirPropia(dto.actaUrl, DestinoArchivo.ACTAS);
    await this.asambleas.actualizar(id, { actaUrl: dto.actaUrl });
    return this.findOne(usuario, id);
  }

  // ── Asistencia ─────────────────────────────────────────────────────────────

  async confirmarAsistencia(usuario: UsuarioActual, id: string, dto: ConfirmarAsistenciaDto) {
    if (esGestor(usuario)) {
      throw new ForbiddenException('El administrador registra la asistencia desde el padrón');
    }
    const asamblea = await this.buscarConPermiso(usuario, id);
    exigirEstado(asamblea, ASISTENCIA_ABIERTA, 'responder la asistencia de');

    const unidadId = await this.resolverUnidad(usuario, asamblea.consorcioId, dto.unidadId);
    const asistencia = await this.exigirAsistencia(id, unidadId);

    await this.asambleas.guardarAsistencia(asistencia.id, {
      estado: dto.estado,
      apoderadoUnidadId: null,
      confirmadaPorId: usuario.id,
      confirmadaAt: new Date(),
    });
    return vistaAsistencia(await this.exigirAsistencia(id, unidadId));
  }

  async registrarAsistencia(
    usuario: UsuarioActual,
    id: string,
    unidadId: string,
    dto: RegistrarAsistenciaDto,
  ) {
    const asamblea = await this.exigirAsamblea(usuario, id);
    exigirEstado(asamblea, ASISTENCIA_ABIERTA, 'registrar asistencia en');
    const asistencia = await this.exigirAsistencia(id, unidadId);

    let apoderadoUnidadId: string | null = null;
    if (dto.estado === EstadoAsistencia.CON_PODER) {
      if (!dto.apoderadoUnidadId) {
        throw new BadRequestException('Indicá qué unidad tiene el poder');
      }
      if (dto.apoderadoUnidadId === unidadId) {
        throw new BadRequestException('Una unidad no puede ser su propia apoderada');
      }
      if (!(await this.asambleas.findAsistencia(id, dto.apoderadoUnidadId))) {
        throw new BadRequestException('La unidad apoderada no está convocada a esta asamblea');
      }
      apoderadoUnidadId = dto.apoderadoUnidadId;
    }

    await this.asambleas.guardarAsistencia(asistencia.id, {
      estado: dto.estado,
      apoderadoUnidadId,
      confirmadaPorId: usuario.id,
      confirmadaAt: new Date(),
    });
    return vistaAsistencia(await this.exigirAsistencia(id, unidadId));
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  /** 404 y no 403 para lo que no puede ver: un 403 confirmaría que existe. */
  private async exigirAsamblea(usuario: UsuarioActual, id: string): Promise<Asamblea> {
    const asamblea = await this.asambleas.findById(id);
    if (!asamblea || !gestiona(usuario, asamblea.consorcioId)) {
      throw new NotFoundException(`La asamblea ${id} no existe`);
    }
    return asamblea;
  }

  private async buscarConPermiso(usuario: UsuarioActual, id: string): Promise<Asamblea> {
    if (esGestor(usuario)) return this.exigirAsamblea(usuario, id);

    const asamblea = await this.asambleas.findById(id);
    if (!asamblea) throw new NotFoundException(`La asamblea ${id} no existe`);
    const consorcios = await this.asambleas.consorciosDelUsuario(usuario.id);
    if (asamblea.estado === EstadoAsamblea.BORRADOR || !consorcios.includes(asamblea.consorcioId)) {
      throw new NotFoundException(`La asamblea ${id} no existe`);
    }
    return asamblea;
  }

  private async exigirAsistencia(asambleaId: string, unidadId: string): Promise<Asistencia> {
    const asistencia = await this.asambleas.findAsistencia(asambleaId, unidadId);
    if (!asistencia) {
      throw new NotFoundException('Esa unidad no está convocada a esta asamblea');
    }
    return asistencia;
  }

  /** Si el vecino tiene una sola unidad en el consorcio, se infiere. */
  private async resolverUnidad(
    usuario: UsuarioActual,
    consorcioId: string,
    pedida?: string,
  ): Promise<string> {
    const unidades = await this.asambleas.unidadesDelUsuarioEnConsorcio(usuario.id, consorcioId);
    if (pedida) {
      if (!unidades.includes(pedida)) throw new ForbiddenException('Esa unidad no es tuya');
      return pedida;
    }
    if (unidades.length > 1) {
      throw new BadRequestException('Tenés más de una unidad: indicá por cuál respondés');
    }
    if (unidades.length === 0) {
      throw new ForbiddenException('No tenés unidades en este consorcio');
    }
    return unidades[0];
  }
}

function exigirEstado(asamblea: Asamblea, permitidos: EstadoAsamblea[], accion: string) {
  if (!permitidos.includes(asamblea.estado)) {
    throw new ConflictException(`No se puede ${accion} una asamblea en estado ${asamblea.estado}`);
  }
}

function exigirFechaFutura(fecha: Date) {
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() <= Date.now()) {
    throw new BadRequestException('La fecha de la asamblea tiene que ser futura');
  }
}

/** Presencial pide lugar; digital, link; híbrida, los dos. */
function validarModalidad(
  modalidad: ModalidadAsamblea,
  lugar: string | null | undefined,
  link: string | null | undefined,
) {
  const pideLugar = modalidad !== ModalidadAsamblea.DIGITAL;
  const pideLink = modalidad !== ModalidadAsamblea.PRESENCIAL;
  if (pideLugar && !lugar) {
    throw new BadRequestException(`Una asamblea ${modalidad.toLowerCase()} necesita un lugar`);
  }
  if (pideLink && !link) {
    throw new BadRequestException(
      `Una asamblea ${modalidad.toLowerCase()} necesita el link de la videollamada`,
    );
  }
}
