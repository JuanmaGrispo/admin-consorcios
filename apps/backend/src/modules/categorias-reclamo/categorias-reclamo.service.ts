import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriaReclamo, RolUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { CategoriasReclamoRepository } from './categorias-reclamo.repository';
import { CreateCategoriaReclamoDto } from './dto/create-categoria-reclamo.dto';
import { UpdateCategoriaReclamoDto } from './dto/update-categoria-reclamo.dto';

@Injectable()
export class CategoriasReclamoService {
  constructor(
    private readonly categorias: CategoriasReclamoRepository,
    private readonly consorcios: ConsorciosService,
  ) {}

  listar(consorcioId?: string): Promise<CategoriaReclamo[]> {
    return this.categorias.listar(consorcioId);
  }

  async findOne(id: string): Promise<CategoriaReclamo> {
    const categoria = await this.categorias.findById(id);
    if (!categoria) throw new NotFoundException(`La categoría ${id} no existe`);
    return categoria;
  }

  async create(
    usuario: UsuarioActual,
    dto: CreateCategoriaReclamoDto,
  ): Promise<CategoriaReclamo> {
    const consorcioId = dto.consorcioId ?? null;
    if (consorcioId) {
      // 404 si el consorcio no existe.
      await this.consorcios.findOne(consorcioId);
    } else {
      this.exigirSuperAdmin(usuario);
    }
    await this.exigirNombreLibre(dto.nombre, consorcioId);

    const creada = await this.categorias.create(dto);
    return this.findOne(creada.id);
  }

  async update(
    usuario: UsuarioActual,
    id: string,
    dto: UpdateCategoriaReclamoDto,
  ): Promise<CategoriaReclamo> {
    const categoria = await this.findOne(id);
    if (categoria.consorcioId === null) this.exigirSuperAdmin(usuario);

    if (dto.nombre !== undefined && dto.nombre.toLowerCase() !== categoria.nombre.toLowerCase()) {
      await this.exigirNombreLibre(dto.nombre, categoria.consorcioId);
    }
    return this.categorias.update(categoria, dto);
  }

  /**
   * Sólo se borra si ningún reclamo la usa (la FK es RESTRICT). Una categoría
   * con reclamos se queda: sacarla dejaría esos reclamos sin clasificar.
   */
  async remove(usuario: UsuarioActual, id: string): Promise<void> {
    const categoria = await this.findOne(id);
    if (categoria.consorcioId === null) this.exigirSuperAdmin(usuario);

    const enUso = await this.categorias.contarReclamos(id);
    if (enUso > 0) {
      throw new ConflictException(
        `La categoría ${categoria.nombre} tiene ${enUso} reclamo(s) y no se puede borrar`,
      );
    }
    await this.categorias.remove(id);
  }

  /**
   * Para reclamos: la categoría tiene que existir y ser del consorcio del
   * reclamo o compartida. La FK sólo garantiza que exista.
   */
  async exigirUsable(categoriaId: string, consorcioId: string): Promise<CategoriaReclamo> {
    const categoria = await this.categorias.findById(categoriaId);
    if (!categoria) {
      throw new BadRequestException(`La categoría ${categoriaId} no existe`);
    }
    if (categoria.consorcioId !== null && categoria.consorcioId !== consorcioId) {
      throw new BadRequestException(
        `La categoría ${categoria.nombre} no corresponde a este consorcio`,
      );
    }
    return categoria;
  }

  /** Dos "Plomería" en el mismo selector confunden al vecino y parten las estadísticas. */
  private async exigirNombreLibre(nombre: string, consorcioId: string | null): Promise<void> {
    if (await this.categorias.findPorNombre(nombre, consorcioId)) {
      throw new ConflictException(`Ya existe una categoría ${nombre}`);
    }
  }

  /** Las compartidas aparecen en todos los consorcios: son del superadmin. */
  private exigirSuperAdmin(usuario: UsuarioActual): void {
    if (usuario.rol !== RolUsuario.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Las categorías compartidas entre consorcios sólo las gestiona el superadmin. Indicá el consorcioId.',
      );
    }
  }
}
