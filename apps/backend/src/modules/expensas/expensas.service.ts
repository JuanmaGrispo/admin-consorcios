import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Notificador } from '../../core/notificaciones/notificador';
import {
  Boleta,
  CriterioProrrateo,
  EstadoLiquidacion,
  Gasto,
  Liquidacion,
  RolUsuario,
} from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { RubrosGastoService } from '../rubros-gasto/rubros-gasto.service';
import { AjustarBoletaDto } from './dto/ajustar-boleta.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';
import { ListarBoletasQuery } from './dto/listar-boletas.query';
import { ListarLiquidacionesQuery } from './dto/listar-liquidaciones.query';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { UpdateLiquidacionDto } from './dto/update-liquidacion.dto';
import { ExpensasRepository } from './expensas.repository';
import {
  aCentavos,
  aPesos,
  calcularBoletas,
  conceptoAjuste,
  type DeudaUnidad,
} from './prorrateo';

/**
 * Mientras la liquidación está en uno de estos estados, se puede tocar: cargar
 * gastos, cambiar el criterio, ajustar boletas. Una vez emitida, las boletas
 * son deuda de los vecinos y no se reescriben.
 */
const EDITABLES = [EstadoLiquidacion.BORRADOR, EstadoLiquidacion.PREVISUALIZACION];

const esVecino = (usuario: UsuarioActual) => usuario.rol === RolUsuario.VECINO;

const MS_POR_DIA = 86_400_000;
/** Días entre dos fechas ISO (YYYY-MM-DD). */
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_POR_DIA);

/**
 * Vencimiento por defecto: el día de vencimiento del consorcio en el mes
 * siguiente al período (los gastos de septiembre se pagan en octubre). Si el
 * mes es más corto, el último día: un 31 en febrero es el 28.
 */
export function vencimientoPorDefecto(periodo: string, diaVencimiento: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  // `mes` es 1-12 y Date.UTC los cuenta 0-11: `mes` ya apunta al siguiente.
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(diaVencimiento, ultimoDia)))
    .toISOString()
    .slice(0, 10);
}

@Injectable()
export class ExpensasService {
  private readonly logger = new Logger(ExpensasService.name);

  constructor(
    private readonly expensas: ExpensasRepository,
    private readonly consorcios: ConsorciosService,
    private readonly rubros: RubrosGastoService,
    private readonly proveedores: ProveedoresService,
    private readonly notificador: Notificador,
  ) {}

  // ── Liquidaciones ──────────────────────────────────────────────────────────

  listar(query: ListarLiquidacionesQuery): Promise<Liquidacion[]> {
    return this.expensas.listar(query);
  }

  async findOne(id: string): Promise<Liquidacion> {
    const liquidacion = await this.expensas.findConGastos(id);
    if (!liquidacion) throw new NotFoundException(`La liquidación ${id} no existe`);
    return liquidacion;
  }

  async create(usuario: UsuarioActual, dto: CreateLiquidacionDto): Promise<Liquidacion> {
    // 404 si el consorcio no existe.
    const consorcio = await this.consorcios.findOne(dto.consorcioId);
    const periodo = `${dto.periodo}-01`;

    if (await this.expensas.findByPeriodo(dto.consorcioId, periodo)) {
      throw new ConflictException(`Ya existe la liquidación de ${dto.periodo} para este consorcio`);
    }

    // La deuda se arrastra de la boleta anterior. Liquidar un período viejo
    // después de haber emitido uno más nuevo dejaría esa deuda afuera.
    const ultimoEmitido = await this.expensas.ultimoPeriodoEmitido(dto.consorcioId);
    if (ultimoEmitido && periodo <= ultimoEmitido) {
      throw new BadRequestException(
        `Ya se emitió ${ultimoEmitido.slice(0, 7)}: no se puede liquidar un período igual o anterior`,
      );
    }

    const fechaVencimiento =
      dto.fechaVencimiento ?? vencimientoPorDefecto(periodo, consorcio.diaVencimiento);
    this.exigirVencimientoValido(periodo, fechaVencimiento);

    const creada = await this.expensas.create({
      consorcioId: dto.consorcioId,
      periodo,
      fechaVencimiento,
      creadaPorId: usuario.id,
      ...(dto.criterioProrrateo ? { criterioProrrateo: dto.criterioProrrateo } : {}),
    });
    return this.findOne(creada.id);
  }

