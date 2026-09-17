import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoReclamo, PrioridadReclamo } from '../../../database/entities';

/**
 * Filtros de la bandeja. El prototipo muestra, del lado del vecino, tres
 * solapas —Todos / Abiertos / Cerrados— y del lado del administrador, filtros
 * por estado, prioridad y categoría.
 */
export class ListarReclamosQuery {
  @ApiPropertyOptional({ enum: EstadoReclamo })
  @IsOptional()
  @IsEnum(EstadoReclamo)
  estado?: EstadoReclamo;

  /**
   * Atajo para las solapas del vecino: `abiertos` es todo lo que no está
   * resuelto. Se resuelve acá y no en el cliente para que "abierto" signifique
   * lo mismo en toda la app.
   */
  @ApiPropertyOptional({ enum: ['abiertos', 'cerrados'] })
  @IsOptional()
  @IsEnum(['abiertos', 'cerrados'])
  situacion?: 'abiertos' | 'cerrados';

  @ApiPropertyOptional({ enum: PrioridadReclamo })
  @IsOptional()
  @IsEnum(PrioridadReclamo)
  prioridad?: PrioridadReclamo;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  consorcioId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ description: 'Busca en la descripción y en el código' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  buscar?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  // Con tope: sin él, un `limite=100000` es una forma fácil de voltear la API.
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}
