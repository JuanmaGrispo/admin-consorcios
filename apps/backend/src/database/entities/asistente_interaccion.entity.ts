// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `asistente_interaccion` de la base.

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../transformers';
import { AsistenteFeedback } from './asistente_feedback.entity';
import { Usuario } from './usuario.entity';

@Entity('asistente_interaccion')
export class AsistenteInteraccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Usuario, undefined, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'uuid', name: 'conversacion_id' })
  conversacionId: string;

  @Column({ type: 'varchar', name: 'pregunta', length: 500 })
  pregunta: string;

  @Column({ type: 'jsonb', name: 'respuesta', nullable: true })
  respuesta: object | null;

  @Column({ type: 'varchar', name: 'origen', length: 10 })
  origen: string;

  @Column({ type: 'jsonb', name: 'herramientas', default: '[]' })
  herramientas: object;

  @Column({ type: 'varchar', name: 'modelo', length: 40, nullable: true })
  modelo: string | null;

  @Column({ type: 'int', name: 'tokens_entrada', default: 0 })
  tokensEntrada: number;

  @Column({ type: 'int', name: 'tokens_cache', default: 0 })
  tokensCache: number;

  @Column({ type: 'int', name: 'tokens_salida', default: 0 })
  tokensSalida: number;

  @Column({ type: 'numeric', name: 'costo_usd', precision: 10, scale: 6, transformer: numericTransformer, default: 0 })
  costoUsd: number;

  @Column({ type: 'int', name: 'latencia_ms', default: 0 })
  latenciaMs: number;

  @Column({ type: 'varchar', name: 'error', length: 200, nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', name: 'creado_at', default: () => 'now()' })
  creadoAt: Date;

  @OneToMany(() => AsistenteFeedback, (row) => row.interaccion)
  asistenteFeedbackes?: AsistenteFeedback[];
}
