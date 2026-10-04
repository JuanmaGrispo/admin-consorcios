import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  actual: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La password tiene que tener al menos 8 caracteres' })
  nueva: string;
}
