const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/**
 * El texto de `respuesta` dentro de un JSON que todavía está llegando, por
 * ejemplo `{"respuesta":"Andá a **Exp`. Sirve para mostrar la respuesta a
 * medida que el modelo la escribe: el esquema pone `respuesta` primero, así
 * que es lo primero que llega. Devuelve null si todavía no empezó.
 *
 * Una secuencia de escape cortada a la mitad (`\u00`) se deja para la
 * próxima vuelta en vez de mostrar basura.
 */
export function respuestaParcial(json: string): string | null {
  const inicio = /"respuesta"\s*:\s*"/.exec(json);
  if (!inicio) return null;
  let texto = '';
  for (let i = inicio.index + inicio[0].length; i < json.length; i++) {
    const c = json[i];
    if (c === '"') return texto;
    if (c !== '\\') {
      texto += c;
      continue;
    }
    const siguiente = json[i + 1];
    if (siguiente === undefined) return texto;
    if (siguiente === 'u') {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) return texto;
      texto += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    texto += ESCAPES[siguiente] ?? siguiente;
    i += 1;
  }
  return texto;
}
