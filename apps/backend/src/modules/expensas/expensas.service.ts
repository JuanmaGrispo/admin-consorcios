import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PublicadorEventos } from '../../core/mensajeria/publicador-eventos';
import { Notificador } from '../../core/notificaciones/notificador';
import {
  Boleta,
  CriterioProrrateo,
  EstadoBoleta,
  EstadoLiquidacion,
  Gasto,
  Liquidacion,
  ResultadoVotacion,
  UnidadUsuario,
  Usuario,
} from '../../database/entities';
import { ArchivosService } from '../archivos/archivos.service';
import { DestinoArchivo } from '../archivos/tipos-archivo';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { ReclamosService } from '../reclamos/reclamos.service';
import { RubrosGastoService } from '../rubros-gasto/rubros-gasto.service';
import { AjustarBoletaDto } from './dto/ajustar-boleta.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { CreateLiquidacionDto } from './dto/create-liquidacion.dto';
import { EnviarRecordatoriosDto } from './dto/enviar-recordatorios.dto';
import { ListarBoletasQuery } from './dto/listar-boletas.query';
import { ListarLiquidacionesQuery } from './dto/listar-liquidaciones.query';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { UpdateLiquidacionDto } from './dto/update-liquidacion.dto';
import { generarBoletaPdf } from './boleta-pdf';
import {
  aCsv,
  elegirOcupantes,
  estadosDe,
  type FilaCobranza,
  type VecinoDeFila,
} from './cobranzas';
import { estadoBoleta } from './estado-boleta';
import {
  ExpensasRepository,
  type AlcanceBoletas,
  type CobranzaDeLiquidacion,
  type ResumenCobranzas,
} from './expensas.repository';
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

/** Ya salieron: sus boletas son deuda real, el vecino las ve y se pagan. */
const EMITIDAS = [EstadoLiquidacion.EMITIDA, EstadoLiquidacion.CERRADA];


/**
 * Tope de filas para lo que no se pagina (exportación y recordatorios). Un
 * consorcio grande con varios años de boletas no tiene por qué entrar entero
 * en memoria de una: con un alcance razonable —un período— nunca se llega.
 */
const TOPE_EXPORTACION = 5_000;

/** El vecino como sale en la grilla: nunca el hash de su password. */
const aVecinoDeFila = (usuario: Usuario): VecinoDeFila => ({
  id: usuario.id,
  nombre: usuario.nombre,
  apellido: usuario.apellido,
  email: usuario.email,
  telefono: usuario.telefono,
});

