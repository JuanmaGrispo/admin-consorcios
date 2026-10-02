import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ArchivosService, type ArchivoSubido } from './archivos.service';
import { BorrarArchivoQuery, SubirArchivoQuery } from './dto/subir-archivo.query';
import { TAMANIO_MAXIMO_ABSOLUTO } from './tipos-archivo';

/**
 * La única forma de meter un archivo en el sistema. Todo lo demás —las fotos
 * de un reclamo, el comprobante de un gasto, el acta de una asamblea— guarda
 * la URL que devuelve esto.
 */
@ApiTags('archivos')
@ApiBearerAuth()
@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivos: ArchivosService) {}

  @Post()
  // El tope de multer es el más grande de todos los destinos: corta lo
  // desmedido antes de leerlo entero. El límite fino lo pone el service, que
  // ya sabe a qué destino va.
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANIO_MAXIMO_ABSOLUTO } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Sube un archivo',
    description:
      'Devuelve `{ url, ruta, tipo, tamanio }`. El tipo se detecta por el contenido, no por el `Content-Type` que manda el cliente.',
  })
  @ApiResponse({ status: 400, description: 'Tipo no permitido para ese destino, o muy pesado' })
  @ApiResponse({ status: 403, description: 'El destino pide rol de administrador' })
  @ApiResponse({ status: 503, description: 'Falta configurar el storage' })
  subir(
    @UsuarioActual() usuario: Usuario,
    @Query() query: SubirArchivoQuery,
    @UploadedFile() archivo: ArchivoSubido,
  ) {
    return this.archivos.subir(usuario, query.destino, archivo);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borra un archivo propio',
    description:
      'Para la foto que se descarta antes de mandar el formulario. El vecino sólo borra las suyas.',
  })
  borrar(@UsuarioActual() usuario: Usuario, @Query() query: BorrarArchivoQuery) {
    return this.archivos.borrar(usuario, query.url);
  }
}
