import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RolUsuario, Usuario } from '../../database/entities';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UsuariosRepository } from './usuarios.repository';

/** Un usuario como sale por la API: todo menos el hash. */
export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

@Injectable()
export class UsuariosService {
  constructor(private readonly usuarios: UsuariosRepository) {}

  async findAll(rol?: RolUsuario): Promise<UsuarioPublico[]> {
    const filas = await this.usuarios.findAll(rol);
    return filas.map((u) => this.sinHash(u));
  }

  /** Para uso interno de otros services (p. ej. validar un administradorId). */
  findOne(id: string): Promise<Usuario | null> {
    return this.usuarios.findById(id);
  }

  async create(dto: CreateUsuarioDto): Promise<UsuarioPublico> {
    const email = dto.email.trim().toLowerCase();

    const existente = await this.usuarios.findByEmail(email);
    if (existente) {
      throw new ConflictException(`Ya existe un usuario con el email ${email}`);
    }

    const creado = await this.usuarios.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      rol: dto.rol ?? RolUsuario.ADMINISTRADOR,
    });

    return this.sinHash(creado);
  }

  private sinHash(usuario: Usuario): UsuarioPublico {
    const { passwordHash: _hash, ...publico } = usuario;
    return publico;
  }
}
