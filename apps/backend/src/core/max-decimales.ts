import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Si `valor` es un número finito con `maximo` decimales o menos.
 *
 * `@IsNumber({ maxDecimalPlaces })` de class-validator 0.14 cuenta los decimales
 * partiendo el texto del número por el punto, y JavaScript escribe 0.0000001
 * como `1e-7`, sin punto: la validación tiraba un TypeError y la API respondía
 * 500 (DEF-18). Acá se compara contra el número redondeado a `maximo`
 * decimales, que no depende de cómo se escriba.
 */
export function tieneMaxDecimales(valor: unknown, maximo: number): boolean {
  return typeof valor === 'number' && Number.isFinite(valor) && Number(valor.toFixed(maximo)) === valor;
}

/** Reemplaza a `@IsNumber({ maxDecimalPlaces })`; se usa junto con `@IsNumber()`. */
export function MaxDecimales(maximo: number, opciones?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxDecimales',
      constraints: [maximo],
      validator: {
        validate: (valor: unknown) => tieneMaxDecimales(valor, maximo),
        defaultMessage: (args) => `${args?.property ?? 'El valor'} admite hasta ${maximo} decimales`,
      },
    },
    opciones,
  );
}
