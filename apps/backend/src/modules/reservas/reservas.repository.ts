import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import {
  Amenity,
  AmenityBloqueo,
  EstadoReserva,
  Reserva,
  Unidad,
  UnidadUsuario,
} from '../../database/entities';
import { ListarAmenitiesQuery } from './dto/listar-amenities.query';
import { ListarReservasQuery } from './dto/listar-reservas.query';
import { ZONA_POR_DEFECTO } from './horario';

/**
 * Lo que ocupa el calendario. Es exactamente el `WHERE` del EXCLUDE
 * `ex_reserva_solapada` que tiene la base: si las dos listas se separaran, el
 * código y la base empezarían a decir cosas distintas.
 *
 * PENDIENTE ocupa a propósito: si una solicitud sin resolver no reservara el
 * lugar, dos vecinos podrían pedir el mismo sábado y el administrador tendría
 * que rechazar a uno después de haberle dicho "esperá".
 */
export const ESTADOS_QUE_OCUPAN = [EstadoReserva.PENDIENTE, EstadoReserva.APROBADA];

/** Mismo criterio de vigencia que usan reclamos, unidades y expensas. */
const VINCULO_VIGENTE = new Brackets((qb) =>
  qb.where('v.hasta IS NULL').orWhere('v.hasta >= CURRENT_DATE'),
);

const RELACIONES = { amenity: true, unidad: true, solicitadaPor: true } as const;

export interface Instantes {
  inicio: Date;
  fin: Date;
  ahora: Date;
}

@Injectable()
export class ReservasRepository {
  constructor(
    @InjectRepository(Amenity)
    private readonly amenities: Repository<Amenity>,
    @InjectRepository(AmenityBloqueo)
    private readonly bloqueos: Repository<AmenityBloqueo>,
    @InjectRepository(Reserva)
    private readonly reservas: Repository<Reserva>,
    @InjectRepository(UnidadUsuario)
    private readonly vinculos: Repository<UnidadUsuario>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    private readonly dataSource: DataSource,
  ) {}

  findUnidad(id: string): Promise<Unidad | null> {
    return this.unidades.findOneBy({ id });
  }

  // ── Tiempo ─────────────────────────────────────────────────────────────────

  /**
   * Arma los dos instantes de la franja y devuelve el reloj de la base en el
   * mismo viaje. La hora que manda el cliente es hora de pared del edificio:
   * convertirla a un instante es trabajo de Postgres, que sabe de horarios de
   * verano. El reloj sale de acá y no del proceso Node por lo mismo que `hoy()`
   * en unidades y expensas.
   *
   * Un fin igual o anterior al inicio es del día siguiente (de 20:00 a 02:00),
   * igual que en `franjaEnMinutos`.
   */
  async instantes(
    fecha: string,
    horaInicio: string,
    horaFin: string,
    zona: string,
  ): Promise<Instantes> {
    const [fila] = (await this.dataSource.query(
      `SELECT ($1::date + $2::time) AT TIME ZONE $4 AS inicio,
              ($1::date + (CASE WHEN $3::time <= $2::time THEN 1 ELSE 0 END) + $3::time)
                AT TIME ZONE $4 AS fin,
              now() AS ahora`,
      [fecha, horaInicio, horaFin, zona],
    )) as Instantes[];
    return fila;
  }

  /** Un instante suelto a partir de fecha y hora de pared (los bloqueos). */
  async instante(fechaHora: string, zona: string): Promise<Date> {
    const [fila] = (await this.dataSource.query(
      `SELECT ($1::timestamp AT TIME ZONE $2) AS valor`,
      [fechaHora.replace('T', ' '), zona],
    )) as { valor: Date }[];
    return fila.valor;
  }

  async ahora(): Promise<Date> {
    const [fila] = (await this.dataSource.query('SELECT now() AS ahora')) as {
      ahora: Date;
    }[];
    return fila.ahora;
  }

