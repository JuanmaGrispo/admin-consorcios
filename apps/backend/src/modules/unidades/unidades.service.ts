import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolUsuario, Unidad, UnidadUsuario } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateUnidadDto } from './dto/create-unidad.dto';
import { ListarUnidadesQuery } from './dto/listar-unidades.query';
import { UpdateUnidadDto } from './dto/update-unidad.dto';
import { VincularUsuarioDto } from './dto/vincular-usuario.dto';
import { UnidadesRepository } from './unidades.repository';

/** El vínculo como sale por la API: el usuario recortado, nunca con su hash. */
export type VinculoPublico = Omit<UnidadUsuario, 'usuario' | 'unidad'> & {
  usuario: { id: string; nombre: string; apellido: string; email: string };
};

const esVecino = (usuario: UsuarioActual) => usuario.rol === RolUsuario.VECINO;

/**
 * Los coeficientes se guardan con 4 decimales. Comparar en diezmilésimos
 * enteros evita que 33.3333 + 33.3333 + 33.3334 dé 100.00000000000001.
 */
const enDiezmilesimos = (n: number) => Math.round(n * 10_000);

@Injectable()
export class UnidadesService {
  constructor(
    private readonly unidades: UnidadesRepository,
    private readonly consorcios: ConsorciosService,
    private readonly usuarios: UsuariosService,
  ) {}

  // ── Unidades ───────────────────────────────────────────────────────────────

  /** El administrador ve todas; el vecino, sólo aquellas a las que está vinculado. */
  async listar(usuario: UsuarioActual, query: ListarUnidadesQuery): Promise<Unidad[]> {
    return this.unidades.listar({
      consorcioId: query.consorcioId,
      ids: esVecino(usuario)
        ? await this.unidades.unidadesDelUsuario(usuario.id)
        : undefined,
      incluirInactivas: query.incluirInactivas ?? false,
    });
  }

  async findOne(usuario: UsuarioActual, id: string): Promise<Unidad> {
    const unidad = await this.unidades.findById(id);
    // Al vecino, una unidad ajena le da 404 y no 403: un 403 confirmaría que existe.
    if (
      !unidad ||
      (esVecino(usuario) &&
        !(await this.unidades.unidadesDelUsuario(usuario.id)).includes(id))
    ) {
      throw new NotFoundException(`La unidad ${id} no existe`);
    }
    return unidad;
  }

  async create(dto: CreateUnidadDto): Promise<Unidad> {
    // 404 si el consorcio no existe.
    await this.consorcios.findOne(dto.consorcioId);
    await this.exigirEtiquetaLibre(dto.consorcioId, dto.etiqueta);
    await this.exigirCoeficienteDisponible(dto.consorcioId, dto.coeficiente);

    const creada = await this.unidades.create(dto);
    return (await this.unidades.findById(creada.id))!;
  }

  async update(id: string, dto: UpdateUnidadDto): Promise<Unidad> {
    const unidad = await this.unidades.findById(id);
    if (!unidad) throw new NotFoundException(`La unidad ${id} no existe`);

    if (dto.etiqueta !== undefined && dto.etiqueta !== unidad.etiqueta) {
      await this.exigirEtiquetaLibre(unidad.consorcioId, dto.etiqueta, id);
    }

    // El tope de 100% se revisa si la unidad va a quedar activa y su aporte
    // cambia: porque cambió el coeficiente o porque se reactiva.
    const quedaActiva = dto.activa ?? unidad.activa;
    const coeficiente = dto.coeficiente ?? unidad.coeficiente;
    const cambiaAporte =
      coeficiente !== unidad.coeficiente || (quedaActiva && !unidad.activa);
    if (quedaActiva && cambiaAporte) {
      await this.exigirCoeficienteDisponible(unidad.consorcioId, coeficiente, id);
    }

    return this.unidades.update(unidad, dto);
  }

  // ── Vínculos vecino ↔ unidad ───────────────────────────────────────────────

  async listarVinculos(unidadId: string, incluirTerminados: boolean): Promise<VinculoPublico[]> {
    await this.exigirUnidad(unidadId);
    const vinculos = await this.unidades.listarVinculos(unidadId, incluirTerminados);
    return vinculos.map((v) => this.recortar(v));
  }