  async update(id: string, dto: UpdateLiquidacionDto): Promise<Liquidacion> {
    const liquidacion = await this.exigirEditable(id);
    if (dto.fechaVencimiento) this.exigirVencimientoValido(liquidacion.periodo, dto.fechaVencimiento);

    // Sin campos, TypeORM falla con UpdateValuesMissingError.
    if (Object.keys(dto).length > 0) await this.expensas.update(id, dto);
    await this.refrescarPrevisualizacion(id);
    return this.findOne(id);
  }

  /** Sólo antes de emitir. Gastos y boletas se borran con ella. */
  async remove(id: string): Promise<void> {
    await this.exigirEditable(id);
    await this.expensas.remove(id);
  }

  // ── Gastos ─────────────────────────────────────────────────────────────────

  async agregarGasto(liquidacionId: string, dto: CreateGastoDto): Promise<Gasto> {
    const liquidacion = await this.exigirEditable(liquidacionId);
    const rubro = await this.rubros.exigirUsable(dto.rubroId, liquidacion.consorcioId);
    if (dto.proveedorId) {
      await this.proveedores.exigirAsignable(dto.proveedorId, liquidacion.consorcioId);
    }
    this.exigirCuotasValidas(dto.cuotaNumero, dto.cuotaTotal);

    const gasto = await this.expensas.crearGasto({
      ...dto,
      liquidacionId,
      // La naturaleza sale del rubro salvo que se indique otra: un gasto de
      // "Mantenimiento" puede ser extraordinario si es una obra puntual.
      naturaleza: dto.naturaleza ?? rubro.naturaleza,
    });
    await this.despuesDeTocarGastos(liquidacionId);
    return gasto;
  }

  async actualizarGasto(
    liquidacionId: string,
    gastoId: string,
    dto: UpdateGastoDto,
  ): Promise<Gasto> {
    const liquidacion = await this.exigirEditable(liquidacionId);
    const gasto = await this.exigirGasto(liquidacionId, gastoId);

    if (dto.rubroId && dto.rubroId !== gasto.rubroId) {
      await this.rubros.exigirUsable(dto.rubroId, liquidacion.consorcioId);
    }
    if (dto.proveedorId && dto.proveedorId !== gasto.proveedorId) {
      await this.proveedores.exigirAsignable(dto.proveedorId, liquidacion.consorcioId);
    }
    this.exigirCuotasValidas(
      dto.cuotaNumero ?? gasto.cuotaNumero ?? undefined,
      dto.cuotaTotal ?? gasto.cuotaTotal ?? undefined,
    );

    const actualizado = await this.expensas.actualizarGasto(gasto, dto);
    await this.despuesDeTocarGastos(liquidacionId);
    return actualizado;
  }

  async borrarGasto(liquidacionId: string, gastoId: string): Promise<void> {
    await this.exigirEditable(liquidacionId);
    await this.exigirGasto(liquidacionId, gastoId);
    await this.expensas.borrarGasto(gastoId);
    await this.despuesDeTocarGastos(liquidacionId);
  }

  // ── Ciclo de la liquidación ────────────────────────────────────────────────

  /**
   * Calcula las boletas y deja la liquidación en PREVISUALIZACION. Se puede
   * repetir: cada vez se recalcula todo, conservando los ajustes manuales.
   */
  async previsualizar(id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirEditable(id);
    await this.recalcular(liquidacion);
    return this.findOne(id);
  }

  /**
   * Congela las boletas y avisa a los vecinos. Antes recalcula: entre la
   * previsualización y la emisión pudo entrar un pago o cambiar una unidad, y
   * lo que se emite tiene que reflejar el estado de hoy.
   */
  async emitir(id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirLiquidacion(id);
    if (liquidacion.estado !== EstadoLiquidacion.PREVISUALIZACION) {
      throw new BadRequestException(
        liquidacion.estado === EstadoLiquidacion.BORRADOR
          ? 'Previsualizá las boletas antes de emitir'
          : `La liquidación ya está ${liquidacion.estado}`,
      );
    }

    // Emitir fuera de orden rompe el arrastre de deuda: este período tomaría
    // como "anterior" una boleta que todavía no existe.
    if (await this.expensas.hayPendienteAnterior(liquidacion.consorcioId, liquidacion.periodo)) {
      throw new BadRequestException(
        'Hay un período anterior sin emitir en este consorcio: emitilo primero',
      );
    }

    const boletas = await this.recalcular(liquidacion);
    const totalEmitido = aPesos(boletas.reduce((suma, b) => suma + aCentavos(b.total), 0));

    await this.expensas.update(id, {
      estado: EstadoLiquidacion.EMITIDA,
      fechaEmision: new Date(),
      totalEmitido,
    });

    await this.avisarEmision(liquidacion, boletas);
    return this.findOne(id);
  }

