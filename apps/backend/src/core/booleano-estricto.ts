import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, type ValidationOptions } from 'class-validator';

/**
 * Reemplaza a `@IsBoolean()` en los campos booleanos de un body.
 *
 * El ValidationPipe global usa `enableImplicitConversion`, que convierte el
 * valor al tipo de la propiedad antes de validar: `"false"` (o cualquier texto
 * no vacío) llegaba como `true` y pasaba `@IsBoolean()`, así que la API
 * guardaba lo contrario de lo pedido (DEF-15). El `@Transform` devuelve el
 * valor crudo del pedido, de modo que un texto llega como texto y
 * `@IsBoolean()` lo rechaza con 400.
 *
 * Para los flags de un query string, donde todo llega como texto, se usa
 * `@Transform(booleanoDeQuery)` en su lugar.
 */
export function BooleanoEstricto(opciones?: ValidationOptions): PropertyDecorator {
  return applyDecorators(
    Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key]),
    IsBoolean(opciones),
  );
}
