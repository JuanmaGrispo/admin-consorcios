// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `solicitud_idempotente` de la base.

import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('solicitud_idempotente')
export class SolicitudIdempotente {
  @PrimaryColumn({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @PrimaryColumn({ type: 'text', name: 'metodo' })
  metodo: string;

  @PrimaryColumn({ type: 'text', name: 'ruta' })
  ruta: string;

  @PrimaryColumn({ type: 'varchar', name: 'clave' })
  clave: string;

  @Column({ type: 'text', name: 'huella' })
  huella: string;

  @Column({ type: 'int', name: 'estado_http' })
  estadoHttp: number;

  @Column({ type: 'jsonb', name: 'respuesta' })
  respuesta: object;

  @Column({ type: 'jsonb', name: 'cabeceras', default: '{}' })
  cabeceras: object;

  @Column({ type: 'timestamptz', name: 'creado_at', default: () => 'now()' })
  creadoAt: Date;
}
