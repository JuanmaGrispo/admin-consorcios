import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ArchivosClient } from './archivos.client';
import {
  DestinoArchivo,
  REGLAS,
  TipoArchivo,
  detectarTipo,
  enMegas,
  extensionDe,
  nombrarTipos,
} from './tipos-archivo';

/** Lo que llega de multer. Tipado acá para no depender de `@types/multer`. */
export interface ArchivoSubido {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ArchivoGuardado {
  url: string;
  /** La ruta dentro del bucket. Guardala si alguna vez el bucket se hace privado. */
  ruta: string;
  tipo: TipoArchivo;
  tamanio: number;
}

/** Quien administra puede subir a cualquier destino; el vecino, sólo a los suyos. */
const puede = (usuario: UsuarioActual, rolRequerido: RolUsuario | null): boolean =>
  rolRequerido === null || usuario.rol !== RolUsuario.VECINO;

@Injectable()
export class ArchivosService {
  constructor(private readonly storage: ArchivosClient) {}

  /**
   * Valida y guarda. El orden importa: primero quién, después qué es de
   * verdad el archivo, y recién al final cuánto pesa según su destino —así el
   * error que recibe quien sube es el primero que lo frena, y no el último.
   */
  async subir(
    usuario: UsuarioActual,
    destino: DestinoArchivo,
    archivo: ArchivoSubido | undefined,
  ): Promise<ArchivoGuardado> {
    if (!archivo?.buffer?.length) {
      throw new BadRequestException('Mandá un archivo en el campo `archivo`');
    }

    const regla = REGLAS[destino];
    if (!puede(usuario, regla.rol)) {
      throw new ForbiddenException(`No podés subir archivos a ${destino}`);
    }

    // El `Content-Type` lo escribe el cliente: lo que manda es el contenido.
    const tipo = detectarTipo(archivo.buffer);
    if (!tipo || !regla.tipos.includes(tipo)) {
      throw new BadRequestException(
        `A ${destino} se suben archivos ${nombrarTipos(regla.tipos)}`,
      );
    }

    if (archivo.buffer.length > regla.tamanioMaximo) {
      throw new BadRequestException(
        `El archivo supera el máximo de ${enMegas(regla.tamanioMaximo)} para ${destino}`,
      );
    }

    // El nombre original no se usa en la ruta: viene del cliente y puede traer
    // barras, "..", o pisar un archivo ajeno. El uuid además hace que la URL
    // pública no se pueda adivinar.
    const ruta = `${destino}/${usuario.id}/${randomUUID()}.${extensionDe(tipo)}`;
    const url = await this.storage.subir(ruta, archivo.buffer, tipo);

    return { url, ruta, tipo, tamanio: archivo.buffer.length };
  }

  /**
   * Para los módulos que guardan una URL: confirma que la subimos nosotros y
   * al destino que corresponde. Sin esto, un `@IsUrl()` deja guardar una URL
   * externa —o una foto de reclamo— como si fuera, por ejemplo, un acta.
   */
  exigirPropia(url: string, destino: DestinoArchivo): void {
    const ruta = this.storage.rutaDeUrl(url);
    if (!ruta?.startsWith(`${destino}/`)) {
      throw new BadRequestException(`Esa URL no es de un archivo subido a ${destino}`);
    }
  }

  /**
   * Borra un archivo propio por su URL. Sirve para la foto que el vecino
   * saca y descarta antes de mandar el reclamo: si no, cada arrepentimiento
   * dejaría basura en el bucket para siempre.
   *
   * Sólo quien lo subió, o quien administra: el id del dueño está en la ruta.
   */
  async borrar(usuario: UsuarioActual, url: string): Promise<void> {
    const ruta = this.storage.rutaDeUrl(url);
    if (!ruta) throw new BadRequestException('Esa URL no es de un archivo nuestro');

    const [, propietarioId] = ruta.split('/');
    if (usuario.rol === RolUsuario.VECINO && propietarioId !== usuario.id) {
      // 404 y no 403: un 403 confirmaría que el archivo existe.
      throw new BadRequestException('Esa URL no es de un archivo nuestro');
    }

    await this.storage.borrar(ruta);
  }
}
