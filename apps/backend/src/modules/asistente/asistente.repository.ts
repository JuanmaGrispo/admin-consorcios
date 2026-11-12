import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AsistenteFeedback,
  AsistenteInteraccion,
  Consorcio,
  ConfiguracionPlataforma,
  Unidad,
} from '../../database/entities';
import type { Turno } from './ai-gateway';
import type { Origen, RespuestaAsistente } from './politica';

const CLAVE_HABILITADO = 'asistente_habilitado';
/** El día del tope de gasto es el de Buenos Aires, no el de UTC. */
const ZONA = 'America/Argentina/Buenos_Aires';

export interface NuevaInteraccion {
  usuarioId: string;
  conversacionId: string;
  pregunta: string;
  respuesta: RespuestaAsistente;
  origen: Origen;
  herramientas: string[];
  modelo: string | null;
  tokensEntrada: number;
  tokensCache: number;
  tokensSalida: number;
  costoUsd: number;
  latenciaMs: number;
  error: string | null;
}

export interface MetricasAsistente {
  dias: number;
  preguntas: number;
  porOrigen: Record<Origen, number>;
  costoUsd: number;
  latenciaPromedioMs: number;
  feedback: { util: number; noUtil: number };
  errores: { error: string; veces: number }[];
}

@Injectable()
export class AsistenteRepository {
  constructor(
    @InjectRepository(AsistenteInteraccion)
    private readonly interacciones: Repository<AsistenteInteraccion>,
    @InjectRepository(AsistenteFeedback)
    private readonly feedback: Repository<AsistenteFeedback>,
    @InjectRepository(ConfiguracionPlataforma)
    private readonly configuracion: Repository<ConfiguracionPlataforma>,
    @InjectRepository(Unidad)
    private readonly unidades: Repository<Unidad>,
    @InjectRepository(Consorcio)
    private readonly consorcios: Repository<Consorcio>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Interruptor ────────────────────────────────────────────────────────────

  /** Sin la fila, el asistente está prendido: es el valor que siembra la migración. */
  async habilitado(): Promise<boolean> {
    const fila = await this.configuracion.findOneBy({ clave: CLAVE_HABILITADO });
    return fila ? fila.valor === (true as unknown as object) : true;
  }

  async cambiarHabilitado(valor: boolean, usuarioId: string): Promise<void> {
    await this.configuracion.upsert(
      { clave: CLAVE_HABILITADO, valor: valor as unknown as object, actualizadoAt: new Date(), actualizadoPorId: usuarioId },
      ['clave'],
    );
  }

  // ── Interacciones ──────────────────────────────────────────────────────────

  /** Los últimos turnos de la conversación, del más viejo al más nuevo. Sólo los del mismo usuario. */
  async historial(usuarioId: string, conversacionId: string, turnos: number): Promise<Turno[]> {
    const filas = await this.interacciones.find({
      where: { usuarioId, conversacionId },
      order: { creadoAt: 'DESC' },
      take: turnos,
    });
    return filas.reverse().map((f) => ({
      pregunta: f.pregunta,
      respuesta: (f.respuesta as RespuestaAsistente | null)?.respuesta ?? '',
    }));
  }

  async registrar(datos: NuevaInteraccion): Promise<string> {
    const fila = await this.interacciones.save(
      this.interacciones.create({ ...datos, respuesta: datos.respuesta as unknown as object }),
    );
    return fila.id;
  }

  /** Lo gastado hoy en el modelo: alimenta el tope diario. */
  async costoDelDia(): Promise<number> {
    const [{ costo }] = await this.dataSource.query(
      `SELECT coalesce(sum(costo_usd), 0)::float AS costo
         FROM asistente_interaccion
        WHERE creado_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1`,
      [ZONA],
    );
    return costo;
  }

  async existeDelUsuario(interaccionId: string, usuarioId: string): Promise<boolean> {
    return this.interacciones.existsBy({ id: interaccionId, usuarioId });
  }

  /** Un voto por respuesta: si ya votó, se reemplaza. */
  async guardarFeedback(interaccionId: string, util: boolean, comentario: string | null): Promise<void> {
    await this.feedback.upsert({ interaccionId, util, comentario, creadoAt: new Date() }, ['interaccionId']);
  }

  // ── Datos para las herramientas ────────────────────────────────────────────

  async etiquetasDeUnidades(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const filas = await this.unidades.find({ where: { id: In(ids) }, select: { id: true, etiqueta: true } });
    return new Map(filas.map((u) => [u.id, u.etiqueta]));
  }

  async nombresDeConsorcios(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const filas = await this.consorcios.find({ where: { id: In(ids) }, select: { id: true, nombre: true } });
    return new Map(filas.map((c) => [c.id, c.nombre]));
  }

  // ── Métricas ───────────────────────────────────────────────────────────────

  async metricas(dias: number): Promise<MetricasAsistente> {
    const desde = `now() - make_interval(days => $1)`;
    const [totales, origenes, votos, errores] = await Promise.all([
      this.dataSource.query(
        `SELECT count(*)::int AS preguntas,
                coalesce(sum(costo_usd), 0)::float AS costo,
                coalesce(avg(latencia_ms), 0)::float AS latencia
           FROM asistente_interaccion WHERE creado_at >= ${desde}`,
        [dias],
      ),
      this.dataSource.query(
        `SELECT origen, count(*)::int AS veces
           FROM asistente_interaccion WHERE creado_at >= ${desde} GROUP BY origen`,
        [dias],
      ),
      this.dataSource.query(
        `SELECT f.util, count(*)::int AS veces
           FROM asistente_feedback f JOIN asistente_interaccion i ON i.id = f.interaccion_id
          WHERE i.creado_at >= ${desde} GROUP BY f.util`,
        [dias],
      ),
      this.dataSource.query(
        `SELECT error, count(*)::int AS veces
           FROM asistente_interaccion WHERE creado_at >= ${desde} AND error IS NOT NULL
          GROUP BY error ORDER BY veces DESC LIMIT 5`,
        [dias],
      ),
    ]);
    const porOrigen: Record<Origen, number> = { llm: 0, manual: 0, rechazo: 0 };
    for (const o of origenes as { origen: Origen; veces: number }[]) porOrigen[o.origen] = o.veces;
    const voto = (util: boolean) =>
      (votos as { util: boolean; veces: number }[]).find((v) => v.util === util)?.veces ?? 0;
    return {
      dias,
      preguntas: totales[0].preguntas,
      porOrigen,
      costoUsd: Math.round(totales[0].costo * 10_000) / 10_000,
      latenciaPromedioMs: Math.round(totales[0].latencia),
      feedback: { util: voto(true), noUtil: voto(false) },
      errores,
    };
  }
}
