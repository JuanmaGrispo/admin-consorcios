import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { FallaDelModelo, type AIGateway, type ContextoPregunta, type ResultadoGateway } from './ai-gateway';
import type { AsistenteRepository, NuevaInteraccion } from './asistente.repository';
import { AsistenteService } from './asistente.service';
import { FALLAS_PARA_ABRIR } from './disyuntor';
import type { HerramientasAsistente } from './herramientas';
import { ManualClient } from './manual.client';

const VECINO: UsuarioActual = { id: 'u1', email: 'v@x', rol: RolUsuario.VECINO };

const VALIDA = {
  respuesta: 'Andá a **Expensas** y tocá **Pagar** en la boleta vigente.',
  fuentes: [{ seccion: 'Cómo pagar las expensas con Mercado Pago', ancla: 'pagar-expensa' }],
  acciones: [{ tipo: 'IR_A', etiqueta: 'Pagar', ruta: '/vecino/expensas' }],
  confianza: 'alta',
  derivar_a_humano: false,
};

/** Un gateway falso: cada pregunta corre la función que le toque al test. */
class GatewayFalso implements AIGateway {
  disponible = true;
  llamadas = 0;
  constructor(public responderCon: (ctx: ContextoPregunta) => Promise<ResultadoGateway>) {}
  responder(ctx: ContextoPregunta) {
    this.llamadas++;
    return this.responderCon(ctx);
  }
}

function repoFalso(opciones: { habilitado?: boolean; costoDelDia?: number } = {}) {
  const registradas: NuevaInteraccion[] = [];
  const repo = {
    registradas,
    habilitado: async () => opciones.habilitado ?? true,
    historial: async () => [],
    registrar: async (d: NuevaInteraccion) => {
      registradas.push(d);
      return `i${registradas.length}`;
    },
    costoDelDia: async () => opciones.costoDelDia ?? 0,
  };
  return repo as unknown as AsistenteRepository & { registradas: NuevaInteraccion[] };
}

const config = { get: () => undefined } as unknown as ConfigService;
const herramientas = {
  ejecutar: async () => ({}),
  alcance: async () => 'Las unidades del usuario son: 3º B.',
} as unknown as HerramientasAsistente;

function crear(gateway: GatewayFalso, repo = repoFalso()) {
  return new AsistenteService(gateway, new ManualClient(), herramientas, repo, config);
}

const preguntar = (s: AsistenteService, pregunta = '¿Cómo pago las expensas?', usuario = VECINO) =>
  s.preguntar(usuario, { pregunta });

