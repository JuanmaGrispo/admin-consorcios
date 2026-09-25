import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolUsuario, RubroGasto } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { CreateRubroGastoDto } from './dto/create-rubro-gasto.dto';
import { UpdateRubroGastoDto } from './dto/update-rubro-gasto.dto';
import { RubrosGastoRepository } from './rubros-gasto.repository';

/** Los rubros agrupan los gastos de una liquidación (sueldos, luz, mantenimiento). */
@Injectable()
export class RubrosGastoService {
  constructor(
    private readonly rubros: RubrosGastoRepository,
    private readonly consorcios: ConsorciosService,
  ) {}

  listar(consorcioId?: string): Promise<RubroGasto[]> {
    return this.rubros.listar(consorcioId);
  }

  async findOne(id: string): Promise<RubroGasto> {
    const rubro = await this.rubros.findById(id);
    if (!rubro) throw new NotFoundException(`El rubro ${id} no existe`);
    return rubro;
  }

  async create(usuario: UsuarioActual, dto: CreateRubroGastoDto): Promise<RubroGasto> {
    const consorcioId = dto.consorcioId ?? null;
    if (consorcioId) {
      // 404 si el consorcio no existe.
      await this.consorcios.findOne(consorcioId);
    } else {
      this.exigirSuperAdmin(usuario);
    }
    await this.exigirNombreLibre(dto.nombre, consorcioId);

    const creado = await this.rubros.create(dto);
    return this.findOne(creado.id);
  }

  /**
   * Cambiar la naturaleza no toca los gastos ya cargados: cada gasto guarda la
   * suya, y una liquidación emitida no se puede recalcular por un cambio acá.
   */
  async update(
    usuario: UsuarioActual,
    id: string,
    dto: UpdateRubroGastoDto,
  ): Promise<RubroGasto> {
    const rubro = await this.findOne(id);
    if (rubro.consorcioId === null) this.exigirSuperAdmin(usuario);

    if (dto.nombre !== undefined && dto.nombre.toLowerCase() !== rubro.nombre.toLowerCase()) {
      await this.exigirNombreLibre(dto.nombre, rubro.consorcioId);
    }
    return this.rubros.update(rubro, dto);
  }

  /** Sólo sin gastos: la FK es RESTRICT y los gastos no pueden quedar sin rubro. */
  async remove(usuario: UsuarioActual, id: string): Promise<void> {
    const rubro = await this.findOne(id);
    if (rubro.consorcioId === null) this.exigirSuperAdmin(usuario);

    const enUso = await this.rubros.contarGastos(id);
    if (enUso > 0) {
      throw new ConflictException(
        `El rubro ${rubro.nombre} tiene ${enUso} gasto(s) y no se puede borrar`,
      );
    }
    await this.rubros.remove(id);
  }

  /** Para expensas: el rubro tiene que existir y ser del consorcio o compartido. */
  async exigirUsable(rubroId: string, consorcioId: string): Promise<RubroGasto> {
    const rubro = await this.rubros.findById(rubroId);
    if (!rubro) throw new BadRequestException(`El rubro ${rubroId} no existe`);
    if (rubro.consorcioId !== null && rubro.consorcioId !== consorcioId) {
      throw new BadRequestException(`El rubro ${rubro.nombre} no corresponde a este consorcio`);
    }
    return rubro;
  }

  private async exigirNombreLibre(nombre: string, consorcioId: string | null): Promise<void> {
    if (await this.rubros.findPorNombre(nombre, consorcioId)) {
      throw new ConflictException(`Ya existe un rubro ${nombre}`);
    }
  }

  /** Los compartidos aparecen en todos los consorcios: son del superadmin. */
  private exigirSuperAdmin(usuario: UsuarioActual): void {
    if (usuario.rol !== RolUsuario.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Los rubros compartidos entre consorcios sólo los gestiona el superadmin. Indicá el consorcioId.',
      );
    }
  }
}
