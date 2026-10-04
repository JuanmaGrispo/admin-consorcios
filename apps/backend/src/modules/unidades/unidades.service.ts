import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolUsuario, Unidad, UnidadUsuario } from '../../database/entities';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
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

  /** El administrador ve las de sus consorcios; el vecino, sólo aquellas a las que está vinculado. */
  async listar(usuario: UsuarioActual, query: ListarUnidadesQuery): Promise<Unidad[]> {
    const gestor = esGestor(usuario);
    return this.unidades.listar({
      consorcioId: query.consorcioId,
      consorcioIds: gestor ? consorciosGestionados(usuario) : undefined,
      ids: gestor ? undefined : await this.unidades.unidadesDelUsuario(usuario.id),
      incluirInactivas: query.incluirInactivas ?? false,
    });
  }

  async findOne(usuario: UsuarioActual, id: string): Promise<Unidad> {
    if (esGestor(usuario)) return this.exigirUnidad(usuario, id);
    const unidad = await this.unidades.findById(id);
    // Una unidad ajena da 404 y no 403: un 403 confirmaría que existe.
    if (!unidad || !(await this.unidades.unidadesDelUsuario(usuario.id)).includes(id)) {
      throw new NotFoundException(`La unidad ${id} no existe`);
    }
    return unidad;
  }

  async create(usuario: UsuarioActual, dto: CreateUnidadDto): Promise<Unidad> {
    if (!gestiona(usuario, dto.consorcioId)) {
      throw new NotFoundException(`Consorcio ${dto.consorcioId} no existe`);
    }
    await this.consorcios.findOne(dto.consorcioId);
    await this.exigirEtiquetaLibre(dto.consorcioId, dto.etiqueta);
    await this.exigirCoeficienteDisponible(dto.consorcioId, dto.coeficiente);

    const creada = await this.unidades.create(dto);
    return (await this.unidades.findById(creada.id))!;
  }

  async update(usuario: UsuarioActual, id: string, dto: UpdateUnidadDto): Promise<Unidad> {
    const unidad = await this.exigirUnidad(usuario, id);

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

  /**
   * Las unidades que un vecino habita hoy, con su consorcio y el tipo de
   * vínculo. Para uso interno de otros services: la pantalla de inicio tiene
   * que saber en qué edificio está parado antes de mostrarle nada.
   */
  unidadesDelVecino(usuarioId: string): Promise<UnidadUsuario[]> {
    return this.unidades.vinculosDelUsuario(usuarioId);
  }

  async listarVinculos(
    usuario: UsuarioActual,
    unidadId: string,
    incluirTerminados: boolean,
  ): Promise<VinculoPublico[]> {
    await this.exigirUnidad(usuario, unidadId);
    const vinculos = await this.unidades.listarVinculos(unidadId, incluirTerminados);
    return vinculos.map((v) => this.recortar(v));
  }

  async vincular(
    usuario: UsuarioActual,
    unidadId: string,
    dto: VincularUsuarioDto,
  ): Promise<VinculoPublico> {
    if (!dto.usuarioId === !dto.nuevoUsuario) {
      throw new BadRequestException(
        'Indicá usuarioId para un vecino que ya tiene cuenta o nuevoUsuario para darlo de alta, uno de los dos',
      );
    }

    const unidad = await this.exigirUnidad(usuario, unidadId);
    if (!unidad.activa) {
      throw new BadRequestException(
        `La unidad ${unidad.etiqueta} está dada de baja: reactivala antes de vincular vecinos`,
      );
    }

    const datosVinculo = {
      unidadId,
      vinculo: dto.vinculo,
      esTitular: dto.esTitular ?? false,
      // Sin `desde`, lo completa la base con CURRENT_DATE.
      ...(dto.desde ? { desde: dto.desde } : {}),
    };

    if (dto.nuevoUsuario) {
      await this.exigirTitularLibre(unidad, dto.esTitular);
      const vecino = await this.usuarios.prepararVecino(dto.nuevoUsuario);
      return this.recortar(await this.unidades.crearVecinoYVinculo(vecino, datosVinculo));
    }

    // Los vínculos son para vecinos. Un administrador opera el consorcio
    // entero; vincularlo a una unidad lo haría pasar por vecino en reclamos.
    const usuarioId = dto.usuarioId!;
    const vecino = await this.usuarios.findOne(usuarioId);
    if (!vecino || !vecino.activo || vecino.rol !== RolUsuario.VECINO) {
      throw new BadRequestException(
        'Sólo se puede vincular a un usuario activo con rol VECINO',
      );
    }

    if (await this.unidades.findVinculoVigente(unidadId, usuarioId)) {
      throw new ConflictException(
        `${vecino.nombre} ${vecino.apellido} ya está vinculado a la unidad ${unidad.etiqueta}`,
      );
    }

    await this.exigirTitularLibre(unidad, dto.esTitular);

    const vinculo = await this.unidades.crearVinculo({ ...datosVinculo, usuarioId });
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
  async desvincular(usuario: UsuarioActual, unidadId: string, vinculoId: string): Promise<void> {
    await this.exigirUnidad(usuario, unidadId);
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

  /** Una unidad de otro consorcio responde como inexistente. */
  private async exigirUnidad(usuario: UsuarioActual, id: string): Promise<Unidad> {
    const unidad = await this.unidades.findById(id);
    if (!unidad || !gestiona(usuario, unidad.consorcioId)) {
      throw new NotFoundException(`La unidad ${id} no existe`);
    }
    return unidad;
  }

  /**
   * Titular es el responsable de la unidad ante el consorcio: si hubiera dos,
   * no quedaría claro a quién se le emite la boleta.
   */
  private async exigirTitularLibre(unidad: Unidad, esTitular?: boolean): Promise<void> {
    if (esTitular && (await this.unidades.findTitularVigente(unidad.id))) {
      throw new ConflictException(
        `La unidad ${unidad.etiqueta} ya tiene un titular. Terminá ese vínculo antes de asignar otro.`,
      );
    }
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
