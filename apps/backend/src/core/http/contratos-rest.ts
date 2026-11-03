import { BadRequestException, HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';

/** JSON estable: el orden de las propiedades no cambia el contenido lógico. */
export function canonico(valor: unknown): string {
  if (valor instanceof Date) return JSON.stringify(valor.toJSON());
  if (Array.isArray(valor)) return '[' + valor.map(canonico).join(',') + ']';
  if (valor && typeof valor === 'object') return '{' + Object.entries(valor)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => JSON.stringify(k) + ':' + canonico(v)).join(',') + '}';
  return JSON.stringify(valor);
}

export const huellaDe = (valor: unknown): string => createHash('sha256').update(canonico(valor)).digest('hex');
export const etagDe = (valor: unknown): string => '"' + huellaDe(valor) + '"';

export function claveValida(clave: string | undefined): string | undefined {
  if (clave !== undefined && !/^[\x21-\x7e]{1,128}$/.test(clave)) {
    throw new BadRequestException('Idempotency-Key debe tener entre 1 y 128 caracteres sin espacios');
  }
  return clave;
}

export function exigirIfMatch(valor: string | undefined): string {
  if (valor === undefined) throw new HttpException('Recargá el consorcio antes de guardar (falta If-Match)', 428);
  if (!/^"[a-f0-9]{64}"$/.test(valor)) throw new BadRequestException('If-Match debe contener un único ETag fuerte vigente');
  return valor;
}
