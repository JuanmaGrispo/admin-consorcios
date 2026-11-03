import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PublicadorEventos } from './publicador-eventos';
import { RabbitClient } from './rabbit.client';

test('sin broker configurado se exige persistencia del aviso y se propaga su fallo', async () => {
  const pendientes: string[] = [];
  let fallar = false;
  const client = { configurado: false, publicar: async (_tipo: string, contenido: Buffer) => {
    if (fallar) throw new Error('Outbox no disponible');
    pendientes.push(contenido.toString());
    return true;
  } } as unknown as RabbitClient;
  const service = new PublicadorEventos(client);
  const aviso = { destinatario_id: randomUUID(), asunto: 'Aviso', cuerpo: 'Prueba', origen: 'prueba' };
  await service.publicar('aviso.directo', null, aviso);
  assert.equal(pendientes.length, 1);
  fallar = true;
  await assert.rejects(service.publicar('aviso.directo', null, aviso), /Outbox no disponible/);
});
