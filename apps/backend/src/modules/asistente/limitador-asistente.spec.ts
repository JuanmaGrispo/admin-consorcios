import { HttpException, HttpStatus } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LimitadorAsistente, MAX_POR_DIA, MAX_POR_MINUTO } from './limitador-asistente';

const MINUTO = 60_000;

const es429 = (e: unknown) => e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS;

describe('LimitadorAsistente', () => {
  it(`deja ${MAX_POR_MINUTO} por minuto y libera al minuto siguiente`, () => {
    let ahora = 0;
    const l = new LimitadorAsistente(() => ahora);
    for (let i = 0; i < MAX_POR_MINUTO; i++) l.registrar('u');
    assert.throws(() => l.registrar('u'), es429);
    // Otro usuario no se entera.
    l.registrar('otro');
    ahora += MINUTO;
    l.registrar('u');
  });

  it(`deja ${MAX_POR_DIA} por día`, () => {
    let ahora = 0;
    const l = new LimitadorAsistente(() => ahora);
    for (let i = 0; i < MAX_POR_DIA; i++) {
      l.registrar('u');
      ahora += MINUTO;
    }
    assert.throws(() => l.registrar('u'), /por hoy/);
    ahora += 24 * 60 * MINUTO;
    l.registrar('u');
  });
});
