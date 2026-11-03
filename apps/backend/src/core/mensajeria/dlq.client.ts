import { connect, ChannelModel, ConfirmChannel, GetMessage } from 'amqplib';

/** Operación de mantenimiento explícita; nunca modifica permisos del broker. */
export class DlqClient {
  private conexion?: ChannelModel;
  private canal?: ConfirmChannel;
  private leidos: GetMessage[] = [];

  async abrir(url: string, cola: string): Promise<void> {
    if (!/^[a-zA-Z0-9_.-]{1,120}\.dlq$/.test(cola)) throw new Error('Se requiere una cola .dlq explícita');
    this.conexion = await connect(url);
    this.canal = await this.conexion.createConfirmChannel();
    await this.canal.checkQueue(cola);
  }
  async leer(cola: string, limite: number): Promise<GetMessage[]> {
    for (let i = 0; i < limite; i++) {
      const mensaje = await this.canal!.get(cola, { noAck: false });
      if (!mensaje) break;
      this.leidos.push(mensaje);
    }
    return this.leidos;
  }
  async republicar(cola: string, mensaje: GetMessage): Promise<void> {
    const principal = cola.slice(0, -4);
    await this.canal!.checkQueue(principal);
    this.canal!.sendToQueue(principal, mensaje.content, {
      persistent: true, contentType: 'application/json', messageId: mensaje.properties.messageId,
      headers: { ...mensaje.properties.headers, 'x-intentos': 0 },
    });
    await this.canal!.waitForConfirms();
    this.canal!.ack(mensaje);
    this.leidos = this.leidos.filter((m) => m !== mensaje);
  }
  async cerrar(): Promise<void> {
    // Todos los mensajes inspeccionados se devuelven sin ACK. El orden puede variar.
    for (const m of this.leidos) this.canal?.nack(m, false, true);
    this.leidos = [];
    await this.canal?.close().catch(() => undefined);
    await this.conexion?.close().catch(() => undefined);
  }
}