  /**
   * Cierra lo que el reloj ya resolvió. Corre antes de cada lectura, igual que
   * `marcarVencidas()` en expensas: así no hace falta un cron.
   *
   * Una PENDIENTE cuya franja ya pasó se rechaza sola: dejarla pendiente para
   * siempre ensucia la bandeja del administrador y le miente al vecino, que
   * sigue esperando una respuesta que ya no sirve.
   */
  async cerrarVencidas(): Promise<void> {
    await this.dataSource.query(
      `UPDATE reserva SET estado = 'FINALIZADA', updated_at = now()
        WHERE estado = 'APROBADA' AND fin <= now()`,
    );
    await this.dataSource.query(
      `UPDATE reserva
          SET estado = 'RECHAZADA', updated_at = now(), resuelta_at = now(),
              motivo_rechazo = 'Caducó sin resolverse antes del horario reservado'
        WHERE estado = 'PENDIENTE' AND inicio <= now()`,
    );
  }

  // ── Scoping del vecino ─────────────────────────────────────────────────────

  async unidadesDelUsuario(usuarioId: string): Promise<string[]> {
    const vinculos = await this.vinculos
      .createQueryBuilder('v')
      .select('v.unidadId', 'unidadId')
      .where('v.usuarioId = :usuarioId', { usuarioId })
      .andWhere(VINCULO_VIGENTE)
      .getRawMany<{ unidadId: string }>();

    return vinculos.map((v) => v.unidadId);
  }

  /** Los consorcios donde el vecino vive hoy: los amenities que puede ver. */
  async consorciosDelUsuario(usuarioId: string): Promise<string[]> {
    const filas = await this.vinculos
      .createQueryBuilder('v')
      .innerJoin('v.unidad', 'u')
      .select('DISTINCT u.consorcioId', 'consorcioId')
      .where('v.usuarioId = :usuarioId', { usuarioId })
      .andWhere(VINCULO_VIGENTE)
      .getRawMany<{ consorcioId: string }>();

    return filas.map((f) => f.consorcioId);
  }

  // ── Amenities ──────────────────────────────────────────────────────────────

