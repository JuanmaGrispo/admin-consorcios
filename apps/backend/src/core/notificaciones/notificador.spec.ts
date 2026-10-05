import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PublicadorEventos } from '../mensajeria/publicador-eventos';
import { Notificador } from './notificador';

describe('Notificador', () => {
  it('publica el aviso como evento aviso.directo, sin consorcio', async () => {
    const publicados: unknown[][] = [];
    const eventos = { publicar: (...args: unknown[]) => void publicados.push(args) } as unknown as PublicadorEventos;
    await new Notificador(eventos).enviar({
      destinatarioId: 'v1',
      asunto: 'Se aprobó tu reserva',
      cuerpo: 'Ya podés usar el SUM.',
      origen: 'reserva:r1',
    });
    assert.deepEqual(publicados, [
      [
        'aviso.directo',
        null,
        { destinatario_id: 'v1', asunto: 'Se aprobó tu reserva', cuerpo: 'Ya podés usar el SUM.', origen: 'reserva:r1' },
      ],
    ]);
  });
});
