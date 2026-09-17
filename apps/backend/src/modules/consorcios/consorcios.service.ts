import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Consorcio, RolUsuario } from '../../database/entities';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ConsorciosRepository } from './consorcios.repository';
import { CreateConsorcioDto } from './dto/create-consorcio.dto';
import { UpdateConsorcioDto } from './dto/update-consorcio.dto';

/**
 * El consorcio que sale por la API: el administrador viaja recortado (nunca
 * el hash de su password) y con la cantidad de unidades ya contada.
 */
export type ConsorcioConAdministrador = Omit<Consorcio, 'administrador'> & {
  administrador: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
  cantidadUnidades?: number;
};

@Injectable()
export class ConsorciosService {
  constructor(
    private readonly consorcios: ConsorciosRepository,
    private readonly usuarios: UsuariosService,
  ) {}

  async findAll(): Promise<ConsorcioConAdministrador[]> {
    const filas = await this.consorcios.findAll();
    return filas.map((c) => this.recortar(c));
  }

  async findOne(id: string): Promise<ConsorcioConAdministrador> {
    const consorcio = await this.consorcios.findById(id);
    if (!consorcio) throw new NotFoundException(`Consorcio ${id} no existe`);
    return this.recortar(consorcio);
  }

  async create(dto: CreateConsorcioDto): Promise<ConsorcioConAdministrador> {
    await this.exigirAdministrador(dto.administradorId);
    const creado = await this.consorcios.create(dto);
    return this.findOne(creado.id);
  }

  async update(
    id: string,
    dto: UpdateConsorcioDto,
  ): Promise<ConsorcioConAdministrador> {
    if (dto.administradorId) await this.exigirAdministrador(dto.administradorId);
    const updated = await this.consorcios.update(id, dto);
    if (!updated) throw new NotFoundException(`Consorcio ${id} no existe`);
    return this.recortar(updated);
  }

  async remove(id: string): Promise<void> {
    const removed = await this.consorcios.remove(id);
    if (!removed) throw new NotFoundException(`Consorcio ${id} no existe`);
  }

  /**
   * El administrador asignado tiene que existir, estar activo y tener rol
   * ADMINISTRADOR: un consorcio administrado por un vecino no es un estado
   * válido del negocio, aunque la FK lo permita.
   */
  private async exigirAdministrador(usuarioId: string): Promise<void> {
    const usuario = await this.usuarios.findOne(usuarioId);
    if (!usuario || !usuario.activo || usuario.rol !== RolUsuario.ADMINISTRADOR) {
      throw new BadRequestException(
        'El administrador asignado tiene que ser un usuario activo con rol ADMINISTRADOR',
      );
    }
  }

  private recortar(consorcio: Consorcio): ConsorcioConAdministrador {
    const { administrador, ...resto } = consorcio;
    return {
      ...resto,
      administrador: administrador
        ? {
            id: administrador.id,
            nombre: administrador.nombre,
            apellido: administrador.apellido,
            email: administrador.email,
          }
        : null,
    };
  }
}
