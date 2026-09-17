import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolUsuario, Usuario } from '../../database/entities';

@Injectable()
export class UsuariosRepository {
  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,
  ) {}

  findAll(rol?: RolUsuario): Promise<Usuario[]> {
    return this.repo.find({
      where: rol ? { rol } : {},
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
  }

  findById(id: string): Promise<Usuario | null> {
    return this.repo.findOneBy({ id });
  }

  findByEmail(email: string): Promise<Usuario | null> {
    return this.repo.findOneBy({ email: email.trim().toLowerCase() });
  }

  create(data: Partial<Usuario>): Promise<Usuario> {
    return this.repo.save(this.repo.create(data));
  }
}
