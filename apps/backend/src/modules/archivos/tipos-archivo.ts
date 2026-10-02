import { RolUsuario } from '../../database/entities';

/**
 * Qué se puede subir y a dónde. Cada columna `*_url` de la base tiene su
 * destino: así las fotos de un reclamo no pueden terminar guardadas como si
 * fueran un acta de asamblea, y cada destino impone sus propias reglas.
 */
export enum DestinoArchivo {
  /** Fotos que adjunta el vecino a un reclamo (`reclamo_adjunto.url`). */
  RECLAMOS = 'reclamos',
  /** Facturas y comprobantes de un gasto (`gasto.comprobante_url`). */
  COMPROBANTES = 'comprobantes',
  /** Adjuntos del muro (`novedad_adjunto.url`). */
  NOVEDADES = 'novedades',
  /** Presupuesto que acompaña una propuesta (`votacion.adjunto_url`). */
  VOTACIONES = 'votaciones',
  /** Acta firmada de una asamblea (`asamblea.acta_url`). */
  ACTAS = 'actas',
  /** Foto de perfil (`usuario.avatar_url`). */
  AVATARES = 'avatares',
}

/** Los tipos que sabemos reconocer por su contenido. */
export enum TipoArchivo {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  PDF = 'application/pdf',
}

const EXTENSIONES: Record<TipoArchivo, string> = {
  [TipoArchivo.JPEG]: 'jpg',
  [TipoArchivo.PNG]: 'png',
  [TipoArchivo.WEBP]: 'webp',
  [TipoArchivo.PDF]: 'pdf',
};

const IMAGENES = [TipoArchivo.JPEG, TipoArchivo.PNG, TipoArchivo.WEBP];
const MB = 1024 * 1024;

export interface ReglaDestino {
  tipos: TipoArchivo[];
  tamanioMaximo: number;
  /** `null` = cualquiera con sesión. Si no, el rol mínimo. */
  rol: RolUsuario | null;
}

/**
 * Las reglas de cada destino, en un solo lugar. Los límites salen de para qué
 * sirve cada cosa: una foto sacada con el celular entra holgada en 8 MB, y un
 * avatar que pesa más de 2 MB es un archivo mal preparado, no una foto.
 */
export const REGLAS: Record<DestinoArchivo, ReglaDestino> = {
  // El vecino saca la foto desde la app: sólo imágenes.
  [DestinoArchivo.RECLAMOS]: { tipos: IMAGENES, tamanioMaximo: 8 * MB, rol: null },
  // Una factura llega escaneada o en PDF, y la carga quien administra.
  [DestinoArchivo.COMPROBANTES]: {
    tipos: [...IMAGENES, TipoArchivo.PDF],
    tamanioMaximo: 10 * MB,
    rol: RolUsuario.ADMINISTRADOR,
  },
  [DestinoArchivo.NOVEDADES]: {
    tipos: [...IMAGENES, TipoArchivo.PDF],
    tamanioMaximo: 10 * MB,
    rol: RolUsuario.ADMINISTRADOR,
  },
  [DestinoArchivo.VOTACIONES]: {
    tipos: [...IMAGENES, TipoArchivo.PDF],
    tamanioMaximo: 10 * MB,
    rol: RolUsuario.ADMINISTRADOR,
  },
  // Un acta es un documento firmado: PDF y nada más.
  [DestinoArchivo.ACTAS]: {
    tipos: [TipoArchivo.PDF],
    tamanioMaximo: 10 * MB,
    rol: RolUsuario.ADMINISTRADOR,
  },
  [DestinoArchivo.AVATARES]: { tipos: IMAGENES, tamanioMaximo: 2 * MB, rol: null },
};

/** El límite más grande de todos: lo que multer acepta antes de mirar nada. */
export const TAMANIO_MAXIMO_ABSOLUTO = Math.max(
  ...Object.values(REGLAS).map((r) => r.tamanioMaximo),
);

/**
 * Qué es el archivo **de verdad**, mirando sus primeros bytes. El
 * `Content-Type` que manda el cliente es un dato que escribe el cliente: con
 * cambiarle la extensión a un ejecutable alcanzaría para que entrara como
 * imagen. Devuelve `null` si no es ninguno de los tipos que aceptamos.
 */
export function detectarTipo(contenido: Buffer): TipoArchivo | null {
  if (contenido.length >= 3 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff) {
    return TipoArchivo.JPEG;
  }
  if (
    contenido.length >= 8 &&
    contenido.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return TipoArchivo.PNG;
  }
  // WebP es un contenedor RIFF: "RIFF" ···· "WEBP".
  if (
    contenido.length >= 12 &&
    contenido.subarray(0, 4).toString('ascii') === 'RIFF' &&
    contenido.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return TipoArchivo.WEBP;
  }
  if (contenido.length >= 5 && contenido.subarray(0, 5).toString('ascii') === '%PDF-') {
    return TipoArchivo.PDF;
  }
  return null;
}

export const extensionDe = (tipo: TipoArchivo): string => EXTENSIONES[tipo];

/** Para el mensaje de error: "JPG, PNG o WEBP". */
export const nombrarTipos = (tipos: TipoArchivo[]): string =>
  tipos.map((t) => extensionDe(t).toUpperCase()).join(', ');

/** Para el mensaje de error: "8 MB". */
export const enMegas = (bytes: number): string => `${Math.round(bytes / MB)} MB`;
