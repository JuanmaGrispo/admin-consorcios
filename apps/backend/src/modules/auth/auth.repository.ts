import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../database/entities';

/**
 * Acceso a datos de autenticación. La tabla `usuario` la toca esta clase; el
 * service no habla con TypeORM directo.
 */
@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  /**
   * Busca por email para el login. Trae `passwordHash` a propósito — es el
   * único lugar del sistema que lo necesita, y por eso está acá y no en un
   * repositorio de uso general.
   *
   * El email se normaliza a minúsculas: la columna es UNIQUE pero Postgres
   * compara con case sensitivity, así que `Juan@x.com` y `juan@x.com` serían
   * dos filas distintas. Guardar y buscar siempre en minúscula lo evita.
   */
  findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarios.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  findById(id: string): Promise<Usuario | null> {
    return this.usuarios.findOneBy({ id });
  }
}
