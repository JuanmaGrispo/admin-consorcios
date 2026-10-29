import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Boleta, EstadoBoleta } from '../../database/entities';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { estadoBoleta } from './estado-boleta';
import { estadoDe } from './estado-liquidacion';
import { ExpensasRepository, type CobranzaDeLiquidacion } from './expensas.repository';
import { aCentavos, aPesos } from './prorrateo';

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
  /** El último pago aprobado de esta boleta ("Pagaste … el 04/09" y "Ver recibo"). */
  ultimoPago: { id: string; fecha: Date } | null;
}

const MS_POR_DIA = 86_400_000;
/** Días entre dos fechas ISO (YYYY-MM-DD). */
export const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_POR_DIA);

/**
 * La boleta con los permisos de leerla: quien administra, las de sus
 * consorcios; el vecino, las emitidas de sus unidades. La usan la pantalla de
 * la boleta y pagos, así que vive en un solo lugar.
 */
export async function buscarBoletaVisible(
  repo: ExpensasRepository,
  usuario: UsuarioActual,
  id: string,
): Promise<Boleta> {
  await repo.marcarVencidas();
  const boleta = await repo.findBoleta(id);
  const visible =
    boleta &&
    (esGestor(usuario)
      ? gestiona(usuario, boleta.liquidacion.consorcioId)
      : estadoDe(boleta.liquidacion.estado).esDeuda &&
        (await repo.unidadesDelUsuario(usuario.id)).includes(boleta.unidadId));
  // Una boleta ajena o, al vecino, sin emitir da 404: un 403 confirmaría que existe.
  if (!visible) throw new NotFoundException(`La boleta ${id} no existe`);
  return boleta;
}

/**
 * Lo que debe y cómo paga cada unidad, para los módulos que sólo necesitan
 * eso: inicio, pagos, el panel, reservas y votaciones. Separado de
 * ExpensasService, que es el ciclo de la liquidación: un cambio en la regla
 * de deuda no toca la emisión, y quien pregunta por la deuda no depende de
 * todo lo demás.
 */
@Injectable()
export class EstadoCuentaService {
  constructor(private readonly expensas: ExpensasRepository) {}

  /**
   * Lo que debe hoy una unidad: su boleta vigente (la última emitida) y el
   * saldo que le queda. Es lo que el vecino ve arriba de todo al entrar.
   */
  async saldoDeUnidad(unidadId: string): Promise<SaldoDeUnidad | null> {
    await this.expensas.marcarVencidas();
    const boletaId = await this.expensas.ultimaBoletaEmitida(unidadId);
    if (!boletaId) return null;

    const boleta = (await this.expensas.findBoleta(boletaId))!;
    const pago = (await this.expensas.pagosPorBoleta([boletaId])).get(boletaId);
    const pagado = pago?.pagado ?? 0;
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
      ultimoPago: pago ? { id: pago.ultimoPagoId, fecha: pago.fechaUltimoPago } : null,
    };
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
    const boleta = await buscarBoletaVisible(this.expensas, usuario, id);
    if (!estadoDe(boleta.liquidacion.estado).esDeuda) {
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

  /** `tieneDeudaVencida` para muchas unidades a la vez: la vista previa del padrón. */
  async unidadesConDeudaVencida(unidadIds: string[]): Promise<Set<string>> {
    if (unidadIds.length === 0) return new Set();
    await this.expensas.marcarVencidas();
    return new Set(await this.expensas.unidadesConVencidas(unidadIds));
  }
}
