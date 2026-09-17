// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Refleja la tabla `votacion` de la base.

import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CriterioDesempate, EstadoVotacion, FormaConteo, MayoriaRequerida, PadronVotacion, ResultadoVotacion } from './enums';
import { Asamblea } from './asamblea.entity';
import { Consorcio } from './consorcio.entity';
import { Gasto } from './gasto.entity';
import { OpcionVoto } from './opcion_voto.entity';
import { PuntoOrdenDia } from './punto_orden_dia.entity';
import { Voto } from './voto.entity';

@Index('votacion_punto_orden_dia_id_key', ['puntoOrdenDiaId'], { unique: true })
@Entity('votacion')
export class Votacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'consorcio_id' })
  consorcioId: string;

  @ManyToOne(() => Consorcio, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'consorcio_id' })
  consorcio: Consorcio;

  @Column({ type: 'uuid', name: 'asamblea_id', nullable: true })
  asambleaId: string | null;

  @ManyToOne(() => Asamblea, undefined, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asamblea_id' })
  asamblea?: Asamblea | null;

  @Column({ type: 'uuid', name: 'punto_orden_dia_id', nullable: true })
  puntoOrdenDiaId: string | null;

  @ManyToOne(() => PuntoOrdenDia, undefined, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'punto_orden_dia_id' })
  puntoOrdenDia?: PuntoOrdenDia | null;

  @Column({ type: 'varchar', name: 'titulo', length: 150 })
  titulo: string;

  @Column({ type: 'text', name: 'descripcion', nullable: true })
  descripcion: string | null;

  @Column({ type: 'text', name: 'adjunto_url', nullable: true })
  adjuntoUrl: string | null;

  @Column({ type: 'enum', enum: PadronVotacion, enumName: 'padron_votacion', name: 'padron', default: 'SOLO_PROPIETARIOS' })
  padron: PadronVotacion;

  @Column({ type: 'enum', enum: FormaConteo, enumName: 'forma_conteo', name: 'forma_conteo', default: 'POR_COEFICIENTE' })
  formaConteo: FormaConteo;

  @Column({ type: 'enum', enum: MayoriaRequerida, enumName: 'mayoria_requerida', name: 'mayoria', default: 'SIMPLE_PRESENTES' })
  mayoria: MayoriaRequerida;

  @Column({ type: 'enum', enum: CriterioDesempate, enumName: 'criterio_desempate', name: 'desempate', default: 'RECHAZADA' })
  desempate: CriterioDesempate;

  @Column({ type: 'boolean', name: 'permite_voto_anticipado', default: false })
  permiteVotoAnticipado: boolean;

  @Column({ type: 'boolean', name: 'mostrar_parcial', default: false })
  mostrarParcial: boolean;

  @Column({ type: 'boolean', name: 'bloquea_con_deuda', default: false })
  bloqueaConDeuda: boolean;

  @Column({ type: 'timestamptz', name: 'apertura' })
  apertura: Date;

  @Column({ type: 'timestamptz', name: 'cierre' })
  cierre: Date;

  @Column({ type: 'enum', enum: EstadoVotacion, enumName: 'estado_votacion', name: 'estado', default: 'BORRADOR' })
  estado: EstadoVotacion;

  @Column({ type: 'enum', enum: ResultadoVotacion, enumName: 'resultado_votacion', name: 'resultado', nullable: true })
  resultado: ResultadoVotacion | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => Gasto, (row) => row.votacion)
  gastos?: Gasto[];

  @OneToMany(() => OpcionVoto, (row) => row.votacion)
  opcionVotos?: OpcionVoto[];

  @OneToMany(() => Voto, (row) => row.votacion)
  votos?: Voto[];
}