  /** Da el período por terminado. Sus boletas siguen vigentes como deuda. */
  async cerrar(id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirLiquidacion(id);
    if (liquidacion.estado !== EstadoLiquidacion.EMITIDA) {
      throw new BadRequestException('Sólo se cierra una liquidación emitida');
    }
    await this.expensas.update(id, { estado: EstadoLiquidacion.CERRADA });
    return this.findOne(id);
  }

  // ── Boletas ────────────────────────────────────────────────────────────────

  /** El administrador ve todas; el vecino, las emitidas de sus unidades. */
  async listarBoletas(usuario: UsuarioActual, query: ListarBoletasQuery): Promise<Boleta[]> {
    if (!esVecino(usuario)) {
      return this.expensas.listarBoletas(query, { soloEmitidas: false });
    }
    return this.expensas.listarBoletas(query, {
      unidadIds: await this.expensas.unidadesDelUsuario(usuario.id),
      soloEmitidas: true,
    });
  }

  async findBoleta(usuario: UsuarioActual, id: string): Promise<Boleta> {
    const boleta = await this.expensas.findBoleta(id);
    const visible =
      boleta &&
      (!esVecino(usuario) ||
        ((boleta.liquidacion.estado === EstadoLiquidacion.EMITIDA ||
          boleta.liquidacion.estado === EstadoLiquidacion.CERRADA) &&
          (await this.expensas.unidadesDelUsuario(usuario.id)).includes(boleta.unidadId)));
    // Al vecino, una boleta ajena o sin emitir le da 404: un 403 confirmaría que existe.
    if (!visible) throw new NotFoundException(`La boleta ${id} no existe`);
    return boleta;
  }