/** Lo que una unidad debe hoy: la cabecera de la pantalla del vecino. */
export interface SaldoDeUnidad {
  boletaId: string;
  /** AAAA-MM. */
  periodo: string;
  fechaVencimiento: string;
  total: number;
  pagado: number;
  saldo: number;
  estado: EstadoBoleta;
  /** Negativo si ya venció. */
  diasParaVencer: number;
}

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
    private readonly reclamos: ReclamosService,
    private readonly notificador: Notificador,
    private readonly archivos: ArchivosService,
    private readonly eventos: PublicadorEventos,
  ) {}

  // ── Liquidaciones ──────────────────────────────────────────────────────────

  listar(usuario: UsuarioActual, query: ListarLiquidacionesQuery): Promise<Liquidacion[]> {
    return this.expensas.listar(query, consorciosGestionados(usuario));
  }

  async findOne(usuario: UsuarioActual, id: string): Promise<Liquidacion> {
    const liquidacion = await this.expensas.findConGastos(id);
    if (!liquidacion || !gestiona(usuario, liquidacion.consorcioId)) {
      throw new NotFoundException(`La liquidación ${id} no existe`);
    }
    return liquidacion;
  }

  async create(usuario: UsuarioActual, dto: CreateLiquidacionDto): Promise<Liquidacion> {
    if (!gestiona(usuario, dto.consorcioId)) {
      throw new NotFoundException(`Consorcio ${dto.consorcioId} no existe`);
    }
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
    return this.findOne(usuario, creada.id);
  }

  async update(usuario: UsuarioActual, id: string, dto: UpdateLiquidacionDto): Promise<Liquidacion> {
    const liquidacion = await this.exigirEditable(usuario, id);
    if (dto.fechaVencimiento) this.exigirVencimientoValido(liquidacion.periodo, dto.fechaVencimiento);

    // Sin campos, TypeORM falla con UpdateValuesMissingError.
    if (Object.keys(dto).length > 0) await this.expensas.update(id, dto);
    await this.refrescarPrevisualizacion(id);
    return this.findOne(usuario, id);
  }

  /** Sólo antes de emitir. Gastos y boletas se borran con ella. */
  async remove(usuario: UsuarioActual, id: string): Promise<void> {
    await this.exigirEditable(usuario, id);
    await this.expensas.remove(id);
  }

  // ── Gastos ─────────────────────────────────────────────────────────────────

  async agregarGasto(
    usuario: UsuarioActual,
    liquidacionId: string,
    dto: CreateGastoDto,
  ): Promise<Gasto> {
    const liquidacion = await this.exigirEditable(usuario, liquidacionId);
    const rubro = await this.rubros.exigirUsable(dto.rubroId, liquidacion.consorcioId);
    if (dto.proveedorId) {
      await this.proveedores.exigirAsignable(dto.proveedorId, liquidacion.consorcioId);
    }
    await this.exigirOrigenValido(dto, liquidacion.consorcioId);
    this.exigirCuotasValidas(dto.cuotaNumero, dto.cuotaTotal);
    if (dto.comprobanteUrl) {
      this.archivos.exigirPropia(dto.comprobanteUrl, DestinoArchivo.COMPROBANTES);
    }

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
    usuario: UsuarioActual,
    liquidacionId: string,
    gastoId: string,
    dto: UpdateGastoDto,
  ): Promise<Gasto> {
    const liquidacion = await this.exigirEditable(usuario, liquidacionId);
    const gasto = await this.exigirGasto(liquidacionId, gastoId);

    if (dto.rubroId && dto.rubroId !== gasto.rubroId) {
      await this.rubros.exigirUsable(dto.rubroId, liquidacion.consorcioId);
    }
    if (dto.proveedorId && dto.proveedorId !== gasto.proveedorId) {
      await this.proveedores.exigirAsignable(dto.proveedorId, liquidacion.consorcioId);
    }
    await this.exigirOrigenValido(
      {
        reclamoId: dto.reclamoId !== gasto.reclamoId ? dto.reclamoId : undefined,
        votacionId: dto.votacionId !== gasto.votacionId ? dto.votacionId : undefined,
      },
      liquidacion.consorcioId,
    );
    this.exigirCuotasValidas(
      dto.cuotaNumero ?? gasto.cuotaNumero ?? undefined,
      dto.cuotaTotal ?? gasto.cuotaTotal ?? undefined,
    );

    // Sólo si cambia: un comprobante ya guardado no se vuelve a juzgar.
    if (dto.comprobanteUrl && dto.comprobanteUrl !== gasto.comprobanteUrl) {
      this.archivos.exigirPropia(dto.comprobanteUrl, DestinoArchivo.COMPROBANTES);
    }

    const actualizado = await this.expensas.actualizarGasto(gasto, dto);
    await this.despuesDeTocarGastos(liquidacionId);
    return actualizado;
  }

  async borrarGasto(usuario: UsuarioActual, liquidacionId: string, gastoId: string): Promise<void> {
    await this.exigirEditable(usuario, liquidacionId);
    await this.exigirGasto(liquidacionId, gastoId);
    await this.expensas.borrarGasto(gastoId);
    await this.despuesDeTocarGastos(liquidacionId);
  }

  // ── Ciclo de la liquidación ────────────────────────────────────────────────

  /**
   * Calcula las boletas y deja la liquidación en PREVISUALIZACION. Se puede
   * repetir: cada vez se recalcula todo, conservando los ajustes manuales.
   */
  async previsualizar(usuario: UsuarioActual, id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirEditable(usuario, id);
    await this.recalcular(liquidacion);
    return this.findOne(usuario, id);
  }

  /**
   * Congela las boletas y avisa a los vecinos. Antes recalcula: entre la
   * previsualización y la emisión pudo entrar un pago o cambiar una unidad, y
   * lo que se emite tiene que reflejar el estado de hoy.
   */
  async emitir(usuario: UsuarioActual, id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirLiquidacion(usuario, id);
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

    this.eventos.publicar('expensas.emitidas', liquidacion.consorcioId, {
      liquidacion_id: liquidacion.id,
      periodo: liquidacion.periodo.slice(0, 7),
      unidades_afectadas: boletas.map((b) => b.unidadId),
      fecha_vencimiento: liquidacion.fechaVencimiento,
    });
    return this.findOne(usuario, id);
  }

  /** Da el período por terminado. Sus boletas siguen vigentes como deuda. */
  async cerrar(usuario: UsuarioActual, id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirLiquidacion(usuario, id);
    if (liquidacion.estado !== EstadoLiquidacion.EMITIDA) {
      throw new BadRequestException('Sólo se cierra una liquidación emitida');
    }
    await this.expensas.update(id, { estado: EstadoLiquidacion.CERRADA });
    return this.findOne(usuario, id);
  }

  // ── Boletas ────────────────────────────────────────────────────────────────

  /**
   * La grilla de cobranzas. El administrador ve las de sus consorcios; el vecino,
   * las emitidas de sus unidades. Cada fila viaja con lo pagado, el saldo y
   * quién vive en la unidad: la boleta sola no alcanza para decidir a quién
   * reclamarle.
   */
  async listarBoletas(
    usuario: UsuarioActual,
    query: ListarBoletasQuery,
  ): Promise<{ items: FilaCobranza[]; total: number; pagina: number; paginas: number }> {
    await this.expensas.marcarVencidas();
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const { items, total } = await this.expensas.listarBoletas(
      await this.alcanceDe(usuario, query),
      { pagina, limite },
    );

    return {
      items: await this.aFilas(items, { conOcupantes: esGestor(usuario) }),
      total,
      pagina,
      paginas: Math.ceil(total / limite) || 1,
    };
  }

  /**
   * Los totales de la cabecera de cobranzas, sobre el mismo alcance que la
   * grilla, más los conteos de cada solapa.
   */
  async resumenCobranzas(
    usuario: UsuarioActual,
    query: ListarBoletasQuery,
  ): Promise<ResumenCobranzas> {
    await this.expensas.marcarVencidas();
    // El resumen de la cabecera no se recorta por solapa: muestra el total del
    // período, y los conteos son justamente los de cada solapa.
    const { situacion: _s, estado: _e, ...alcance } = query;
    return this.expensas.resumenCobranzas(await this.alcanceDe(usuario, alcance));
  }

  /** La grilla completa como CSV, con los filtros que se estén viendo. */
  async exportarCobranzas(
    usuario: UsuarioActual,
    query: ListarBoletasQuery,
  ): Promise<{ csv: string; nombre: string }> {
    await this.expensas.marcarVencidas();
    const boletas = await this.expensas.listarBoletasCompletas(
      await this.alcanceDe(usuario, query),
      TOPE_EXPORTACION,
    );
    const filas = await this.aFilas(boletas, { conOcupantes: esGestor(usuario) });
    const sufijo = query.periodo ?? new Date().toISOString().slice(0, 10);
    return { csv: aCsv(filas), nombre: `cobranzas-${sufijo}.csv` };
  }

  /**
   * Un aviso a cada vecino de cada boleta con saldo del alcance. Es la acción
   * de "Enviar recordatorios": no cambia nada en la base, sólo avisa, y un
   * aviso que falla no corta el resto.
   */
  async enviarRecordatorios(
    usuario: UsuarioActual,
    dto: EnviarRecordatoriosDto,
  ): Promise<{ boletas: number; avisos: number; sinDestinatario: number; fallidos: number }> {
    await this.expensas.marcarVencidas();

    const boletas = await this.expensas.listarBoletasCompletas(
      {
        ...(await this.alcanceDe(usuario, {
          liquidacionId: dto.liquidacionId,
          consorcioId: dto.consorcioId,
          periodo: dto.periodo,
          situacion: dto.situacion,
        })),
        // Una boleta ajena no entra: el alcance del administrador ya la recorta.
        boletaId: dto.boletaId,
        // Nunca a quien ya pagó, aunque el filtro diga otra cosa.
        conSaldo: true,
        // Recordar una previsualización sería reclamar una deuda que no existe.
        soloEmitidas: true,
      },
      TOPE_EXPORTACION,
    );

    const vecinos = await this.expensas.vecinosPorUnidad(boletas.map((b) => b.unidadId));
    const pagos = await this.expensas.pagosPorBoleta(boletas.map((b) => b.id));
    let avisos = 0;
    let sinDestinatario = 0;
    let fallidos = 0;

    for (const boleta of boletas) {
      const destinatarios = vecinos.get(boleta.unidadId) ?? [];
      if (destinatarios.length === 0) {
        sinDestinatario += 1;
        continue;
      }

      const saldo = aPesos(
        Math.max(0, aCentavos(boleta.total) - aCentavos(pagos.get(boleta.id)?.pagado ?? 0)),
      );
      const mes = boleta.liquidacion.periodo.slice(0, 7);
      const vencida = boleta.estado === EstadoBoleta.VENCIDA;

      for (const destinatarioId of destinatarios) {
        try {
          await this.notificador.enviar({
            destinatarioId,
            asunto: vencida ? `Expensas de ${mes} vencidas` : `Vence tu boleta de ${mes}`,
            cuerpo: [
              `Tu unidad ${boleta.unidad.etiqueta} tiene un saldo de $${saldo.toFixed(2)} de las expensas de ${mes}.`,
              vencida
                ? `El vencimiento fue el ${boleta.liquidacion.fechaVencimiento}.`
                : `Vence el ${boleta.liquidacion.fechaVencimiento}.`,
              dto.mensaje,
            ]
              .filter(Boolean)
              .join(' '),
            origen: `boleta:${boleta.id}`,
          });
          avisos += 1;
        } catch (error) {
          fallidos += 1;
          this.logger.warn(`No se pudo recordar a ${destinatarioId}: ${String(error)}`);
        }
      }
    }

    return { boletas: boletas.length, avisos, sinDestinatario, fallidos };
  }

  /**
   * Lo que debe hoy una unidad: su boleta vigente (la última emitida) y el
   * saldo que le queda. Es lo que el vecino ve arriba de todo al entrar.
   */
  async saldoDeUnidad(unidadId: string): Promise<SaldoDeUnidad | null> {
    await this.expensas.marcarVencidas();
    const boletaId = await this.expensas.ultimaBoletaEmitida(unidadId);
    if (!boletaId) return null;

    const boleta = (await this.expensas.findBoleta(boletaId))!;
    const pagado = await this.expensas.pagadoDe(boletaId);
    const saldo = aPesos(Math.max(0, aCentavos(boleta.total) - aCentavos(pagado)));

    return {
      boletaId: boleta.id,
      periodo: boleta.liquidacion.periodo.slice(0, 7),
      fechaVencimiento: boleta.liquidacion.fechaVencimiento,
      total: boleta.total,
      pagado,
      saldo,
      estado: boleta.estado,
      diasParaVencer: diasEntre(await this.expensas.hoy(), boleta.liquidacion.fechaVencimiento),
    };
  }

  async findBoleta(usuario: UsuarioActual, id: string): Promise<Boleta> {
    await this.expensas.marcarVencidas();
    const boleta = await this.expensas.findBoleta(id);
    const visible =
      boleta &&
      (esGestor(usuario)
        ? gestiona(usuario, boleta.liquidacion.consorcioId)
        : EMITIDAS.includes(boleta.liquidacion.estado) &&
          (await this.expensas.unidadesDelUsuario(usuario.id)).includes(boleta.unidadId));
    // Una boleta ajena o, al vecino, sin emitir da 404: un 403 confirmaría que existe.
    if (!visible) throw new NotFoundException(`La boleta ${id} no existe`);
    return boleta;
  }

  /** La boleta en PDF, con los mismos permisos que leerla. Se genera al vuelo. */
  async pdfBoleta(usuario: UsuarioActual, id: string): Promise<{ buffer: Buffer; nombre: string }> {
    const boleta = await this.findBoleta(usuario, id);
    const consorcio = await this.consorcios.findOne(boleta.liquidacion.consorcioId);
    const buffer = await generarBoletaPdf(boleta, consorcio, await this.expensas.pagadoDe(id));
    const etiqueta = boleta.unidad.etiqueta.replace(/[^\w-]+/g, '');
    return { buffer, nombre: `expensas-${boleta.liquidacion.periodo.slice(0, 7)}-${etiqueta}.pdf` };
  }

  /**
   * Ajuste manual sobre una boleta en previsualización (una bonificación, un
   * cargo puntual). Se conserva si después se recalcula la liquidación.
   */
  async ajustarBoleta(usuario: UsuarioActual, id: string, dto: AjustarBoletaDto): Promise<Boleta> {
    const boleta = await this.findBoleta(usuario, id);
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

  // ── Para pagos ─────────────────────────────────────────────────────────────

  /**
   * La boleta a la que se le puede imputar un pago y cuánto le falta. Sólo la
   * última emitida de la unidad: las anteriores ya viajaron como saldo
   * anterior, y pagarlas cobraría dos veces la misma deuda.
   */
  async boletaPagable(
    usuario: UsuarioActual,
    id: string,
  ): Promise<{ boleta: Boleta; saldo: number }> {
    // Mismos permisos que leerla: al vecino, una ajena le da 404.
    const boleta = await this.findBoleta(usuario, id);
    if (!EMITIDAS.includes(boleta.liquidacion.estado)) {
      throw new BadRequestException('La boleta todavía no se emitió');
    }
    if ((await this.expensas.ultimaBoletaEmitida(boleta.unidadId)) !== boleta.id) {
      throw new BadRequestException(
        'Esta deuda ya está incluida en la boleta más reciente de la unidad: pagá esa',
      );
    }

    const saldo = aCentavos(boleta.total) - aCentavos(await this.expensas.pagadoDe(id));
    if (saldo <= 0) throw new BadRequestException('La boleta ya está pagada');
    return { boleta, saldo: aPesos(saldo) };
  }

  /** Sin chequeo de permisos: para pagos, que ya sabe qué boleta es (el webhook no tiene usuario). */
  async findBoletaInterna(id: string): Promise<Boleta> {
    const boleta = await this.expensas.findBoleta(id);
    if (!boleta) throw new NotFoundException(`La boleta ${id} no existe`);
    return boleta;
  }

  /** Las unidades que ve un vecino; `undefined` para quien administra (lo acota por consorcio). */
  async unidadesVisibles(usuario: UsuarioActual): Promise<string[] | undefined> {
    return esGestor(usuario) ? undefined : this.expensas.unidadesDelUsuario(usuario.id);
  }

  /** A quién avisarle algo de una unidad: los vecinos vinculados hoy. */
  async vecinosDe(unidadId: string): Promise<string[]> {
    return (await this.expensas.vecinosPorUnidad([unidadId])).get(unidadId) ?? [];
  }

  /**
   * Recalcula el estado desde los pagos. Lo llama pagos después de cada cambio
   * (un pago nuevo, una aprobación o un reintegro de Mercado Pago).
   */
  async sincronizarEstado(boletaId: string): Promise<Boleta> {
    const boleta = await this.expensas.findBoleta(boletaId);
    if (!boleta) throw new NotFoundException(`La boleta ${boletaId} no existe`);

    const estado = estadoBoleta(
      boleta.total,
      await this.expensas.pagadoDe(boletaId),
      boleta.liquidacion.fechaVencimiento,
      await this.expensas.hoy(),
    );
    await this.expensas.actualizarEstado(boletaId, estado);
    if (estado === EstadoBoleta.PAGADA) {
      await this.expensas.saldarAnteriores(boleta.unidadId, boleta.liquidacion.periodo);
    }
    return { ...boleta, estado };
  }

  // ── Para el panel del administrador ────────────────────────────────────────

  /** Lo cobrado de cada liquidación de sus consorcios entre dos períodos (AAAA-MM). */
  async cobranzasPorLiquidacion(
    usuario: UsuarioActual,
    desde: string,
    hasta: string,
  ): Promise<CobranzaDeLiquidacion[]> {
    await this.expensas.marcarVencidas();
    return this.expensas.cobranzasPorLiquidacion(consorciosGestionados(usuario), desde, hasta);
  }

  /** Unidades con deuda vencida hace más de `dias`, por consorcio. */
  async deudaAntigua(usuario: UsuarioActual, dias: number) {
    await this.expensas.marcarVencidas();
    return this.expensas.deudaAntigua(consorciosGestionados(usuario), dias);
  }

  /** El último período que emitió alguno de sus consorcios, o null si ninguno emitió. */
  ultimoPeriodoEmitido(usuario: UsuarioActual): Promise<string | null> {
    return this.expensas.ultimoPeriodoEmitidoDe(consorciosGestionados(usuario));
  }

  // ── Para reservas ──────────────────────────────────────────────────────────

  /**
   * Si la unidad tiene expensas impagas y vencidas. Lo consulta reservas para
   * los amenities con `bloquea_con_deuda`. Marca las vencidas antes de contar:
   * si no, la respuesta dependería de que alguien hubiera mirado sus boletas.
   */
  async tieneDeudaVencida(unidadId: string): Promise<boolean> {
    await this.expensas.marcarVencidas();
    return (await this.expensas.contarVencidasDeUnidad(unidadId)) > 0;
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  /**
   * Traduce los filtros de la pantalla y quién mira a un alcance de boletas.
   * Que lo arme un solo método es lo que garantiza que la grilla, el resumen,
   * la exportación y los recordatorios hablen siempre del mismo conjunto.
   */
  private async alcanceDe(
    usuario: UsuarioActual,
    query: Partial<ListarBoletasQuery>,
  ): Promise<AlcanceBoletas> {
    const vecino = !esGestor(usuario);
    return {
      liquidacionId: query.liquidacionId,
      consorcioId: query.consorcioId,
      unidadId: query.unidadId,
      periodo: query.periodo,
      estado: query.estado,
      estados: query.situacion ? estadosDe(query.situacion) : undefined,
      buscar: query.buscar,
      unidadIds: vecino ? await this.expensas.unidadesDelUsuario(usuario.id) : undefined,
      consorcioIds: vecino ? undefined : consorciosGestionados(usuario),
      soloEmitidas: vecino,
    };
  }

  /**
   * Le pega a cada boleta lo pagado y, para quien administra, los ocupantes
   * de la unidad. Los dos datos se piden de una sola vez para toda la página:
   * uno por fila serían veinte idas a la base para pintar una grilla.
   *
   * Al vecino no le viajan los ocupantes: no necesita el teléfono del
   * propietario para ver su propia boleta.
   */
  private async aFilas(
    boletas: Boleta[],
    opciones: { conOcupantes: boolean },
  ): Promise<FilaCobranza[]> {
    const pagos = await this.expensas.pagosPorBoleta(boletas.map((b) => b.id));
    const vinculos = opciones.conOcupantes
      ? await this.expensas.vinculosVigentes([...new Set(boletas.map((b) => b.unidadId))])
      : new Map<string, UnidadUsuario[]>();

    return boletas.map((boleta) => {
      const pago = pagos.get(boleta.id);
      const pagado = pago?.pagado ?? 0;
      const ocupantes = elegirOcupantes(
        (vinculos.get(boleta.unidadId) ?? []).map((v) => ({
          vinculo: v.vinculo,
          esTitular: v.esTitular,
          vecino: aVecinoDeFila(v.usuario),
        })),
      );

      return {
        id: boleta.id,
        unidad: {
          id: boleta.unidad.id,
          etiqueta: boleta.unidad.etiqueta,
          coeficiente: boleta.unidad.coeficiente,
        },
        periodo: boleta.liquidacion.periodo.slice(0, 7),
        fechaVencimiento: boleta.liquidacion.fechaVencimiento,
        coeficienteAplicado: boleta.coeficienteAplicado,
        propietario: ocupantes.propietario,
        inquilino: ocupantes.inquilino,
        emitido: boleta.total,
        pagado,
        saldo: aPesos(Math.max(0, aCentavos(boleta.total) - aCentavos(pagado))),
        medio: pago?.medio ?? null,
        ultimoPago: pago ? { id: pago.ultimoPagoId, fecha: pago.fechaUltimoPago } : null,
        estado: boleta.estado,
        interesesMora: boleta.interesesMora,
      };
    });
  }

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
    const liquidacion = await this.expensas.findById(liquidacionId);
    if (!liquidacion || liquidacion.estado !== EstadoLiquidacion.PREVISUALIZACION) return;

    // Si se borró el último gasto no hay nada que previsualizar: vuelve a borrador.
    if ((await this.expensas.gastosDe(liquidacionId)).length === 0) {
      await this.expensas.reemplazarBoletas(liquidacionId, [], EstadoLiquidacion.BORRADOR);
      return;
    }
    await this.recalcular(liquidacion);
  }

  /** Una liquidación de otro consorcio responde como inexistente. */
  private async exigirLiquidacion(usuario: UsuarioActual, id: string): Promise<Liquidacion> {
    const liquidacion = await this.expensas.findById(id);
    if (!liquidacion || !gestiona(usuario, liquidacion.consorcioId)) {
      throw new NotFoundException(`La liquidación ${id} no existe`);
    }
    return liquidacion;
  }

  private async exigirEditable(usuario: UsuarioActual, id: string): Promise<Liquidacion> {
    const liquidacion = await this.exigirLiquidacion(usuario, id);
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

  /**
   * El reclamo o la votación de donde sale un gasto tienen que ser del mismo
   * consorcio. La votación, además, aprobada: un gasto "aprobado en asamblea"
   * que se rechazó no se puede cobrar.
   */
  private async exigirOrigenValido(
    origen: { reclamoId?: string | null; votacionId?: string | null },
    consorcioId: string,
  ): Promise<void> {
    if (origen.reclamoId) await this.reclamos.exigirVinculable(origen.reclamoId, consorcioId);
    if (!origen.votacionId) return;

    const votacion = await this.expensas.findVotacion(origen.votacionId);
    if (!votacion) throw new BadRequestException(`La votación ${origen.votacionId} no existe`);
    if (votacion.consorcioId !== consorcioId) {
      throw new BadRequestException(`La votación "${votacion.titulo}" es de otro consorcio`);
    }
    if (votacion.resultado !== ResultadoVotacion.APROBADA) {
      throw new BadRequestException(`La votación "${votacion.titulo}" no está aprobada`);
    }
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
