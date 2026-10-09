import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { PreferenciaNotificacion, RolUsuario, Usuario } from '../../database/entities';

/** Tiene un vínculo vigente con alguna unidad de esos consorcios. */
const VIVE_EN = `EXISTS (
  SELECT 1 FROM unidad_usuario uu
    JOIN unidad un ON un.id = uu.unidad_id
   WHERE uu.usuario_id = us.id
     AND (uu.hasta IS NULL OR uu.hasta >= CURRENT_DATE)
     AND un.consorcio_id IN (:...consorcioIds))`;

@Injectable()
export class UsuariosRepository {
  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,
    @InjectRepository(PreferenciaNotificacion)
    private readonly preferencias: Repository<PreferenciaNotificacion>,
  ) {}

  preferenciasDe(usuarioId: string): Promise<PreferenciaNotificacion[]> {
    return this.preferencias.findBy({ usuarioId });
  }

  /** Inserta o actualiza contra uq_preferencia (usuario, canal, categoría). */
  async guardarPreferencias(
    usuarioId: string,
    cambios: Pick<PreferenciaNotificacion, 'canal' | 'categoria' | 'habilitado'>[],
  ): Promise<void> {
    if (cambios.length === 0) return;
    await this.preferencias.upsert(
      cambios.map((c) => ({ ...c, usuarioId })),
      ['usuarioId', 'canal', 'categoria'],
    );
  }

  findAll(rol?: RolUsuario, buscar?: string): Promise<Usuario[]> {
    const qb = this.ordenado();
    if (rol) qb.andWhere('us.rol = :rol', { rol });
    return this.buscando(qb, buscar).getMany();
  }

  /** Vecinos que hoy viven en alguno de esos consorcios. */
  listarVecinos(consorcioIds: string[], buscar?: string): Promise<Usuario[]> {
    if (consorcioIds.length === 0) return Promise.resolve([]);
    const qb = this.ordenado()
      .andWhere('us.rol = :rol', { rol: RolUsuario.VECINO })
      .andWhere(VIVE_EN, { consorcioIds });
    return this.buscando(qb, buscar).getMany();
  }

  async viveEn(usuarioId: string, consorcioIds: string[]): Promise<boolean> {
    if (consorcioIds.length === 0) return false;
    return this.repo
      .createQueryBuilder('us')
      .where('us.id = :usuarioId', { usuarioId })
      .andWhere(VIVE_EN, { consorcioIds })
      .getExists();
  }

  findById(id: string): Promise<Usuario | null> {
    return this.repo.findOneBy({ id });
  }

  /** Con el hash, que no viene por defecto: sólo para validar la contraseña actual. */
  findConPassword(id: string): Promise<Usuario | null> {
    return this.repo
      .createQueryBuilder('us')
      .addSelect('us.passwordHash')
      .where('us.id = :id', { id })
      .getOne();
  }

  findByEmail(email: string): Promise<Usuario | null> {
    return this.repo.findOneBy({ email: email.trim().toLowerCase() });
  }

  create(data: Partial<Usuario>): Promise<Usuario> {
    return this.repo.save(this.repo.create(data));
  }

  async update(usuario: Usuario, data: Partial<Usuario>): Promise<Usuario> {
    return this.repo.save({ ...usuario, ...data });
  }

  private ordenado(): SelectQueryBuilder<Usuario> {
    return this.repo
      .createQueryBuilder('us')
      .orderBy('us.apellido', 'ASC')
      .addOrderBy('us.nombre', 'ASC');
  }

  private buscando(qb: SelectQueryBuilder<Usuario>, buscar?: string) {
    if (!buscar) return qb;
    return qb.andWhere(
      new Brackets((sub) =>
        sub
          .where(`(us.nombre || ' ' || us.apellido) ILIKE :q`)
          .orWhere('us.email ILIKE :q'),
      ),
      { q: `%${buscar}%` },
    );
  }
}
