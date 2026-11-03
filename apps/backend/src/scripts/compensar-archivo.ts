import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import dataSource from '../database/data-source';
import { CompensacionArchivosRepository } from '../modules/archivos/compensacion-archivos.repository';
import { CompensacionArchivosService } from '../modules/archivos/compensacion-archivos.service';
import { ArchivosClient } from '../modules/archivos/archivos.client';

async function main() {
  const [url] = process.argv.slice(2);
  if (!url || !/^https?:\/\//.test(url)) throw new Error('Uso: archivos:compensar <url> [--aplicar --mantenimiento]');
  try {
    await dataSource.initialize();
    const service = new CompensacionArchivosService(new CompensacionArchivosRepository(dataSource), new ArchivosClient(new ConfigService(process.env)));
    console.log(JSON.stringify(await service.ejecutar(url, process.argv.includes('--aplicar'), process.argv.includes('--mantenimiento'))));
  } finally { if (dataSource.isInitialized) await dataSource.destroy(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