  /**
   * Ajuste manual sobre una boleta en previsualización (una bonificación, un
   * cargo puntual). Se conserva si después se recalcula la liquidación.
   */
  async ajustarBoleta(id: string, dto: AjustarBoletaDto): Promise<Boleta> {
    const boleta = await this.expensas.findBoleta(id);
    if (!boleta) throw new NotFoundException(`La boleta ${id} no existe`);
    if (boleta.liquidacion.estado !== EstadoLiquidacion.PREVISUALIZACION) {
      throw new BadRequestException('Sólo se ajustan boletas de una liquidación en previsualización');
    }

    const motivo = dto.motivoAjuste || null;
    if (dto.ajusteManual !== 0 && !motivo) {
      throw new BadRequestException('Indicá el motivo del ajuste: el vecino lo ve en su boleta');
    }

    const total =
      aCentavos(boleta.total) - aCentavos(boleta.ajusteManual) + aCentavos(dto.ajusteManual);
    if (total < 0) {
      throw new BadRequestException('El ajuste dejaría la boleta con total negativo');
    }

    await this.expensas.aplicarAjuste(
      id,
      {
        ajusteManual: dto.ajusteManual,
        motivoAjuste: dto.ajusteManual === 0 ? null : motivo,
        total: aPesos(total),
      },
      dto.ajusteManual === 0
        ? null
        : { concepto: conceptoAjuste(motivo), monto: dto.ajusteManual },
    );
    return (await this.expensas.findBoleta(id))!;
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  /**
   * Arma el insumo del prorrateo desde la base, calcula y reemplaza las
   * boletas. Devuelve lo calculado para que emitir no tenga que releerlo.
   */
  private async recalcular(liquidacion: Liquidacion) {
    const gastos = await this.expensas.gastosDe(liquidacion.id);
    if (gastos.length === 0) {
      throw new BadRequestException('Cargá al menos un gasto antes de calcular las boletas');
    }

    const unidades = await this.expensas.unidadesActivas(liquidacion.consorcioId);
    if (unidades.length === 0) {
      throw new BadRequestException('El consorcio no tiene unidades activas entre quienes repartir');
    }

    // Por coeficiente, los coeficientes tienen que cerrar en 100%: si suman
    // menos, las boletas no cubren los gastos. El alta de unidades no deja
    // pasarse, pero sí quedarse corto mientras se cargan.
    if (liquidacion.criterioProrrateo === CriterioProrrateo.COEFICIENTE) {
      const suma = unidades.reduce((s, u) => s + Math.round(u.coeficiente * 10_000), 0);
      if (suma !== 100 * 10_000) {
        throw new BadRequestException(
          `Los coeficientes de las unidades activas suman ${suma / 10_000}% y tienen que sumar 100%`,
        );
      }
    }

    const consorcio = await this.consorcios.findOne(liquidacion.consorcioId);
    const hoy = await this.expensas.hoy();
    const deudas = new Map<string, DeudaUnidad>(
      (
        await this.expensas.deudasAnteriores(
          liquidacion.consorcioId,
          liquidacion.periodo,
          unidades.map((u) => u.id),
        )
      ).map((d) => [
        d.unidadId,
        { saldo: d.saldo, diasAtraso: Math.max(0, diasEntre(d.fechaVencimiento, hoy)) },
      ]),
    );

    const boletas = calcularBoletas(
      gastos,
      unidades,
      {
        criterio: liquidacion.criterioProrrateo,
        porcentajeFondoReserva: consorcio.porcentajeFondoReserva,
        tasaInteresMora: consorcio.tasaInteresMora,
        periodicidadMora: consorcio.periodicidadMora,
      },
      deudas,
      await this.expensas.ajustesDe(liquidacion.id),
    );

    await this.expensas.reemplazarBoletas(
      liquidacion.id,
      boletas,
      EstadoLiquidacion.PREVISUALIZACION,
    );
    return boletas;
  }

  /**
   * Cambiar un gasto con la previsualización abierta la deja desactualizada:
   * se recalcula en el momento, así lo que se ve es siempre lo que se emitiría.
   */
  private async despuesDeTocarGastos(liquidacionId: string): Promise<void> {
    await this.expensas.recalcularTotalGastos(liquidacionId);
    await this.refrescarPrevisualizacion(liquidacionId);
  }

  private async refrescarPrevisualizacion(liquidacionId: string): Promise<void> {
    const liquidacion = await this.exigirLiquidacion(liquidacionId);
    if (liquidacion.estado !== EstadoLiquidacion.PREVISUALIZACION) return;

    // Si se borró el último gasto no hay nada que previsualizar: vuelve a borrador.
    if ((await this.expensas.gastosDe(liquidacionId)).length === 0) {
      await this.expensas.reemplazarBoletas(liquidacionId, [], EstadoLiquidacion.BORRADOR);
      return;
    }
    await this.recalcular(liquidacion);
  }

  /**
   * Un aviso por vecino vinculado a cada unidad. Avisar nunca corta la
   * emisión: si falla, las boletas ya quedaron emitidas igual.
   */
  private async avisarEmision(
    liquidacion: Liquidacion,
    boletas: { unidadId: string; total: number }[],
  ): Promise<void> {
    const vecinos = await this.expensas.vecinosPorUnidad(boletas.map((b) => b.unidadId));
    const mes = liquidacion.periodo.slice(0, 7);

    for (const boleta of boletas) {
      for (const destinatarioId of vecinos.get(boleta.unidadId) ?? []) {
        try {
          await this.notificador.enviar({
            destinatarioId,
            asunto: `Expensas de ${mes}`,
            cuerpo: `Ya está tu boleta de expensas por $${boleta.total.toFixed(2)}. Vence el ${liquidacion.fechaVencimiento}.`,
            origen: `liquidacion:${liquidacion.id}`,
          });
        } catch (error) {
          this.logger.warn(`No se pudo avisar a ${destinatarioId}: ${String(error)}`);
        }
      }
    }
  }

  private async exigirLiquidacion(id: string): Promise<Liquidacion> {
    const liquidacion = await this.expensas.findById(id);
    if (!liquidacion) throw new NotFoundException(`La liquidación ${id} no existe`);
    return liquidacion;
  }

  private async exigirEditable(id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirLiquidacion(id);
    if (!EDITABLES.includes(liquidacion.estado)) {
      throw new BadRequestException(
        `La liquidación está ${liquidacion.estado}: sus boletas ya son deuda y no se modifican`,
      );
    }
    return liquidacion;
  }

  private async exigirGasto(liquidacionId: string, gastoId: string): Promise<Gasto> {
    const gasto = await this.expensas.findGasto(gastoId);
    if (!gasto || gasto.liquidacionId !== liquidacionId) {
      throw new NotFoundException(`El gasto ${gastoId} no existe en esta liquidación`);
    }
    return gasto;
  }

  /** Vencer antes de que empiece el período no tiene sentido. */
  private exigirVencimientoValido(periodo: string, fechaVencimiento: string): void {
    if (fechaVencimiento <= periodo) {
      throw new BadRequestException('El vencimiento tiene que ser posterior al inicio del período');
    }
  }

  /** Las cuotas van de a pares: "2 de 6". */
  private exigirCuotasValidas(numero?: number, total?: number): void {
    if ((numero === undefined) !== (total === undefined)) {
      throw new BadRequestException('Indicá cuotaNumero y cuotaTotal juntos');
    }
    if (numero !== undefined && total !== undefined && numero > total) {
      throw new BadRequestException('cuotaNumero no puede ser mayor que cuotaTotal');
    }
  }
}
