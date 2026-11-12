import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RolUsuario } from '../../database/entities';
import type { RolAsistente } from './politica';

/** Una sección del manual: lo que el asistente cita como fuente. */
export interface Seccion {
  titulo: string;
  ancla: string;
  texto: string;
}

/** El manual que ve un rol: el común más el suyo. */
export interface ManualDelRol {
  /** El markdown tal cual, para mandarle al modelo. */
  texto: string;
  secciones: Seccion[];
  /** Cada ancla con el título de su sección. */
  anclas: ReadonlyMap<string, string>;
}

const ARCHIVOS: Record<RolAsistente, string[]> = {
  [RolUsuario.VECINO]: ['comun.md', 'vecino.md'],
  [RolUsuario.ADMINISTRADOR]: ['comun.md', 'administrador.md'],
};

/**
 * A qué pantalla lleva cada sección, por rol. Lo usa el fallback para armar
 * el botón sin preguntarle al modelo. Una sección sin pantalla (errores,
 * soporte) responde sólo con texto.
 */
export const PANTALLA_DE_SECCION: Record<RolAsistente, Record<string, string>> = {
  [RolUsuario.VECINO]: {
    'estados-boleta': '/vecino/expensas',
    'estados-reclamo': '/vecino/reclamos',
    'estados-reserva': '/vecino/reservas',
    'calculo-boleta': '/vecino/expensas',
    'ultima-boleta': '/vecino/expensas',
    'pago-pendiente': '/vecino/expensas',
    'varias-unidades': '/vecino',
    'no-llegan-mails': '/vecino/perfil',
    'primer-ingreso': '/vecino',
    'pagar-expensa': '/vecino/expensas',
    'historial-boletas': '/vecino/expensas',
    'abrir-reclamo': '/vecino/reclamos',
    'reservar-amenity': '/vecino/reservas',
    'cancelar-reserva': '/vecino/reservas',
    'asamblea-votar': '/vecino/asambleas',
    'preferencias-aviso': '/vecino/perfil',
    campana: '/vecino/notificaciones',
    novedades: '/vecino/novedades',
  },
  [RolUsuario.ADMINISTRADOR]: {
    'estados-boleta': '/admin/cobranzas',
    'estados-reclamo': '/admin/reclamos',
    'estados-reserva': '/admin/reservas',
    'calculo-boleta': '/admin/liquidaciones',
    'primera-liquidacion': '/admin/liquidaciones',
    'estados-liquidacion': '/admin/liquidaciones',
    'unidades-vecinos': '/admin/unidades',
    'datos-vecino': '/admin/vecinos',
    'registrar-pago': '/admin/cobranzas',
    cobranza: '/admin/cobranzas',
    'atender-reclamo': '/admin/reclamos',
    amenities: '/admin/reservas',
    asambleas: '/admin/asambleas',
    votaciones: '/admin/votaciones',
    'publicar-novedad': '/admin/novedades',
    catalogos: '/admin/catalogos',
    'panel-general': '/admin',
  },
};

const TITULO = /^## (.+?) \{#([a-z0-9-]+)\}\s*$/;

/** Corta un markdown en secciones por sus títulos `## Título {#ancla}`. */
export function parsearSecciones(markdown: string): Seccion[] {
  const secciones: Seccion[] = [];
  let actual: Seccion | null = null;
  for (const linea of markdown.split('\n')) {
    const titulo = TITULO.exec(linea);
    if (titulo) {
      actual = { titulo: titulo[1], ancla: titulo[2], texto: '' };
      secciones.push(actual);
    } else if (actual) {
      actual.texto += `${linea}\n`;
    }
  }
  return secciones.map((s) => ({ ...s, texto: s.texto.trim() }));
}

const DIRECTORIO = join(__dirname, 'manual');
const cache = new Map<RolAsistente, ManualDelRol>();

/**
 * El manual de un rol, leído una vez por proceso. Los .md viajan al build
 * como assets (nest-cli.json): si cambia el manual, se redespliega.
 */
export function manualDelRol(rol: RolAsistente, directorio = DIRECTORIO): ManualDelRol {
  const guardado = directorio === DIRECTORIO ? cache.get(rol) : undefined;
  if (guardado) return guardado;
  const textos = ARCHIVOS[rol].map((archivo) => readFileSync(join(directorio, archivo), 'utf8'));
  const secciones = textos.flatMap(parsearSecciones);
  const manual = {
    texto: textos.join('\n\n'),
    secciones,
    anclas: new Map(secciones.map((s) => [s.ancla, s.titulo])),
  };
  if (directorio === DIRECTORIO) cache.set(rol, manual);
  return manual;
}
