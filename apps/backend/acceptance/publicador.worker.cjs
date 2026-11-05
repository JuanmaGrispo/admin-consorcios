require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { RabbitClient } = require('../src/core/mensajeria/rabbit.client');
const { DataSource } = require('typeorm');
const { OutboxRepository } = require('../src/core/mensajeria/outbox.repository');
(async () => {
const db = await new DataSource({ type: 'postgres', url: process.env.ACEPTACION_DATABASE_URL }).initialize();
const rabbit = new RabbitClient(new ConfigService({ RABBITMQ_URL: process.env.ACEPTACION_RABBITMQ_URL }), new OutboxRepository(db));
rabbit.onModuleInit();
await rabbit.publicar(process.env.ACEPTACION_ROUTING, Buffer.from(JSON.stringify({ evento_id: process.env.ACEPTACION_EVENTO_ID })), process.env.ACEPTACION_EVENTO_ID);
// La escritura durable se confirmó antes de avisar al padre.
process.send({ pendiente: true });
setInterval(() => undefined, 1000);
})().catch(() => process.exit(1));
