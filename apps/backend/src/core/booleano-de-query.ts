/**
 * Para `@Transform` en los flags de un query string (`?incluirInactivas=true`).
 *
 * Lee el valor crudo: con la conversión implícita del ValidationPipe, `"false"`
 * llegaría como `true` (Boolean de un string no vacío), así que se compara
 * contra el texto original.
 */
export const booleanoDeQuery = ({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}) => obj[key] === true || obj[key] === 'true';