  listarAmenities(filtro: {
    query: ListarAmenitiesQuery;
    consorciosPermitidos?: string[];
  }): Promise<Amenity[]> {
    const { query, consorciosPermitidos } = filtro;
    const qb = this.amenities
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.consorcio', 'consorcio')
      .orderBy('a.nombre', 'ASC');

    if (consorciosPermitidos) {
      if (consorciosPermitidos.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('a.consorcioId IN (:...cons)', { cons: consorciosPermitidos });
    }
    if (query.consorcioId) {
      qb.andWhere('a.consorcioId = :consorcioId', { consorcioId: query.consorcioId });
    }
    if (query.buscar) {
      qb.andWhere('a.nombre ILIKE :q', { q: `%${query.buscar}%` });
    }
    if (!query.incluirInactivos) qb.andWhere('a.activo = true');

    return qb.getMany();
  }

  findAmenityById(id: string): Promise<Amenity | null> {
    return this.amenities.findOne({ where: { id }, relations: { consorcio: true } });
  }

  findAmenityPorNombre(consorcioId: string, nombre: string): Promise<Amenity | null> {
    return this.amenities
      .createQueryBuilder('a')
      .where('a.consorcioId = :consorcioId', { consorcioId })
      .andWhere('lower(a.nombre) = lower(:nombre)', { nombre })
      .getOne();
  }

  async crearAmenity(data: Partial<Amenity>): Promise<Amenity> {
    const creado = await this.amenities.save(this.amenities.create(data));
    return (await this.findAmenityById(creado.id))!;
  }

  async actualizarAmenity(amenity: Amenity, data: Partial<Amenity>): Promise<Amenity> {
    await this.amenities.save({ ...amenity, ...data });
    return (await this.findAmenityById(amenity.id))!;
  }

  // ── Calendario ─────────────────────────────────────────────────────────────

  /**
   * Solapamiento de `[a, b)` con `[c, d)`: `a < d AND b > c`. Semiabierto, así
   * una reserva de 10 a 12 y otra de 12 a 14 conviven.
   */
  haySolapamiento(
    amenityId: string,
    inicio: Date,
    fin: Date,
    excluirId: string | null,
    m?: EntityManager,
  ): Promise<boolean> {
    const qb = (m?.getRepository(Reserva) ?? this.reservas)
      .createQueryBuilder('r')
      .where('r.amenityId = :amenityId', { amenityId })
      .andWhere('r.estado IN (:...estados)', { estados: ESTADOS_QUE_OCUPAN })
      .andWhere('r.inicio < :fin', { fin })
      .andWhere('r.fin > :inicio', { inicio });

    if (excluirId) qb.andWhere('r.id != :excluirId', { excluirId });
    return qb.getExists();
  }

  hayBloqueo(
    amenityId: string,
    inicio: Date,
    fin: Date,
    m?: EntityManager,
  ): Promise<boolean> {
    return (m?.getRepository(AmenityBloqueo) ?? this.bloqueos)
      .createQueryBuilder('b')
      .where('b.amenityId = :amenityId', { amenityId })
      .andWhere('b.desde < :fin', { fin })
      .andWhere('b.hasta > :inicio', { inicio })
      .getExists();
  }

  reservasEnRango(
    amenityId: string,
    inicio: Date,
    fin: Date,
    m?: EntityManager,
  ): Promise<Reserva[]> {
    return (m?.getRepository(Reserva) ?? this.reservas)
      .createQueryBuilder('r')
      .where('r.amenityId = :amenityId', { amenityId })
      .andWhere('r.estado IN (:...estados)', { estados: ESTADOS_QUE_OCUPAN })
      .andWhere('r.inicio < :fin', { fin })
      .andWhere('r.fin > :inicio', { inicio })
      .orderBy('r.inicio', 'ASC')
      .getMany();
  }

  bloqueosEnRango(amenityId: string, inicio: Date, fin: Date): Promise<AmenityBloqueo[]> {
    return this.bloqueos
      .createQueryBuilder('b')
      .where('b.amenityId = :amenityId', { amenityId })
      .andWhere('b.desde < :fin', { fin })
      .andWhere('b.hasta > :inicio', { inicio })
      .orderBy('b.desde', 'ASC')
      .getMany();
  }

  // ── Reservas ───────────────────────────────────────────────────────────────

  findById(id: string): Promise<Reserva | null> {
    return this.reservas.findOne({ where: { id }, relations: RELACIONES });
  }

  async listar(
    query: ListarReservasQuery,
    alcance: { unidades?: string[]; consorcios?: string[] },
  ): Promise<{ items: Reserva[]; total: number }> {
    const { unidades: unidadesPermitidas, consorcios } = alcance;
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const qb = this.reservas
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.amenity', 'amenity')
      .leftJoinAndSelect('r.unidad', 'unidad')
      .leftJoinAndSelect('r.solicitadaPor', 'solicitadaPor')
      .orderBy('r.inicio', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (unidadesPermitidas) {
      if (unidadesPermitidas.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('r.unidadId IN (:...unidades)', { unidades: unidadesPermitidas });
    }
    if (consorcios) {
      if (consorcios.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('amenity.consorcioId IN (:...consorcios)', { consorcios });
    }

    if (query.amenityId) qb.andWhere('r.amenityId = :am', { am: query.amenityId });
    if (query.unidadId) qb.andWhere('r.unidadId = :uni', { uni: query.unidadId });
    if (query.estado) qb.andWhere('r.estado = :estado', { estado: query.estado });
    if (query.consorcioId) {
      qb.andWhere('amenity.consorcioId = :cons', { cons: query.consorcioId });
    }
    if (query.situacion === 'proximas') qb.andWhere('r.inicio > now()');
    if (query.situacion === 'pasadas') qb.andWhere('r.inicio <= now()');
    // `CAST(... AS date)` y no `::date`: TypeORM lee `::` como un parámetro más.
    // Los días se cortan en la zona del edificio y no en la de la sesión (UTC):
    // si no, una reserva del sábado a las 22:00 caería en el domingo.
    if (query.desde) {
      qb.andWhere('r.inicio >= CAST(CAST(:desde AS date) AS timestamp) AT TIME ZONE :zona', {
        desde: query.desde,
        zona: ZONA_POR_DEFECTO,
      });
    }
    if (query.hasta) {
      qb.andWhere('r.inicio < CAST(CAST(:hasta AS date) + 1 AS timestamp) AT TIME ZONE :zona', {
        hasta: query.hasta,
        zona: ZONA_POR_DEFECTO,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * El alta corre entera en una transacción que primero bloquea la fila del
   * amenity. Sin eso, dos pedidos simultáneos ven el calendario libre y los dos
   * insertan: el `SELECT` de chequeo y el `INSERT` no son atómicos. Bloquear
   * sólo esa fila deja que dos amenities distintos se reserven en paralelo.
   */
  async crearReserva(
    amenityId: string,
    datos: Partial<Reserva>,
    chequear: (m: EntityManager) => Promise<void>,
  ): Promise<Reserva> {
    try {
      const creada = await this.dataSource.transaction(async (m) => {
        await m.query('SELECT id FROM amenity WHERE id = $1 FOR UPDATE', [amenityId]);
        await chequear(m);
        const repo = m.getRepository(Reserva);
        return repo.save(repo.create(datos));
      });
      return (await this.findById(creada.id))!;
    } catch (error) {
      // 23P01 = exclusion_violation: saltó `ex_reserva_solapada`. El lock de
      // arriba cubre lo que entra por acá; esto atrapa lo que escriba otro.
      if ((error as { code?: string }).code === '23P01') {
        throw new ConflictException('Ese horario ya está reservado');
      }
      throw error;
    }
  }

  async actualizarReserva(reserva: Reserva, data: Partial<Reserva>): Promise<Reserva> {
    await this.reservas.save({ ...reserva, ...data });
    return (await this.findById(reserva.id))!;
  }

  contarReservasDeAmenity(amenityId: string): Promise<number> {
    return this.reservas.countBy({ amenityId });
  }

  // ── Bloqueos ───────────────────────────────────────────────────────────────

  listarBloqueos(amenityId: string, desde?: Date, hasta?: Date): Promise<AmenityBloqueo[]> {
    const qb = this.bloqueos
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.creadoPor', 'creadoPor')
      .where('b.amenityId = :amenityId', { amenityId })
      .orderBy('b.desde', 'ASC');

    if (desde) qb.andWhere('b.hasta > :desde', { desde });
    if (hasta) qb.andWhere('b.desde < :hasta', { hasta });
    return qb.getMany();
  }

  findBloqueo(id: string): Promise<AmenityBloqueo | null> {
    return this.bloqueos.findOneBy({ id });
  }

  /**
   * Bloquear y cancelar lo que el bloqueo pisa van juntos, y bajo el mismo lock
   * que el alta: leer las reservas afuera dejaría pasar una que entre entre la
   * lectura y el INSERT, que quedaría viva sobre un amenity cerrado.
   *
   * `resolver` decide qué se cancela —o corta con un 409— ya con la lista real.
   */
  async crearBloqueo(
    amenityId: string,
    data: Partial<AmenityBloqueo>,
    resolver: (pisadas: Reserva[]) => Promise<Reserva[]>,
  ): Promise<{ bloqueo: AmenityBloqueo; canceladas: Reserva[] }> {
    return this.dataSource.transaction(async (m) => {
      await m.query('SELECT id FROM amenity WHERE id = $1 FOR UPDATE', [amenityId]);

      const canceladas = await resolver(
        await this.reservasEnRango(amenityId, data.desde!, data.hasta!, m),
      );
      for (const reserva of canceladas) {
        await m.getRepository(Reserva).save({
          ...reserva,
          estado: EstadoReserva.CANCELADA,
        });
      }

      const repo = m.getRepository(AmenityBloqueo);
      return { bloqueo: await repo.save(repo.create(data)), canceladas };
    });
  }

  async borrarBloqueo(id: string): Promise<void> {
    await this.bloqueos.delete(id);
  }
}
