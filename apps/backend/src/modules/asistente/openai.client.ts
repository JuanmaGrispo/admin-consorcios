import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  FallaDelModelo,
  type AIGateway,
  type ContextoPregunta,
  type ResultadoGateway,
  type UsoDelModelo,
} from './ai-gateway';
import { HERRAMIENTAS_POR_ROL } from './herramientas';
import { envolverDatos, type RolAsistente } from './politica';
import { contextoFijo, esquemaRespuesta, hoy, MAX_HERRAMIENTAS } from './prompt';
import { respuestaParcial } from './respuesta-parcial';

/**
 * Mini por defecto: en el eval, nano fallaba más casos adversariales (4 de 6
 * contra 5 de 6) y la diferencia de costo es de centavos por día.
 */
export const MODELO_POR_DEFECTO = 'gpt-5.4-mini';
const TIMEOUT_MS = 15_000;
/** Incluye el razonamiento del modelo, que también cuenta como salida. */
const MAX_TOKENS_SALIDA = 4_000;

/** US$ por millón de tokens. La entrada que sale del caché se cobra a un décimo. */
const PRECIOS: Record<string, { entrada: number; salida: number }> = {
  'gpt-5.4-nano': { entrada: 0.2, salida: 1.25 },
  'gpt-5.4-mini': { entrada: 0.75, salida: 4.5 },
};

export function costoUsd(modelo: string, uso: OpenAI.Responses.ResponseUsage): number {
  // Un modelo sin precio cargado se cuenta como mini: mejor sobreestimar contra el tope.
  const precio = PRECIOS[modelo] ?? PRECIOS['gpt-5.4-mini'];
  const cache = uso.input_tokens_details?.cached_tokens ?? 0;
  const entrada = uso.input_tokens - cache + cache * 0.1;
  return (entrada * precio.entrada + uso.output_tokens * precio.salida) / 1_000_000;
}

/**
 * El texto de la respuesta. No se usa `output_text`: es un atajo que el SDK
 * arma sólo en las llamadas sin streaming, y la respuesta final de un stream
 * no lo trae.
 */
function textoDe(r: OpenAI.Responses.Response): string {
  return r.output
    .flatMap((o) => (o.type === 'message' ? o.content : []))
    .map((c) => (c.type === 'output_text' ? c.text : ''))
    .join('');
}

/** Las herramientas de un rol en el formato de OpenAI, en modo estricto. */
function herramientas(rol: RolAsistente): OpenAI.Responses.FunctionTool[] {
  return HERRAMIENTAS_POR_ROL[rol].map((h) => ({
    type: 'function',
    name: h.name,
    description: h.description,
    parameters: h.parameters,
    strict: true,
  }));
}

/**
 * El adaptador de OpenAI (Responses API). Manda las instrucciones y el manual
 * siempre iguales al principio, para que el proveedor los cachee, corre el
 * ciclo de herramientas (como mucho tres) y devuelve el JSON sin validar.
 * Cualquier falla —timeout, negativa, JSON roto— sale como FallaDelModelo y
 * el service responde con el manual.
 *
 * `store: false`: OpenAI no guarda las conversaciones. Por eso el
 * razonamiento del modelo viaja cifrado entre una vuelta y la siguiente.
 */
