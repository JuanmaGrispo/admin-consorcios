import { ArchivosClient } from './archivos.client';
import { CompensacionArchivosRepository } from './compensacion-archivos.repository';

/** Compensación operativa explícita; exige detener escrituras mientras se ejecuta. */
export class CompensacionArchivosService {
  constructor(private readonly repo: CompensacionArchivosRepository, private readonly storage: ArchivosClient) {}
  async ejecutar(url: string, aplicar = false, mantenimiento = false) {
    const ruta = this.storage.rutaDeUrl(url);
    if (!ruta) throw new Error('La URL no pertenece al storage configurado o su ruta no es válida');
    const referencias = await this.repo.referencias(url);
    if (referencias > 0) throw new Error('El archivo está referenciado: no se puede compensar');
    if (!aplicar) return { ruta, referencias, aplicado: false };
    if (!mantenimiento || await this.repo.backendsActivos() > 0) throw new Error('Requiere mantenimiento explícito, sin instancias del backend ni otras escrituras concurrentes');
    // El operador mantiene bloqueadas nuevas instancias y otros escritores.
    // No se mantiene una transacción SQL abierta durante la llamada a Storage.
    if (await this.repo.referencias(url) > 0) throw new Error('El archivo adquirió una referencia');
    await this.storage.borrar(ruta); // DELETE repetido/404 es idempotente.
    return { ruta, referencias: 0, aplicado: true };
  }
}
