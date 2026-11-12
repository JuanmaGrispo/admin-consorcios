import { RolUsuario } from '../../database/entities';

/**
 * Las reglas que el asistente no negocia, como funciones puras: qué datos
 * personales se tapan antes de mandar o guardar una pregunta, a qué pantallas
 * puede llevar un botón y qué forma tiene una respuesta válida. Lo que diga el
 * modelo pasa por acá antes de llegar al usuario: si inventa una ruta o una
 * fuente, se descarta.
 */

export type Confianza = 'alta' | 'media' | 'baja';
export type Origen = 'llm' | 'manual' | 'rechazo';

export interface Fuente {
  seccion: string;
  ancla: string;
}

/** La única acción: un botón que lleva a una pantalla. No carga ni envía nada. */
export interface AccionIrA {
  tipo: 'IR_A';
  etiqueta: string;
  ruta: string;
}

/** Lo que devuelve un AIGateway: la respuesta sin los datos que pone el service. */
export interface RespuestaAsistente {
  respuesta: string;
  fuentes: Fuente[];
  acciones: AccionIrA[];
  confianza: Confianza;
  derivar_a_humano: boolean;
}

/** Los roles que usan el asistente. El superadministrador no lo usa. */
export type RolAsistente = RolUsuario.VECINO | RolUsuario.ADMINISTRADOR;

export const esRolAsistente = (rol: RolUsuario): rol is RolAsistente =>
  rol === RolUsuario.VECINO || rol === RolUsuario.ADMINISTRADOR;

/**
 * Las pantallas a las que puede llevar un botón, con su etiqueta. Son rutas
 * fijas del front: nada con ids, para que un botón no pueda apuntar a un
 * recurso ajeno.
 */
export const RUTAS_POR_ROL: Record<RolAsistente, Record<string, string>> = {
  [RolUsuario.VECINO]: {
    '/vecino': 'Ir a Inicio',
    '/vecino/expensas': 'Ir a Expensas',
    '/vecino/reclamos': 'Ir a Reclamos',
    '/vecino/reclamos/nuevo': 'Ir a Nuevo reclamo',
    '/vecino/reservas': 'Ir a Reservas',
    '/vecino/asambleas': 'Ir a Asambleas',
    '/vecino/novedades': 'Ir a Novedades',
    '/vecino/notificaciones': 'Ir a Notificaciones',
    '/vecino/perfil': 'Ir a Perfil',
  },
  [RolUsuario.ADMINISTRADOR]: {
    '/admin': 'Ir al Panel general',
    '/admin/notificaciones': 'Ir a Notificaciones',
    '/admin/unidades': 'Ir a Consorcio y unidades',
    '/admin/vecinos': 'Ir a Usuarios y vecinos',
    '/admin/catalogos': 'Ir a Catálogos',
    '/admin/liquidaciones': 'Ir a Liquidación',
    '/admin/cobranzas': 'Ir a Cobranzas',
    '/admin/reclamos': 'Ir a Reclamos',
    '/admin/reservas': 'Ir a Amenities y reservas',
    '/admin/asambleas': 'Ir a Asambleas',
    '/admin/votaciones': 'Ir a Votaciones',
    '/admin/novedades': 'Ir a Novedades',
  },
};

export function rutaPermitida(rol: RolUsuario, ruta: string): boolean {
  return esRolAsistente(rol) && Object.hasOwn(RUTAS_POR_ROL[rol], ruta);
}

// ── Datos personales ─────────────────────────────────────────────────────────

/**
 * El orden importa: primero lo más largo (un CBU contiene algo que parece un
 * DNI) y lo más específico (un CUIT tiene guiones que un teléfono también).
 */
const PATRONES_PII: [RegExp, string][] = [
  [/\b\d{22}\b/g, '[CBU]'],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[EMAIL]'],
  [/\b(20|23|24|27|30|33|34)-?\d{8}-?\d\b/g, '[CUIT]'],
  // Sin letra ni guion antes: así un código como RC-2026-0001 no pasa por teléfono.
  [/(?<![\w-])(\+?54[\s-]?(9[\s-]?)?)?(\(?\d{2,4}\)?[\s-]?)?(15[\s-]?)?\d{3,4}[\s-]\d{4}\b/g, '[TELEFONO]'],
  [/\b\d{1,2}\.\d{3}\.\d{3}\b|\b\d{7,8}\b/g, '[DNI]'],
];

