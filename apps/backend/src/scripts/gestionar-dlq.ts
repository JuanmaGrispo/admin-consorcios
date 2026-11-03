import 'dotenv/config';
import { DlqClient } from '../core/mensajeria/dlq.client';
import { DlqService } from '../core/mensajeria/dlq.service';

async function main() {
  const [accion, cola, eventoId] = process.argv.slice(2);
  if (!['inspeccionar', 'reprocesar'].includes(accion) || !cola || (accion === 'reprocesar' && !eventoId)) {
    throw new Error('Uso: mensajeria:dlq inspeccionar <cola.dlq> | reprocesar <cola.dlq> <evento_id>');
  }
  if (!process.env.RABBITMQ_URL) throw new Error('Falta RABBITMQ_URL');
  const resultado = await new DlqService(new DlqClient()).ejecutar(process.env.RABBITMQ_URL, cola, accion === 'reprocesar' ? eventoId : undefined);
  console.log(JSON.stringify(resultado, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
