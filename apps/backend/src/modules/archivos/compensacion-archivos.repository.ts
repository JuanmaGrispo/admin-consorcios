import { DataSource } from 'typeorm';

export class CompensacionArchivosRepository {
  constructor(private readonly db: DataSource) {}
  async referencias(url: string): Promise<number> {
    const [{ cantidad }] = await this.db.query(`SELECT (
      (SELECT count(*) FROM reclamo_adjunto WHERE url=$1) +
      (SELECT count(*) FROM novedad_adjunto WHERE url=$1) +
      (SELECT count(*) FROM gasto WHERE comprobante_url=$1) +
      (SELECT count(*) FROM votacion WHERE adjunto_url=$1) +
      (SELECT count(*) FROM asamblea WHERE acta_url=$1) +
      (SELECT count(*) FROM usuario WHERE avatar_url=$1))::int AS cantidad`, [url]);
    return cantidad;
  }
  async backendsActivos(): Promise<number> {
    const [{ cantidad }] = await this.db.query(`SELECT count(*)::int AS cantidad FROM pg_stat_activity
      WHERE datname=current_database() AND application_name='domus-backend'`);
    return cantidad;
  }
}
