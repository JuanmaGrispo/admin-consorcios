import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUrl, MaxLength } from 'class-validator';
import { DestinoArchivo } from '../tipos-archivo';

export class SubirArchivoQuery {
  @ApiProperty({
    enum: DestinoArchivo,
    description: 'Para qué es el archivo. Cada destino tiene sus tipos, su tamaño y su rol.',
  })
  @IsEnum(DestinoArchivo)
  destino: DestinoArchivo;
}

export class BorrarArchivoQuery {
  @ApiProperty({ description: 'La URL que devolvió la subida' })
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_protocol: true }, { message: 'url no es una URL válida' })
  url: string;
}
