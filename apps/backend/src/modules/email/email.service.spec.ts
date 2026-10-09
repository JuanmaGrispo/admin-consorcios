import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { crearSobre, type EventoDomus } from '../../core/mensajeria/eventos';
import { EnvioNotificacion, EstadoEnvio } from '../../database/entities';
import type { EmailRepository, VecinoDeUnidad } from './email.repository';
import { EmailService } from './email.service';
import type { Correo, MailerClient } from './mailer.client';

const vecino = (email: string, unidadId: string, etiqueta: string): VecinoDeUnidad => ({
  usuarioId: email,
  email,
  nombre: email.split('@')[0],
  unidadId,
  etiqueta,
});

const expensas = () =>
  crearSobre('expensas.emitidas', 'c1', {
    liquidacion_id: 'l1',
    periodo: '2026-10',
    unidades_afectadas: ['u1', 'u2'],
    fecha_vencimiento: '2026-11-10',
  }) as EventoDomus;

describe('EmailService', () => {
  let envios: EnvioNotificacion[];
  let enviados: Correo[];
  let caidos: Set<string>;
  /** Quiénes apagaron el mail, por categoría. */
  let apagados: Map<string, string[]>;
  let smtp: boolean;
  let service: EmailService;

  beforeEach(() => {
    envios = [];
    enviados = [];
    caidos = new Set();
    apagados = new Map();
    smtp = true;
    const repo = {
      vecinosDeUnidades: async () => [
        vecino('ana@x', 'u1', '3º B'),
        vecino('ana@x', 'u2', 'Cochera 4'),
        vecino('beto@x', 'u2', 'Cochera 4'),
      ],
      vecinosDelConsorcio: async () => [vecino('ana@x', 'u1', '3º B')],
      sinMail: async (ids: string[], categoria: string) =>
        new Set(ids.filter((id) => (apagados.get(categoria) ?? []).includes(id))),
      totalesDeLiquidacion: async () => new Map([['u1', 1000], ['u2', 200]]),
      usuario: async (id: string) => (id === 'v1' ? { usuarioId: 'v1', email: 'v1@x', nombre: 'Vale' } : null),
      buscarEnvio: async (eventoId: string, email: string) =>
        envios.find((e) => e.entidadId === eventoId && e.destinatario === email) ?? null,
      crearEnvio: async (d: Partial<EnvioNotificacion>) => {
        const envio = { id: `e${envios.length}`, ...d } as EnvioNotificacion;
        envios.push(envio);
        return envio;
      },
      actualizarEnvio: async (id: string, d: Partial<EnvioNotificacion>) =>
        void Object.assign(envios.find((e) => e.id === id)!, d),
    } as unknown as EmailRepository;
    const mailer = {
      get configurado() {
        return smtp;
      },
      enviar: async (c: Correo) => {
        if (caidos.has(c.para)) throw new Error('SMTP caído');
        enviados.push(c);
      },
    } as unknown as MailerClient;
    service = new EmailService(repo, mailer);
  });

  it('no le escribe a quien apagó el mail de esa categoría', async () => {
    apagados.set('BOLETAS', ['beto@x']);
    await service.procesar(expensas());
    assert.deepEqual(enviados.map((c) => c.para), ['ana@x']);
  });

  it('apagar otra categoría no cambia nada', async () => {
    apagados.set('COMUNICADOS', ['beto@x']);
    await service.procesar(expensas());
    assert.deepEqual(enviados.map((c) => c.para), ['ana@x', 'beto@x']);
  });

  it('las expensas llegan una vez por persona, con todas sus unidades', async () => {
    await service.procesar(expensas());
    assert.deepEqual(enviados.map((c) => c.para), ['ana@x', 'beto@x']);
    assert.match(enviados[0].texto, /3º B[\s\S]*Cochera 4/);
    assert.ok(envios.every((e) => e.estado === EstadoEnvio.ENVIADO && e.intentos === 1));
  });

  it('si un mail falla, lanza para reintentar y no repite los que ya salieron', async () => {
    const evento = expensas();
    caidos.add('beto@x');
    await assert.rejects(service.procesar(evento), /1 de 2 mails/);
    assert.equal(envios.find((e) => e.destinatario === 'beto@x')?.estado, EstadoEnvio.FALLIDO);

    caidos.clear();
    await service.procesar(evento);
    assert.deepEqual(enviados.map((c) => c.para), ['ana@x', 'beto@x']);
    assert.equal(envios.find((e) => e.destinatario === 'beto@x')?.intentos, 2);
  });

  it('el aviso directo va a una sola persona; si no existe, a nadie', async () => {
    const aviso = (destinatario_id: string) =>
      crearSobre('aviso.directo', null, {
        destinatario_id,
        asunto: 'Se aprobó tu reserva',
        cuerpo: 'Ya podés usar el SUM.',
        origen: 'reserva:r1',
      }) as EventoDomus;
    await service.procesar(aviso('v1'));
    await service.procesar(aviso('borrado'));
    assert.deepEqual(enviados.map((c) => [c.para, c.asunto]), [['v1@x', 'Se aprobó tu reserva']]);
  });

  it('sin SMTP no manda ni registra nada', async () => {
    smtp = false;
    await service.procesar(expensas());
    assert.equal(enviados.length, 0);
    assert.equal(envios.length, 0);
  });
});
