import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { UsuarioActual } from '../auth/auth.types';
import {
  AI_GATEWAY,
  FallaDelModelo,
  type AIGateway,
  type Turno,
  type UsoDelModelo,
} from './ai-gateway';
import { AsistenteRepository } from './asistente.repository';
import { Disyuntor } from './disyuntor';
import type { FeedbackDto } from './dto/feedback.dto';
import type { PreguntaDto } from './dto/pregunta.dto';
import { HerramientasAsistente } from './herramientas';
import { LimitadorAsistente } from './limitador-asistente';
import { manualDelRol } from './manual';
import { ManualClient } from './manual.client';
import {
  esRolAsistente,
  redactarPii,
  rutaPermitida,
  validarRespuesta,
  type Origen,
  type RespuestaAsistente,
  type RolAsistente,
} from './politica';

/** Turnos anteriores que se le mandan al modelo: alcanzan para una repregunta. */
const TURNOS_DE_HISTORIAL = 6;
/** Cuánto se confía en el valor del interruptor antes de volver a leerlo. */
const CACHE_INTERRUPTOR_MS = 60_000;
const TOPE_DIARIO_POR_DEFECTO = 5;

export const RESPUESTA_RECHAZO: RespuestaAsistente = {
  respuesta:
    'No puedo ayudarte con eso. Si es algo de tu consorcio, escribile a la administración de tu edificio.',
  fuentes: [],
  acciones: [],
  confianza: 'baja',
  derivar_a_humano: true,
};

/** El contrato de `POST /asistente/preguntas`. */
export interface RespuestaPregunta extends RespuestaAsistente {
  interaccion_id: string;
  conversacion_id: string;
  datos_consultados: string[];
  origen: Origen;
}

interface Resuelta {
  respuesta: RespuestaAsistente;
  origen: Origen;
  herramientas: string[];
  uso?: UsoDelModelo;
  error?: string;
}

/**
 * El asistente de ayuda. Decide quién responde —el modelo o el manual— y deja
 * todo registrado. El modelo nunca escribe nada: sólo lee con las herramientas
 * del usuario y su respuesta pasa por `validarRespuesta` antes de salir.
 * Cualquier falla del modelo cae al manual, así que una pregunta siempre
 * tiene respuesta.
 */
