require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { EmailService } = require('../src/modules/email/email.service');
const { crearSobre } = require('../src/core/mensajeria/eventos');
const { EstadoEnvio } = require('../src/database/entities');

// Pruebas de componente con fallos deterministas: el contador representa al
// proveedor externo; no acredita entrega SMTP ni deduplicación en PostgreSQL.
function escenario({ romperConfirmacion = false, carrera = false } = {}) {
  const envios = [];
  let recibidos = 0;
  let lectores = 0;
  let liberar;
  const barrera = new Promise((r) => { liberar = r; });
  const repo = {
    reservarEnvio: async (datos) => {
      const previo = envios.find((e) => e.entidadId === datos.entidadId && e.destinatario === datos.destinatario);
      if (previo?.estado === EstadoEnvio.ENVIADO) return null;
      if (previo?.ultimoError === 'ENTREGA_INCIERTA') throw new Error('Entrega incierta');
      const envio = previo ?? { id: randomUUID(), ...datos };
      if (!previo) envios.push(envio);
      envio.ultimoError = 'ENTREGA_INCIERTA';
      return envio;
    },
    usuario: async () => ({ usuarioId: 'vecino', email: 'vecino@example.test', nombre: 'Vecino' }),
    sinMail: async () => new Set(),
    buscarEnvio: async (eventoId, email) => {
      const previo = envios.find((e) => e.entidadId === eventoId && e.destinatario === email) ?? null;
      if (carrera && ++lectores <= 2) {
        if (lectores === 2) liberar();
        await barrera;
      }
      return previo;
    },
    crearEnvio: async (datos) => { const envio = { id: randomUUID(), ...datos }; envios.push(envio); return envio; },
    actualizarEnvio: async (id, datos) => {
      if (romperConfirmacion && datos.estado === EstadoEnvio.ENVIADO) {
        romperConfirmacion = false;
        throw new Error('Fallo inducido después de aceptar el mail');
      }
      Object.assign(envios.find((e) => e.id === id), datos);
    },
  };
  const mailer = { configurado: true, enviar: async () => { recibidos++; } };
  const servicio = () => new EmailService(repo, mailer);
  const evento = crearSobre('aviso.directo', null, { destinatario_id: 'vecino', asunto: 'Prueba', cuerpo: 'Prueba de aceptación', origen: 'reclamo' });
  return { servicio, evento, recibidos: () => recibidos };
}

test('C3 email: duplicado secuencial no reenvía', async () => {
  const caso = escenario();
  await caso.servicio().procesar(caso.evento);
  await caso.servicio().procesar(caso.evento);
  assert.equal(caso.recibidos(), 1);
});

test('C3 email: entregas concurrentes no duplican el efecto externo', { timeout: 5000 }, async () => {
  const caso = escenario({ carrera: true });
  const resultados = await Promise.allSettled([caso.servicio().procesar(caso.evento), caso.servicio().procesar(caso.evento)]);
  assert.ok(resultados.some((r) => r.status === 'fulfilled'));
  assert.equal(caso.recibidos(), 1);
});

test('C3 email: fallo al registrar confirmación no vuelve a enviar', async () => {
  const caso = escenario({ romperConfirmacion: true });
  await assert.rejects(caso.servicio().procesar(caso.evento));
  await assert.rejects(caso.servicio().procesar(caso.evento), /incierta/i);
  assert.equal(caso.recibidos(), 1);
});
