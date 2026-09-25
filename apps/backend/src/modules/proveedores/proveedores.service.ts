import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Proveedor, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { ListarProveedoresQuery } from './dto/listar-proveedores.query';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { ProveedoresRepository } from './proveedores.repository';

@Injectable()
export class ProveedoresService {
  constructor(
    private readonly proveedores: ProveedoresRepository,
    private readonly consorcios: ConsorciosService,
  ) {}

  listar(query: ListarProveedoresQuery): Promise<Proveedor[]> {
    return this.proveedores.listar(query);
  }

  async findOne(id: string): Promise<Proveedor> {
    const proveedor = await this.proveedores.findById(id);
    if (!proveedor) throw new NotFoundException(`El proveedor ${id} no existe`);
    return proveedor;
  }

  async create(usuario: UsuarioActual, dto: CreateProveedorDto): Promise<Proveedor> {
    if (dto.consorcioId) {
      // 404 si el consorcio no existe.
      await this.consorcios.findOne(dto.consorcioId);
    } else {
      this.exigirSuperAdmin(usuario);
    }
    const creado = await this.proveedores.create(dto);
    return this.findOne(creado.id);
  }

  async update(
    usuario: UsuarioActual,
    id: string,
    dto: UpdateProveedorDto,
  ): Promise<Proveedor> {
    const proveedor = await this.findOne(id);
    if (proveedor.consorcioId === null) this.exigirSuperAdmin(usuario);
    return this.proveedores.update(proveedor, dto);
  }

  /**
   * Para otros módulos (reclamos, y más adelante gastos): el proveedor tiene
   * que existir, estar activo y trabajar para ese consorcio o ser compartido.
   * La FK sólo garantiza lo primero.
   */
  async exigirAsignable(proveedorId: string, consorcioId: string): Promise<Proveedor> {
    const proveedor = await this.proveedores.findById(proveedorId);
    if (!proveedor) {
      throw new BadRequestException(`El proveedor ${proveedorId} no existe`);
    }
    if (!proveedor.activo) {
      throw new BadRequestException(`El proveedor ${proveedor.razonSocial} está dado de baja`);
    }
    if (proveedor.consorcioId !== null && proveedor.consorcioId !== consorcioId) {
      throw new BadRequestException(
        `El proveedor ${proveedor.razonSocial} no trabaja para este consorcio`,
      );
    }
    return proveedor;
  }

  /**
   * Un proveedor compartido aparece en todos los consorcios: crearlo o
   * editarlo le cambia la lista a administradores de otros edificios.
   */
  private exigirSuperAdmin(usuario: UsuarioActual): void {
    if (usuario.rol !== RolUsuario.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Los proveedores compartidos entre consorcios sólo los gestiona el superadmin. Indicá el consorcioId.',
      );
    }
  }
}
