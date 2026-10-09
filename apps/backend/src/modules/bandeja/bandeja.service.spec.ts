import { NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearSobre } from '../../core/mensajeria/eventos';
import type { AvisoDeBandeja } from './bandeja';
import type { BandejaRepository } from './bandeja.repository';
import { BandejaService } from './bandeja.service';

function crearService() {
  const guardados: { eventoId: string; usuarioIds: string[]; aviso: AvisoDeBandeja }[] = [];
  const repo = {
    vecinosDelConsorcio: async (c: string) => (c === 'c1' ? ['v1', 'v2'] : []),
    vecinosDeUnidades: async () => ['v1'],
    estaActivo: async (id: string) => id !== 'baja',
    guardar: async (eventoId: string, usuarioIds: string[], aviso: AvisoDeBandeja) => {
      guardados.push({ eventoId, usuarioIds, aviso });
      return true;
    },
    marcarLeida: async (usuarioId: string, id: string) => usuarioId === 'v1' && id === 'n1',
  } as unknown as BandejaRepository;
  return { service: new BandejaService(repo), guardados };
}

describe('BandejaService', () => {
  it('una novedad llega a todos los vecinos del consorcio', async () => {
    const { service, guardados } = crearService();
    await service.procesar(crearSobre('novedad.publicada', 'c1', { novedad_id: 'nv1', titulo: 'Corte de agua' }));
    assert.deepEqual(guardados[0].usuarioIds, ['v1', 'v2']);
    assert.equal(guardados[0].aviso.titulo, 'Corte de agua');
  });

  it('un aviso directo, sólo a su destinatario si sigue activo', async () => {
    const { service, guardados } = crearService();
    const aviso = (destinatario_id: string) =>
      crearSobre('aviso.directo', null, { destinatario_id, asunto: 'Hola', cuerpo: '…', origen: 'pago:p1' });
    await service.procesar(aviso('v1'));
    await service.procesar(aviso('baja'));
    assert.deepEqual(guardados.map((g) => g.usuarioIds), [['v1'], []]);
  });

  it('marcar una ajena da 404', async () => {
    const { service } = crearService();
    await service.marcarLeida('v1', 'n1');
    await assert.rejects(service.marcarLeida('v2', 'n1'), NotFoundException);
  });
});