  async vincular(unidadId: string, dto: VincularUsuarioDto): Promise<VinculoPublico> {
    const unidad = await this.exigirUnidad(unidadId);
    if (!unidad.activa) {
      throw new BadRequestException(
        `La unidad ${unidad.etiqueta} está dada de baja: reactivala antes de vincular vecinos`,
      );
    }

    // Los vínculos son para vecinos. Un administrador opera el consorcio
    // entero; vincularlo a una unidad lo haría pasar por vecino en reclamos.
    const usuario = await this.usuarios.findOne(dto.usuarioId);
    if (!usuario || !usuario.activo || usuario.rol !== RolUsuario.VECINO) {
      throw new BadRequestException(
        'Sólo se puede vincular a un usuario activo con rol VECINO',
      );
    }

    if (await this.unidades.findVinculoVigente(unidadId, dto.usuarioId)) {
      throw new ConflictException(
        `${usuario.nombre} ${usuario.apellido} ya está vinculado a la unidad ${unidad.etiqueta}`,
      );
    }

    // Titular es el responsable de la unidad ante el consorcio: si hubiera
    // dos, no quedaría claro a quién se le emite la boleta.
    if (dto.esTitular && (await this.unidades.findTitularVigente(unidadId))) {
      throw new ConflictException(
        `La unidad ${unidad.etiqueta} ya tiene un titular. Terminá ese vínculo antes de asignar otro.`,
      );
    }

    const vinculo = await this.unidades.crearVinculo({
      unidadId,
      usuarioId: dto.usuarioId,
      vinculo: dto.vinculo,
      esTitular: dto.esTitular ?? false,
      // Sin `desde`, lo completa la base con CURRENT_DATE.
      ...(dto.desde ? { desde: dto.desde } : {}),
    });
    return this.recortar(vinculo);
  }

  /**
   * Termina el vínculo hoy: el inquilino que se muda deja de ver la unidad,
   * pero el registro queda para la historia (quién vivía cuando se abrió un
   * reclamo, quién votó en una asamblea).
   *
   * Si el vínculo todavía no había empezado a regir (se cargó hoy o con fecha
   * futura) no hay historia que cuidar: se borra. Además la base exige
   * `hasta > desde`, así que no podría cerrarse con fecha de hoy.
   */
  async desvincular(unidadId: string, vinculoId: string): Promise<void> {
    const vinculo = await this.unidades.findVinculo(vinculoId);
    if (!vinculo || vinculo.unidadId !== unidadId) {
      throw new NotFoundException(`El vínculo ${vinculoId} no existe en esta unidad`);
    }
    if (vinculo.hasta) {
      throw new BadRequestException(`Ese vínculo ya terminó el ${vinculo.hasta}`);
    }

    const hoy = await this.unidades.hoy();
    // Fechas ISO (YYYY-MM-DD): comparar como texto es comparar como fecha.
    if (vinculo.desde >= hoy) {
      await this.unidades.borrarVinculo(vinculoId);
    } else {
      await this.unidades.terminarVinculo(vinculoId, hoy);
    }
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  private async exigirUnidad(id: string): Promise<Unidad> {
    const unidad = await this.unidades.findById(id);
    if (!unidad) throw new NotFoundException(`La unidad ${id} no existe`);
    return unidad;
  }

  /** La base tiene UNIQUE (consorcio_id, etiqueta); acá se da un mensaje claro. */
  private async exigirEtiquetaLibre(
    consorcioId: string,
    etiqueta: string,
    excluirId?: string,
  ): Promise<void> {
    const existente = await this.unidades.findByEtiqueta(consorcioId, etiqueta);
    if (existente && existente.id !== excluirId) {
      throw new ConflictException(`Ya existe la unidad ${etiqueta} en este consorcio`);
    }
  }

  /**
   * Los coeficientes de las unidades activas de un consorcio reparten el 100%
   * de las expensas: pasarse haría que la liquidación cobre más de lo gastado.
   * Quedarse corto sí se permite, porque las unidades se cargan de a una.
   */
  private async exigirCoeficienteDisponible(
    consorcioId: string,
    coeficiente: number,
    excluirId?: string,
  ): Promise<void> {
    const asignado = await this.unidades.sumaCoeficientes(consorcioId, excluirId);
    if (enDiezmilesimos(asignado) + enDiezmilesimos(coeficiente) > enDiezmilesimos(100)) {
      const disponible = (enDiezmilesimos(100) - enDiezmilesimos(asignado)) / 10_000;
      throw new BadRequestException(
        `Los coeficientes del consorcio pasarían el 100%: ya hay ${asignado}% asignado y quedan ${disponible}% disponibles`,
      );
    }
  }

  private recortar(vinculo: UnidadUsuario): VinculoPublico {
    const { usuario, unidad: _unidad, ...resto } = vinculo;
    return {
      ...resto,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
      },
    };
  }
}