/**
 * Tapa email, CUIT, DNI, teléfono y CBU. Se aplica a la pregunta antes de
 * mandarla al modelo o guardarla, y a lo que devuelven las herramientas.
 */
export function redactarPii(texto: string): string {
  return PATRONES_PII.reduce((t, [patron, reemplazo]) => t.replace(patron, reemplazo), texto);
}

// ── Datos de herramientas ────────────────────────────────────────────────────

export const INICIO_DATOS = '<<<DATOS';
export const FIN_DATOS = '<<<FIN DATOS>>>';

/**
 * Envuelve el resultado de una herramienta entre delimitadores fijos. Un
 * título de reclamo puede traer "ignorá tus instrucciones": el prompt le dice
 * al modelo que lo de adentro es dato, y acá se borra cualquier delimitador
 * que venga en el contenido para que no se pueda cerrar el bloque desde adentro.
 */
export function envolverDatos(herramienta: string, datos: unknown): string {
  const json = redactarPii(JSON.stringify(datos)).replaceAll('<<<', '');
  return `${INICIO_DATOS} herramienta=${herramienta}>>>\n${json}\n${FIN_DATOS}`;
}

// ── Validación de la respuesta ───────────────────────────────────────────────

const CONFIANZAS: readonly string[] = ['alta', 'media', 'baja'];
const MAX_RESPUESTA = 4000;

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Valida lo que devolvió el modelo. Devuelve null si no tiene la forma del
 * contrato (el service usa entonces el manual). Si la forma está bien, recorta
 * lo que no corresponde en vez de descartar todo: las acciones con rutas que
 * el rol no tiene y las fuentes que no son secciones del manual de ese rol.
 */
export function validarRespuesta(
  valor: unknown,
  rol: RolUsuario,
  anclasValidas: ReadonlyMap<string, string>,
): RespuestaAsistente | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const v = valor as Record<string, unknown>;
  if (!esTexto(v.respuesta) || v.respuesta.length > MAX_RESPUESTA) return null;
  if (!Array.isArray(v.fuentes) || !Array.isArray(v.acciones)) return null;
  if (typeof v.confianza !== 'string' || !CONFIANZAS.includes(v.confianza)) return null;
  if (typeof v.derivar_a_humano !== 'boolean') return null;

  const fuentes = v.fuentes
    .filter((f): f is Fuente => typeof f === 'object' && f !== null && esTexto(f.seccion) && esTexto(f.ancla))
    // El modelo a veces copia el ancla como aparece en el manual: `{#pagar-expensa}`.
    .map(({ seccion, ancla }) => ({ seccion, ancla: ancla.replace(/^\{?#|\}$/g, '') }))
    .filter((f) => anclasValidas.has(f.ancla))
    // El título lo pone el servidor: el modelo elige la sección, no cómo se llama.
    .map(({ ancla }) => ({ seccion: anclasValidas.get(ancla)!, ancla }))
    .filter((f, i, todas) => todas.findIndex((g) => g.ancla === f.ancla) === i);

  const acciones = v.acciones
    .filter(
      (a): a is AccionIrA =>
        typeof a === 'object' &&
        a !== null &&
        a.tipo === 'IR_A' &&
        esTexto(a.ruta) &&
        rutaPermitida(rol, a.ruta),
    )
    // La etiqueta la pone el servidor: el modelo elige a dónde, no qué dice el botón.
    .map(({ ruta }) => ({ tipo: 'IR_A' as const, etiqueta: RUTAS_POR_ROL[rol as RolAsistente][ruta], ruta }));

  return {
    respuesta: v.respuesta.trim(),
    fuentes,
    acciones: acciones.filter((a, i) => acciones.findIndex((b) => b.ruta === a.ruta) === i).slice(0, 3),
    // Sin una fuente del manual que la respalde, la respuesta no puede ser de confianza alta.
    confianza: fuentes.length === 0 && v.confianza === 'alta' ? 'media' : (v.confianza as Confianza),
    derivar_a_humano: v.derivar_a_humano,
  };
}