@Injectable()
export class OpenAIClient implements AIGateway {
  private readonly logger = new Logger(OpenAIClient.name);
  private readonly cliente: OpenAI | null;
  readonly modelo: string;
  private readonly razonamiento: OpenAI.ReasoningEffort;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    // Un reintento: con 15 s de tope total, más reintentos sólo comen el tiempo del fallback.
    this.cliente = apiKey ? new OpenAI({ apiKey, maxRetries: 1, timeout: TIMEOUT_MS }) : null;
    this.modelo = config.get<string>('ASISTENTE_MODELO') || MODELO_POR_DEFECTO;
    // Sin razonamiento: en el eval sacó lo mismo que `low` y responde más rápido.
    this.razonamiento = (config.get<string>('ASISTENTE_RAZONAMIENTO') || 'none') as OpenAI.ReasoningEffort;
  }

  /** Sin API key el asistente funciona igual, sólo con el manual. */
  get disponible(): boolean {
    return this.cliente !== null;
  }

  async responder(ctx: ContextoPregunta): Promise<ResultadoGateway> {
    if (!this.cliente) throw new FallaDelModelo('proveedor');
    const rol = ctx.usuario.rol;
    const usadas: string[] = [];
    const uso: UsoDelModelo = { modelo: this.modelo, tokensEntrada: 0, tokensCache: 0, tokensSalida: 0, costoUsd: 0 };
    // Un solo reloj para toda la pregunta, herramientas incluidas.
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    const input: OpenAI.Responses.ResponseInputItem[] = [
      ...ctx.historial.flatMap((t): OpenAI.Responses.ResponseInputItem[] => [
        { role: 'user', content: t.pregunta },
        { role: 'assistant', content: t.respuesta },
      ]),
      {
        role: 'user',
        content:
          `Hoy es ${hoy()}. ${ctx.alcance}` +
          (ctx.pantalla ? ` El usuario está en la pantalla ${ctx.pantalla}.` : '') +
          `\n\nPregunta: ${ctx.pregunta}`,
      },
    ];

    try {
      // Las vueltas están acotadas por las herramientas: cada vuelta que no responde consume al menos una.
      for (let vuelta = 0; vuelta <= MAX_HERRAMIENTAS; vuelta++) {
        const r = await this.pedir(
          {
            model: this.modelo,
            instructions: contextoFijo(rol),
            input,
            tools: herramientas(rol),
            tool_choice: 'auto',
            parallel_tool_calls: false,
            text: { format: { type: 'json_schema', name: 'respuesta_asistente', schema: esquemaRespuesta(rol), strict: true } },
            reasoning: { effort: this.razonamiento },
            max_output_tokens: MAX_TOKENS_SALIDA,
            store: false,
            include: ['reasoning.encrypted_content'],
            // Agrupa los pedidos del mismo rol: el mismo prefijo cae en la misma caché.
            prompt_cache_key: `domus-asistente-${rol}`,
          },
          signal,
          ctx.onTexto,
        );
        if (r.usage) this.sumarUso(uso, r.usage);

        if (r.status === 'incomplete') throw new FallaDelModelo('max_tokens', uso, usadas);
        const contenido = r.output.flatMap((o) => (o.type === 'message' ? o.content : []));
        if (contenido.some((c) => c.type === 'refusal')) return { respuesta: null, herramientas: usadas, uso, rechazada: true };

        const llamadas = r.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === 'function_call');
        if (llamadas.length > 0) {
          // La conversación se arma de nuestro lado (store: false): va todo lo que devolvió, razonamiento incluido.
          input.push(...(r.output as OpenAI.Responses.ResponseInputItem[]));
          for (const llamada of llamadas) {
            if (usadas.length >= MAX_HERRAMIENTAS) {
              input.push({
                type: 'function_call_output',
                call_id: llamada.call_id,
                output: 'Se alcanzó el máximo de consultas. Respondé con lo que ya tenés.',
              });
              continue;
            }
            usadas.push(llamada.name);
            let entrada: unknown = null;
            try {
              entrada = JSON.parse(llamada.arguments);
            } catch {
              /* la herramienta valida su entrada y devuelve el error como dato */
            }
            const datos = await ctx.ejecutar(llamada.name, entrada);
            input.push({ type: 'function_call_output', call_id: llamada.call_id, output: envolverDatos(llamada.name, datos) });
          }
          continue;
        }

        try {
          return { respuesta: JSON.parse(textoDe(r)), herramientas: usadas, uso };
        } catch {
          throw new FallaDelModelo('json_invalido', uso, usadas);
        }
      }
      throw new FallaDelModelo('json_invalido', uso, usadas);
    } catch (error) {
      if (error instanceof FallaDelModelo) throw error;
      const timeout = signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError;
      this.logger.warn(`OpenAI no respondió: ${error instanceof Error ? error.message : String(error)}`);
      throw new FallaDelModelo(timeout ? 'timeout' : 'proveedor', uso, usadas);
    }
  }

  /**
   * Un pedido al modelo. Con `onTexto` va por streaming: cuesta lo mismo (se
   * cobran los mismos tokens) y el usuario ve la respuesta mientras se escribe.
   */
  private async pedir(
    params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
    signal: AbortSignal,
    onTexto?: (fragmento: string) => void,
  ): Promise<OpenAI.Responses.Response> {
    if (!onTexto) return this.cliente!.responses.create(params, { signal });

    const stream = await this.cliente!.responses.create({ ...params, stream: true }, { signal });
    let json = '';
    let enviado = '';
    for await (const evento of stream) {
      if (evento.type === 'response.output_text.delta') {
        json += evento.delta;
        // El texto llega como JSON: se manda sólo lo nuevo de `respuesta`, ya decodificado.
        const parcial = respuestaParcial(json);
        if (parcial && parcial.length > enviado.length) {
          onTexto(parcial.slice(enviado.length));
          enviado = parcial;
        }
      } else if (evento.type === 'response.completed' || evento.type === 'response.incomplete') {
        return evento.response;
      } else if (evento.type === 'response.failed') {
        throw new Error(evento.response.error?.message ?? 'La respuesta falló');
      }
    }
    throw new Error('El stream terminó sin respuesta');
  }

  private sumarUso(total: UsoDelModelo, uso: OpenAI.Responses.ResponseUsage) {
    const cache = uso.input_tokens_details?.cached_tokens ?? 0;
    total.tokensEntrada += uso.input_tokens - cache;
    total.tokensCache += cache;
    total.tokensSalida += uso.output_tokens;
    total.costoUsd += costoUsd(this.modelo, uso);
  }
}
