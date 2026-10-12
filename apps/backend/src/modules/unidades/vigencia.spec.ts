import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const MODULOS = join(__dirname, '..');

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return fuentes(ruta);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [ruta] : [];
  });
}

// Terminar un vínculo pone `hasta` = hoy: si hoy contara como vigente, el
// vecino seguiría viendo la unidad hasta mañana.
describe('vigencia de vínculos', () => {
  it('ninguna consulta toma como vigente un vínculo que termina hoy', () => {
    const inclusivas = fuentes(MODULOS).filter((f) => /hasta\s*>=\s*CURRENT_DATE/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(inclusivas, []);
  });

  it('las consultas de vigencia usan hasta > CURRENT_DATE', () => {
    const exclusivas = fuentes(MODULOS).filter((f) => /hasta\s*>\s*CURRENT_DATE/.test(readFileSync(f, 'utf8')));
    assert.ok(exclusivas.length >= 11, `sólo ${exclusivas.length} archivos`);
  });
});