@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);
  private readonly disyuntor = new Disyuntor();
  private readonly limitador = new LimitadorAsistente();
  private readonly topeDiarioUsd: number;
  private interruptor: { habilitado: boolean; hasta: number } | null = null;

  constructor(
    @Inject(AI_GATEWAY) private readonly gateway: AIGateway,
    private readonly manual: ManualClient,
    private readonly herramientas: HerramientasAsistente,
    private readonly repo: AsistenteRepository,
    config: ConfigService,
  ) {
    this.topeDiarioUsd = Number(config.get('ASISTENTE_TOPE_DIARIO_USD')) || TOPE_DIARIO_POR_DEFECTO;
  }

  async estado(): Promise<{ habilitado: boolean }> {
    return { habilitado: await this.habilitado() };
  }

  /** Con `onTexto`, la respuesta del modelo se va mandando mientras se escribe (ver el controller). */
  async preguntar(
    usuario: UsuarioActual,
    dto: PreguntaDto,
    onTexto?: (fragmento: string) => void,
  ): Promise<RespuestaPregunta> {
    const rol = usuario.rol;
    if (!esRolAsistente(rol)) {
      throw new ForbiddenException('El asistente es para vecinos y administradores.');
    }
    if (!(await this.habilitado())) {
      throw new ServiceUnavailableException('El asistente no está disponible en este momento.');
    }
    this.limitador.registrar(usuario.id);

    // Lo que se manda al modelo y lo que se guarda es lo mismo: la pregunta sin datos personales.
    const pregunta = redactarPii(dto.pregunta.trim());
    const conversacionId = dto.conversacion_id ?? randomUUID();
    // Sin await: se pide en paralelo con el resto de lo que hace falta antes de llamar al modelo.
    // Si falla, se sigue sin historial: es contexto, no un requisito.
    const historial = dto.conversacion_id
      ? this.repo.historial(usuario.id, conversacionId, TURNOS_DE_HISTORIAL).catch(() => [])
      : Promise.resolve([]);

    const inicio = Date.now();
    // Una pantalla que no es del portal (o que el manual no cubre) se ignora: sólo da contexto.
    const pantalla = dto.pantalla && rutaPermitida(rol, dto.pantalla) ? dto.pantalla : undefined;
    const r = await this.resolver({ ...usuario, rol }, pregunta, pantalla, historial, onTexto);
    const interaccionId = await this.repo.registrar({
      usuarioId: usuario.id,
      conversacionId,
      pregunta,
      respuesta: r.respuesta,
      origen: r.origen,
      herramientas: r.herramientas,
      modelo: r.uso?.modelo ?? null,
      tokensEntrada: r.uso?.tokensEntrada ?? 0,
      tokensCache: r.uso?.tokensCache ?? 0,
      tokensSalida: r.uso?.tokensSalida ?? 0,
      costoUsd: r.uso?.costoUsd ?? 0,
      latenciaMs: Date.now() - inicio,
      error: r.error ?? null,
    });

    return {
      interaccion_id: interaccionId,
      conversacion_id: conversacionId,
      ...r.respuesta,
      // Lo dice el servidor, no el modelo: son las consultas que de verdad corrieron.
      datos_consultados: r.origen === 'llm' ? [...new Set(r.herramientas)] : [],
      origen: r.origen,
    };
  }

  private async resolver(
    usuario: UsuarioActual & { rol: RolAsistente },
    pregunta: string,
    pantalla: string | undefined,
    historial: Promise<Turno[]>,
    onTexto?: (fragmento: string) => void,
  ): Promise<Resuelta> {
    const delManual = (error?: string): Resuelta => ({
      respuesta: this.manual.responder(usuario.rol, pregunta),
      origen: 'manual',
      herramientas: [],
      error,
    });

    if (!this.gateway.disponible) return delManual();
    if (this.disyuntor.abierto) return delManual('disyuntor_abierto');
    // Tres consultas a la base que no dependen entre sí: juntas tardan lo que la más lenta.
    const [costo, alcance, turnos] = await Promise.all([
      this.repo.costoDelDia(),
      this.herramientas.alcance(usuario),
      historial,
    ]);
    if (costo >= this.topeDiarioUsd) return delManual('tope_diario');

    try {
      const r = await this.gateway.responder({
        usuario,
        pregunta,
        pantalla,
        historial: turnos,
        alcance,
        onTexto,
        ejecutar: (nombre, entrada) => this.herramientas.ejecutar(usuario, nombre, entrada),
      });
      if (r.rechazada) {
        // Que el modelo se niegue no es que el proveedor ande mal: no cuenta para el disyuntor.
        this.disyuntor.registrar(true);
        return { respuesta: RESPUESTA_RECHAZO, origen: 'rechazo', herramientas: r.herramientas, uso: r.uso };
      }
      const valida = validarRespuesta(r.respuesta, usuario.rol, manualDelRol(usuario.rol).anclas);
      if (!valida) throw new FallaDelModelo('json_invalido', r.uso, r.herramientas);
      this.disyuntor.registrar(true);
      return { respuesta: valida, origen: 'llm', herramientas: r.herramientas, uso: r.uso };
    } catch (error) {
      this.disyuntor.registrar(false);
      const falla = error instanceof FallaDelModelo ? error : null;
      if (!falla) this.logger.error('El asistente falló', error instanceof Error ? error.stack : String(error));
      return {
        ...delManual(falla?.motivo ?? 'error_interno'),
        herramientas: falla?.herramientas ?? [],
        uso: falla?.uso,
      };
    }
  }

  async feedback(usuario: UsuarioActual, dto: FeedbackDto): Promise<void> {
    if (!(await this.repo.existeDelUsuario(dto.interaccion_id, usuario.id))) {
      throw new NotFoundException('La respuesta no existe');
    }
    const comentario = dto.comentario?.trim() ? redactarPii(dto.comentario.trim()) : null;
    await this.repo.guardarFeedback(dto.interaccion_id, dto.util, comentario);
  }

  // ── Superadministrador ─────────────────────────────────────────────────────

  async cambiarHabilitado(usuario: UsuarioActual, habilitado: boolean): Promise<{ habilitado: boolean }> {
    await this.repo.cambiarHabilitado(habilitado, usuario.id);
    this.interruptor = { habilitado, hasta: Date.now() + CACHE_INTERRUPTOR_MS };
    return { habilitado };
  }

  async metricas(dias: number) {
    return {
      ...(await this.repo.metricas(dias)),
      habilitado: await this.habilitado(),
      modeloConfigurado: this.gateway.disponible,
      disyuntorAbierto: this.disyuntor.abierto,
      topeDiarioUsd: this.topeDiarioUsd,
      costoHoyUsd: await this.repo.costoDelDia(),
    };
  }

  /** Leído a lo sumo una vez por minuto: se consulta en cada pregunta. */
  private async habilitado(): Promise<boolean> {
    if (this.interruptor && Date.now() < this.interruptor.hasta) return this.interruptor.habilitado;
    const habilitado = await this.repo.habilitado();
    this.interruptor = { habilitado, hasta: Date.now() + CACHE_INTERRUPTOR_MS };
    return habilitado;
  }
}
