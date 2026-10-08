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
  Amenity,
  AmenityBloqueo,
  EstadoReserva,
  Reserva,
} from '../../database/entities';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { ExpensasService } from '../expensas/expensas.service';
import { CrearBloqueoDto } from './dto/crear-bloqueo.dto';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { DisponibilidadQuery } from './dto/disponibilidad.query';
import { ListarAmenitiesQuery } from './dto/listar-amenities.query';
import { ListarBloqueosQuery } from './dto/listar-bloqueos.query';
import { ListarReservasQuery } from './dto/listar-reservas.query';
import { RechazarReservaDto } from './dto/rechazar-reserva.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import {
  cierraAlDiaSiguiente,
  largoDeVentana,
  ProblemaFranja,
  validarFranja,
  ZONA_POR_DEFECTO,
} from './horario';
import { ReservasRepository } from './reservas.repository';

const CANCELABLES = [EstadoReserva.PENDIENTE, EstadoReserva.APROBADA];

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    private readonly reservas: ReservasRepository,
    private readonly consorcios: ConsorciosService,
    private readonly expensas: ExpensasService,
    private readonly notificador: Notificador,
  ) {}

  // ── Amenities ──────────────────────────────────────────────────────────────

  async listarAmenities(
    usuario: UsuarioActual,
    query: ListarAmenitiesQuery,
  ): Promise<Amenity[]> {
    const administra = esGestor(usuario);
    return this.reservas.listarAmenities({
      query: { ...query, incluirInactivos: administra && query.incluirInactivos },
      consorciosPermitidos: administra
        ? consorciosGestionados(usuario)
        : await this.reservas.consorciosDelUsuario(usuario.id),
    });
  }

  async findAmenity(usuario: UsuarioActual, id: string): Promise<Amenity> {
    const amenity = await this.reservas.findAmenityById(id);
    // Un amenity de otro edificio da 404: un 403 confirmaría que existe.
    if (!amenity || !(await this.puedeVer(usuario, amenity))) {
      throw new NotFoundException(`El amenity ${id} no existe`);
    }
    return amenity;
  }

  async crearAmenity(usuario: UsuarioActual, dto: CreateAmenityDto): Promise<Amenity> {
    if (!gestiona(usuario, dto.consorcioId)) {
      throw new NotFoundException(`Consorcio ${dto.consorcioId} no existe`);
    }
    await this.consorcios.findOne(dto.consorcioId);
    const horaApertura = dto.horaApertura ?? '08:00:00';
    const horaCierre = dto.horaCierre ?? '22:00:00';
    this.exigirVentanaCoherente(horaApertura, horaCierre, dto.duracionMaximaHoras ?? null);
    await this.exigirNombreLibre(dto.consorcioId, dto.nombre);

    return this.reservas.crearAmenity({ ...dto, horaApertura, horaCierre });
  }

  async actualizarAmenity(
    usuario: UsuarioActual,
    id: string,
    dto: UpdateAmenityDto,
  ): Promise<Amenity> {
    const amenity = await this.exigirAmenity(usuario, id);

    this.exigirVentanaCoherente(
      dto.horaApertura ?? amenity.horaApertura,
      dto.horaCierre ?? amenity.horaCierre,
      dto.duracionMaximaHoras ?? amenity.duracionMaximaHoras,
    );
    if (dto.nombre && dto.nombre.toLowerCase() !== amenity.nombre.toLowerCase()) {
      await this.exigirNombreLibre(amenity.consorcioId, dto.nombre);
    }

    return this.reservas.actualizarAmenity(amenity, dto);
  }

  /**
   * La ventana del día y lo que ya está tomado. Es lo que el portal necesita
   * para pintar el calendario sin adivinar las reglas del amenity.
   */
  async disponibilidad(usuario: UsuarioActual, id: string, query: DisponibilidadQuery) {
    await this.reservas.cerrarVencidas();
    const amenity = await this.findAmenity(usuario, id);
    const cruza = cierraAlDiaSiguiente(amenity.horaApertura, amenity.horaCierre);
    const { inicio, fin: finDelDia } = await this.reservas.instantes(
      query.fecha,
      '00:00',
      '24:00',
      ZONA_POR_DEFECTO,
    );
    // Si la ventana del día termina en la madrugada siguiente, lo ocupado
    // también se mira hasta ahí: si no, el calendario mostraría libre la
    // noche de una reserva de 20:00 a 02:00.
    const fin = cruza
      ? (await this.reservas.instantes(
          query.fecha,
          amenity.horaApertura,
          amenity.horaCierre,
          ZONA_POR_DEFECTO,
        )).fin
      : finDelDia;

    const [reservas, bloqueos] = await Promise.all([
      this.reservas.reservasEnRango(id, inicio, fin),
      this.reservas.bloqueosEnRango(id, inicio, fin),
    ]);

    return {
      fecha: query.fecha,
      horaApertura: amenity.horaApertura,
      horaCierre: amenity.horaCierre,
      cierraAlDiaSiguiente: cruza,
      duracionMaximaHoras: amenity.duracionMaximaHoras,
      anticipacionMinimaHoras: amenity.anticipacionMinimaHoras,
      requiereAprobacion: amenity.requiereAprobacion,
      ocupado: reservas.map((r) => ({
        reservaId: r.id,
        inicio: r.inicio,
        fin: r.fin,
        estado: r.estado,
      })),
      bloqueos: bloqueos.map((b) => ({ desde: b.desde, hasta: b.hasta, motivo: b.motivo })),
    };
  }

  /**
   * Para los accesos rápidos del inicio ("Reservar SUM · Libre hoy"): los
   * amenities activos que ve el usuario y si hoy tienen algo tomado.
   */
  async ocupacionDeHoy(usuario: UsuarioActual, fecha: string) {
    const amenities = (await this.listarAmenities(usuario, {})).filter((a) => a.activo);
    const { inicio, fin } = await this.reservas.instantes(fecha, '00:00', '24:00', ZONA_POR_DEFECTO);
    return Promise.all(
      amenities.map(async (a) => {
        const [reservas, bloqueos] = await Promise.all([
          this.reservas.reservasEnRango(a.id, inicio, fin),
          this.reservas.bloqueosEnRango(a.id, inicio, fin),
        ]);
        return {
          id: a.id,
          nombre: a.nombre,
          icono: a.icono,
          consorcioId: a.consorcioId,
          reservasHoy: reservas.length,
          bloqueadoHoy: bloqueos.length > 0,
          libreHoy: reservas.length === 0 && bloqueos.length === 0,
        };
      }),
    );
  }

  // ── Bloqueos ───────────────────────────────────────────────────────────────

  async listarBloqueos(
    usuario: UsuarioActual,
    amenityId: string,
    query: ListarBloqueosQuery,
  ): Promise<AmenityBloqueo[]> {
    await this.findAmenity(usuario, amenityId);
    return this.reservas.listarBloqueos(
      amenityId,
      query.desde ? await this.reservas.instante(`${query.desde} 00:00`, ZONA_POR_DEFECTO) : undefined,
      query.hasta ? await this.reservas.instante(`${query.hasta} 23:59`, ZONA_POR_DEFECTO) : undefined,
    );
  }

  async crearBloqueo(
    usuario: UsuarioActual,
    amenityId: string,
    dto: CrearBloqueoDto,
  ): Promise<AmenityBloqueo> {
    await this.reservas.cerrarVencidas();
    const amenity = await this.exigirAmenity(usuario, amenityId);

    const desde = await this.reservas.instante(dto.desde, ZONA_POR_DEFECTO);
    const hasta = await this.reservas.instante(dto.hasta, ZONA_POR_DEFECTO);
    if (hasta <= desde) {
      throw new BadRequestException('El bloqueo tiene que terminar después de empezar');
    }

    const { bloqueo, canceladas } = await this.reservas.crearBloqueo(
      amenityId,
      { amenityId, creadoPorId: usuario.id, desde, hasta, motivo: dto.motivo ?? null },
      async (pisadas) => {
        const vigentes = pisadas.filter((r) => CANCELABLES.includes(r.estado));
        // Rechazar por defecto: el administrador tiene que enterarse de que
        // está dejando gente sin el amenity, y decidirlo explícitamente.
        if (vigentes.length > 0 && !dto.cancelarReservas) {
          throw new ConflictException(
            `El bloqueo pisa ${vigentes.length} reserva(s). Mandá cancelarReservas: true para cancelarlas.`,
          );
        }
        return vigentes;
      },
    );

    for (const reserva of canceladas) {
      await this.avisar(
        reserva.solicitadaPorId,
        `Se canceló tu reserva de ${amenity.nombre}`,
        `El administrador bloqueó el amenity por mantenimiento${dto.motivo ? ` (${dto.motivo})` : ''}.`,
        `reserva:${reserva.id}`,
      );
    }

    return bloqueo;
  }

  async borrarBloqueo(usuario: UsuarioActual, amenityId: string, id: string): Promise<void> {
    await this.exigirAmenity(usuario, amenityId);
    const bloqueo = await this.reservas.findBloqueo(id);
    if (!bloqueo || bloqueo.amenityId !== amenityId) {
      throw new NotFoundException(`El bloqueo ${id} no existe`);
    }
    await this.reservas.borrarBloqueo(id);
  }

  // ── Reservas ───────────────────────────────────────────────────────────────

  async listar(usuario: UsuarioActual, query: ListarReservasQuery) {
    await this.reservas.cerrarVencidas();
    const { items, total } = await this.reservas.listar(query, await this.alcance(usuario));
    const limite = query.limite ?? 20;
    return { items, total, pagina: query.pagina ?? 1, paginas: Math.ceil(total / limite) || 1 };
  }

  async findOne(usuario: UsuarioActual, id: string): Promise<Reserva> {
    await this.reservas.cerrarVencidas();
    return this.buscarConPermiso(usuario, id);
  }

  async crear(usuario: UsuarioActual, dto: CrearReservaDto): Promise<Reserva> {
    await this.reservas.cerrarVencidas();

    const amenity = await this.exigirAmenity(usuario, dto.amenityId);
    if (!amenity.activo) {
      throw new BadRequestException(`El amenity ${amenity.nombre} está dado de baja`);
    }

    const unidadId = await this.resolverUnidad(usuario, dto.unidadId);
    await this.exigirMismoConsorcio(amenity, unidadId);

    const problema = validarFranja(dto.horaInicio, dto.horaFin, amenity);
    if (problema) throw new BadRequestException(this.mensajeDe(problema, amenity));

    const { inicio, fin, ahora } = await this.reservas.instantes(
      dto.fecha,
      dto.horaInicio,
      dto.horaFin,
      ZONA_POR_DEFECTO,
    );
    if (inicio <= ahora) {
      throw new BadRequestException('No se puede reservar un horario que ya pasó');
    }
    const horasDeAnticipacion = (inicio.getTime() - ahora.getTime()) / 3_600_000;
    if (horasDeAnticipacion < amenity.anticipacionMinimaHoras) {
      throw new BadRequestException(
        `${amenity.nombre} se reserva con al menos ${amenity.anticipacionMinimaHoras} horas de anticipación`,
      );
    }

    if (amenity.bloqueaConDeuda && (await this.expensas.tieneDeudaVencida(unidadId))) {
      throw new ConflictException(
        'La unidad tiene expensas vencidas: regularizá la deuda para poder reservar',
      );
    }

    const estado = amenity.requiereAprobacion
      ? EstadoReserva.PENDIENTE
      : EstadoReserva.APROBADA;

    const reserva = await this.reservas.crearReserva(
      amenity.id,
      {
        amenityId: amenity.id,
        unidadId,
        solicitadaPorId: usuario.id,
        inicio,
        fin,
        estado,
        motivo: dto.motivo ?? null,
        // La aprobación automática no la resolvió nadie: `resuelta_por` queda nulo.
        resueltaAt: amenity.requiereAprobacion ? null : ahora,
      },
      async (m) => {
        if (await this.reservas.haySolapamiento(amenity.id, inicio, fin, null, m)) {
          throw new ConflictException('Ese horario ya está reservado');
        }
        if (await this.reservas.hayBloqueo(amenity.id, inicio, fin, m)) {
          throw new ConflictException('El amenity está bloqueado por mantenimiento en ese horario');
        }
      },
    );

    if (estado === EstadoReserva.APROBADA) {
      await this.avisar(
        usuario.id,
        `Reservaste ${amenity.nombre}`,
        `Tu reserva quedó confirmada para el ${dto.fecha} de ${dto.horaInicio} a ${dto.horaFin}.`,
        `reserva:${reserva.id}`,
      );
    } else {
      const consorcio = await this.consorcios.findOne(amenity.consorcioId);
      await this.avisar(
        consorcio.administradorId,
        `Nueva reserva de ${amenity.nombre}`,
        `Hay una reserva para el ${dto.fecha} de ${dto.horaInicio} a ${dto.horaFin} esperando aprobación.`,
        `reserva:${reserva.id}`,
      );
    }

    return reserva;
  }

  async aprobar(usuario: UsuarioActual, id: string): Promise<Reserva> {
    await this.reservas.cerrarVencidas();
    const reserva = await this.exigirPendiente(usuario, id);

    // Entre el pedido y la aprobación pudo entrar un bloqueo o aprobarse otra
    // reserva, así que el calendario se vuelve a mirar.
    if (
      await this.reservas.haySolapamiento(
        reserva.amenityId,
        reserva.inicio,
        reserva.fin,
        reserva.id,
      )
    ) {
      throw new ConflictException('Ese horario ya está reservado');
    }
    if (await this.reservas.hayBloqueo(reserva.amenityId, reserva.inicio, reserva.fin)) {
      throw new ConflictException('El amenity está bloqueado por mantenimiento en ese horario');
    }

    const aprobada = await this.reservas.actualizarReserva(reserva, {
      estado: EstadoReserva.APROBADA,
      resueltaPorId: usuario.id,
      resueltaAt: await this.reservas.ahora(),
    });

    await this.avisar(
      reserva.solicitadaPorId,
      `Se aprobó tu reserva de ${reserva.amenity.nombre}`,
      'Ya podés usar el amenity en el horario que reservaste.',
      `reserva:${reserva.id}`,
    );

    return aprobada;
  }

  async rechazar(
    usuario: UsuarioActual,
    id: string,
    dto: RechazarReservaDto,
  ): Promise<Reserva> {
    await this.reservas.cerrarVencidas();
    const reserva = await this.exigirPendiente(usuario, id);

    const rechazada = await this.reservas.actualizarReserva(reserva, {
      estado: EstadoReserva.RECHAZADA,
      motivoRechazo: dto.motivoRechazo,
      resueltaPorId: usuario.id,
      resueltaAt: await this.reservas.ahora(),
    });

    await this.avisar(
      reserva.solicitadaPorId,
      `Se rechazó tu reserva de ${reserva.amenity.nombre}`,
      dto.motivoRechazo,
      `reserva:${reserva.id}`,
    );

    return rechazada;
  }

  async cancelar(usuario: UsuarioActual, id: string): Promise<Reserva> {
    await this.reservas.cerrarVencidas();
    const reserva = await this.buscarConPermiso(usuario, id);

    if (!CANCELABLES.includes(reserva.estado)) {
      throw new BadRequestException(`La reserva está ${reserva.estado} y no se puede cancelar`);
    }
    // Cancelar algo que ya empezó no es cancelar, es reescribir la historia.
    if (reserva.inicio <= (await this.reservas.ahora())) {
      throw new BadRequestException('La reserva ya empezó: no se puede cancelar');
    }

    const cancelada = await this.reservas.actualizarReserva(reserva, {
      estado: EstadoReserva.CANCELADA,
    });

    if (usuario.id !== reserva.solicitadaPorId) {
      await this.avisar(
        reserva.solicitadaPorId,
        `Se canceló tu reserva de ${reserva.amenity.nombre}`,
        'El administrador canceló la reserva.',
        `reserva:${reserva.id}`,
      );
    }

    return cancelada;
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  /**
   * Para quien administra, uno de otro consorcio no existe. Al vecino que
   * reserva no se lo filtra acá: exigirMismoConsorcio lo ata a su unidad.
   */
  private async exigirAmenity(usuario: UsuarioActual, id: string): Promise<Amenity> {
    const amenity = await this.reservas.findAmenityById(id);
    if (!amenity || (esGestor(usuario) && !gestiona(usuario, amenity.consorcioId))) {
      throw new NotFoundException(`El amenity ${id} no existe`);
    }
    return amenity;
  }

  private async puedeVer(usuario: UsuarioActual, amenity: Amenity): Promise<boolean> {
    if (esGestor(usuario)) return gestiona(usuario, amenity.consorcioId);
    if (!amenity.activo) return false;
    return (await this.reservas.consorciosDelUsuario(usuario.id)).includes(
      amenity.consorcioId,
    );
  }

  /**
   * La ventana puede cruzar la medianoche (cierre anterior a la apertura) o
   * ser de 24 h (apertura igual al cierre). Un tope de duración mayor que la
   * ventana es configuración que nadie puede alcanzar.
   */
  private exigirVentanaCoherente(
    horaApertura: string,
    horaCierre: string,
    duracionMaximaHoras: number | null,
  ): void {
    if (
      duracionMaximaHoras !== null &&
      duracionMaximaHoras * 60 > largoDeVentana(horaApertura, horaCierre)
    ) {
      throw new BadRequestException(
        'La duración máxima no puede ser mayor que la ventana horaria del amenity',
      );
    }
  }

  /** Dos "SUM" en el mismo edificio hacen que el vecino reserve el equivocado. */
  private async exigirNombreLibre(consorcioId: string, nombre: string): Promise<void> {
    if (await this.reservas.findAmenityPorNombre(consorcioId, nombre)) {
      throw new ConflictException(`Ya existe un amenity llamado ${nombre} en este consorcio`);
    }
  }

  /**
   * `reserva` no tiene `consorcio_id`: el consorcio llega por el amenity y por
   * la unidad, y nada en la base obliga a que coincidan.
   */
  private async exigirMismoConsorcio(amenity: Amenity, unidadId: string): Promise<void> {
    const unidad = await this.reservas.findUnidad(unidadId);
    if (!unidad) throw new BadRequestException(`La unidad ${unidadId} no existe`);
    if (!unidad.activa) throw new BadRequestException('La unidad está dada de baja');
    if (unidad.consorcioId !== amenity.consorcioId) {
      throw new BadRequestException(`El amenity ${amenity.nombre} no es de este consorcio`);
    }
  }

  private async alcance(usuario: UsuarioActual) {
    if (esGestor(usuario)) return { consorcios: consorciosGestionados(usuario) };
    return { unidades: await this.reservas.unidadesDelUsuario(usuario.id) };
  }

  private async buscarConPermiso(usuario: UsuarioActual, id: string): Promise<Reserva> {
    const reserva = await this.reservas.findById(id);
    // 404 y no 403: un 403 confirmaría que esa reserva existe.
    if (!reserva) throw new NotFoundException(`La reserva ${id} no existe`);
    const visible = esGestor(usuario)
      ? gestiona(usuario, reserva.amenity.consorcioId)
      : (await this.reservas.unidadesDelUsuario(usuario.id)).includes(reserva.unidadId);
    if (!visible) throw new NotFoundException(`La reserva ${id} no existe`);
    return reserva;
  }

  private async exigirPendiente(usuario: UsuarioActual, id: string): Promise<Reserva> {
    const reserva = await this.buscarConPermiso(usuario, id);
    if (reserva.estado !== EstadoReserva.PENDIENTE) {
      throw new BadRequestException(`La reserva ya está ${reserva.estado}`);
    }
    return reserva;
  }

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

    const unidades = await this.reservas.unidadesDelUsuario(usuario.id);

    if (unidades.length === 0) {
      throw new ForbiddenException(
        'No estás vinculado a ninguna unidad, así que no podés reservar',
      );
    }

    if (unidadPedida) {
      if (!unidades.includes(unidadPedida)) {
        throw new ForbiddenException('Esa unidad no es tuya');
      }
      return unidadPedida;
    }

    if (unidades.length > 1) {
      throw new BadRequestException('Tenés más de una unidad: indicá sobre cuál es la reserva');
    }

    return unidades[0];
  }

  private mensajeDe(problema: ProblemaFranja, amenity: Amenity): string {
    const mensajes: Record<ProblemaFranja, string> = {
      FUERA_DE_HORARIO: `${amenity.nombre} abre de ${amenity.horaApertura} a ${amenity.horaCierre}${
        cierraAlDiaSiguiente(amenity.horaApertura, amenity.horaCierre) ? ' del día siguiente' : ''
      }`,
      DEMASIADO_LARGA: `${amenity.nombre} se reserva por hasta ${amenity.duracionMaximaHoras} horas`,
    };
    return mensajes[problema];
  }

  /** Avisar nunca corta la operación: la reserva ya quedó guardada igual. */
  private async avisar(
    destinatarioId: string,
    asunto: string,
    cuerpo: string,
    origen: string,
  ): Promise<void> {
    try {
      await this.notificador.enviar({ destinatarioId, asunto, cuerpo, origen });
    } catch (error) {
      this.logger.warn(`No se pudo avisar a ${destinatarioId}: ${String(error)}`);
    }
  }
}
