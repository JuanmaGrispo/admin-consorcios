import { Injectable } from '@nestjs/common';
import { manualDelRol, PANTALLA_DE_SECCION, type Seccion } from './manual';
import { RUTAS_POR_ROL, type RespuestaAsistente, type RolAsistente } from './politica';

/** Palabras que no dicen nada del tema de la pregunta. */
const VACIAS = new Set(
  (
    'a al algo como con cual cuando de del donde el en es esta este esto hay la las le lo los me mi mis ' +
    'no o para pero por que quiero se si sin su sus te tengo tu un una uno y ya hago hacer puedo ' +
    'necesito domus app'
  ).split(' '),
);

/** Minúsculas y sin tildes, para que "reservá" y "reservar" se parezcan. */
const normalizar = (texto: string) =>
  texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Terminaciones de verbos y plurales: "abro", "abrir" y "abrís" quedan en "abr". */
const TERMINACION = /(iendo|ando|ar|er|ir|as|es|os|is|a|e|o)$/;

/** Raíces de las palabras con contenido, para que "reserva", "reservar" y "reservas" coincidan. */
function raices(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length > 2 && !VACIAS.has(p))
    .map((p) => (p.length > 4 ? p.replace(TERMINACION, '') : p).slice(0, 6));
}

/** Las secciones de estados sólo ganan si se pregunta por un estado. */
const PREGUNTA_POR_ESTADO = /estado|signific|quiere decir/;

/**
 * El markdown corta los renglones a 80 columnas: se unen los de un mismo
 * párrafo o paso, y se dejan los saltos que arrancan un paso o una viñeta.
 * Las negritas quedan: el chat las muestra.
 */
export const desenvolver = (texto: string) => texto.replace(/(?<!\n)\n(?!\n|\d+\. |- ) */g, ' ');

/** Por debajo de este puntaje no se arriesga una sección: deriva. */
const PUNTAJE_MINIMO = 3;

export const SIN_RESPUESTA =
  'No encontré eso en el manual de Domus. Escribile a la administración de tu edificio, que te puede ayudar.';

/**
 * El asistente sin IA: busca la sección del manual que más palabras comparte
 * con la pregunta y la devuelve tal cual. Es la red cuando el modelo no
 * responde, se pasó de presupuesto o el disyuntor está abierto; nunca
 * inventa nada porque sólo copia el manual.
 */
@Injectable()
export class ManualClient {
  responder(rol: RolAsistente, pregunta: string): RespuestaAsistente {
    const mejor = this.buscar(rol, pregunta);
    if (!mejor) {
      return { respuesta: SIN_RESPUESTA, fuentes: [], acciones: [], confianza: 'baja', derivar_a_humano: true };
    }
    const ruta = PANTALLA_DE_SECCION[rol][mejor.ancla];
    return {
      respuesta: `${mejor.titulo}\n\n${desenvolver(mejor.texto)}`,
      fuentes: [{ seccion: mejor.titulo, ancla: mejor.ancla }],
      acciones: ruta ? [{ tipo: 'IR_A', etiqueta: RUTAS_POR_ROL[rol][ruta], ruta }] : [],
      confianza: 'media',
      derivar_a_humano: false,
    };
  }

  private buscar(rol: RolAsistente, pregunta: string): Seccion | null {
    const buscadas = new Set(raices(pregunta));
    if (buscadas.size === 0) return null;
    const porEstado = PREGUNTA_POR_ESTADO.test(normalizar(pregunta));
    let mejor: { seccion: Seccion; puntaje: number } | null = null;
    for (const seccion of manualDelRol(rol).secciones) {
      // El título pesa más que el cuerpo: dice de qué trata la sección.
      const enTitulo = new Set(raices(`${seccion.titulo} ${seccion.ancla}`));
      const enTexto = new Set(raices(seccion.texto));
      let puntaje = 0;
      for (const r of buscadas) puntaje += enTitulo.has(r) ? 3 : enTexto.has(r) ? 1 : 0;
      if (seccion.ancla.startsWith('estados-') && !porEstado) puntaje -= 2;
      if (puntaje >= PUNTAJE_MINIMO && (!mejor || puntaje > mejor.puntaje)) mejor = { seccion, puntaje };
    }
    return mejor?.seccion ?? null;
  }
}