describe('AsistenteService', () => {
  let repo: ReturnType<typeof repoFalso>;
  beforeEach(() => {
    repo = repoFalso();
  });

  it('con una respuesta válida del modelo responde con origen llm', async () => {
    const s = crear(new GatewayFalso(async () => ({ respuesta: VALIDA, herramientas: [] })), repo);
    const r = await preguntar(s);
    assert.equal(r.origen, 'llm');
    assert.equal(r.respuesta, VALIDA.respuesta);
    assert.deepEqual(r.fuentes, VALIDA.fuentes);
    // La etiqueta del botón la pone el servidor.
    assert.deepEqual(r.acciones, [{ tipo: 'IR_A', etiqueta: 'Ir a Expensas', ruta: '/vecino/expensas' }]);
    assert.equal(r.interaccion_id, 'i1');
    assert.ok(r.conversacion_id);
    assert.equal(repo.registradas[0].origen, 'llm');
  });

  it('si el modelo no responde a tiempo, responde el manual', async () => {
    const s = crear(new GatewayFalso(async () => Promise.reject(new FallaDelModelo('timeout'))), repo);
    const r = await preguntar(s);
    assert.equal(r.origen, 'manual');
    assert.equal(r.fuentes[0]?.ancla, 'pagar-expensa');
    assert.equal(repo.registradas[0].error, 'timeout');
  });

  it('si el modelo devuelve algo que no es el contrato, responde el manual', async () => {
    const s = crear(new GatewayFalso(async () => ({ respuesta: { texto: 'hola' }, herramientas: [] })), repo);
    const r = await preguntar(s);
    assert.equal(r.origen, 'manual');
    assert.equal(repo.registradas[0].error, 'json_invalido');
  });

  it('descarta la acción con una ruta inventada y deja el resto', async () => {
    const respuesta = {
      ...VALIDA,
      acciones: [
        { tipo: 'IR_A', etiqueta: 'Borrar todo', ruta: '/admin/borrar-todo' },
        { tipo: 'IR_A', etiqueta: 'Expensas', ruta: '/vecino/expensas' },
      ],
    };
    const s = crear(new GatewayFalso(async () => ({ respuesta, herramientas: [] })), repo);
    const r = await preguntar(s);
    assert.equal(r.origen, 'llm');
    assert.deepEqual(r.acciones.map((a) => a.ruta), ['/vecino/expensas']);
  });

  it(`con ${FALLAS_PARA_ABRIR} errores seguidos, la siguiente pregunta va directo al manual`, async () => {
    const gateway = new GatewayFalso(async () => Promise.reject(new FallaDelModelo('proveedor')));
    const s = crear(gateway, repo);
    for (let i = 0; i < FALLAS_PARA_ABRIR; i++) await preguntar(s);
    assert.equal(gateway.llamadas, FALLAS_PARA_ABRIR);

    gateway.responderCon = async () => ({ respuesta: VALIDA, herramientas: [] });
    const r = await preguntar(s);
    assert.equal(r.origen, 'manual');
    assert.equal(gateway.llamadas, FALLAS_PARA_ABRIR, 'no volvió a llamar al modelo');
    assert.equal(repo.registradas.at(-1)?.error, 'disyuntor_abierto');
  });

  it('una negativa del modelo responde con origen rechazo y deriva', async () => {
    const s = crear(new GatewayFalso(async () => ({ respuesta: null, herramientas: [], rechazada: true })), repo);
    const r = await preguntar(s);
    assert.equal(r.origen, 'rechazo');
    assert.equal(r.derivar_a_humano, true);
  });

  it('pasado el tope diario de gasto no llama al modelo', async () => {
    const gateway = new GatewayFalso(async () => ({ respuesta: VALIDA, herramientas: [] }));
    const r = await preguntar(crear(gateway, repoFalso({ costoDelDia: 5 })));
    assert.equal(r.origen, 'manual');
    assert.equal(gateway.llamadas, 0);
  });

  it('sin API key responde el manual sin intentar', async () => {
    const gateway = new GatewayFalso(async () => ({ respuesta: VALIDA, herramientas: [] }));
    gateway.disponible = false;
    const r = await preguntar(crear(gateway, repo));
    assert.equal(r.origen, 'manual');
    assert.equal(gateway.llamadas, 0);
  });

  it('apagado responde 503', async () => {
    const s = crear(new GatewayFalso(async () => ({ respuesta: VALIDA, herramientas: [] })), repoFalso({ habilitado: false }));
    await assert.rejects(preguntar(s), (e: unknown) => e instanceof HttpException && e.getStatus() === HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('a la 11.ª pregunta en un minuto responde 429', async () => {
    const s = crear(new GatewayFalso(async () => ({ respuesta: VALIDA, herramientas: [] })), repo);
    for (let i = 0; i < 10; i++) await preguntar(s);
    await assert.rejects(preguntar(s), (e: unknown) => e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS);
  });

  it('al modelo y a la base les llega la pregunta sin datos personales', async () => {
    let recibida = '';
    const s = crear(
      new GatewayFalso(async (ctx) => {
        recibida = ctx.pregunta;
        return { respuesta: VALIDA, herramientas: [] };
      }),
      repo,
    );
    await preguntar(s, 'Soy juan@mail.com, DNI 30.123.456, ¿cómo pago?');
    assert.equal(recibida, 'Soy [EMAIL], DNI [DNI], ¿cómo pago?');
    assert.equal(repo.registradas[0].pregunta, recibida);
  });

  it('una pantalla que no es del rol no le llega al modelo', async () => {
    const pantallas: (string | undefined)[] = [];
    const s = crear(
      new GatewayFalso(async (ctx) => {
        pantallas.push(ctx.pantalla);
        return { respuesta: VALIDA, herramientas: [] };
      }),
      repo,
    );
    await s.preguntar(VECINO, { pregunta: 'hola', pantalla: '/admin/cobranzas' });
    await s.preguntar(VECINO, { pregunta: 'hola', pantalla: '/vecino/reservas' });
    assert.deepEqual(pantallas, [undefined, '/vecino/reservas']);
  });

  it('el superadministrador no usa el asistente', async () => {
    const s = crear(new GatewayFalso(async () => ({ respuesta: VALIDA, herramientas: [] })), repo);
    await assert.rejects(
      preguntar(s, 'hola', { id: 's', email: 's@x', rol: RolUsuario.SUPER_ADMIN }),
      (e: unknown) => e instanceof HttpException && e.getStatus() === HttpStatus.FORBIDDEN,
    );
  });

  it('el texto que va llegando pasa al que lo pidió; la respuesta final sigue validada', async () => {
    const pedazos: string[] = [];
    const s = crear(
      new GatewayFalso(async (ctx) => {
        ctx.onTexto?.('Andá a ');
        ctx.onTexto?.('**Expensas**.');
        return { respuesta: VALIDA, herramientas: [] };
      }),
      repo,
    );
    const r = await s.preguntar(VECINO, { pregunta: '¿Cómo pago?' }, (t) => pedazos.push(t));
    assert.deepEqual(pedazos, ['Andá a ', '**Expensas**.']);
    assert.equal(r.origen, 'llm');
  });

  it('datos_consultados son las herramientas que corrieron, no lo que diga el modelo', async () => {
    const s = crear(
      new GatewayFalso(async () => ({ respuesta: VALIDA, herramientas: ['consultar_saldo', 'consultar_saldo'] })),
      repo,
    );
    const r = await preguntar(s);
    assert.deepEqual(r.datos_consultados, ['consultar_saldo']);
  });
});
