import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class PreguntaDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Para seguir una conversación. Sin esto arranca una nueva y la respuesta trae su id.',
  })
  @IsOptional()
  @IsUUID()
  conversacion_id?: string;

  @ApiProperty({ minLength: 1, maxLength: 500, example: '¿Cómo pago las expensas?' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/\S/, { message: 'pregunta no puede estar vacía' })
  pregunta: string;

  @ApiPropertyOptional({
    example: '/vecino/expensas',
    description: 'La pantalla desde donde se pregunta. Si no es una del portal del usuario, se ignora.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  pantalla?: string;
}
