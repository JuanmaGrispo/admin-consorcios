import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Notificador } from '../../core/notificaciones/notificador';
import { crearAviso } from '../../core/notificaciones/notificador';
import { EventoDomus } from '../../core/mensajeria/eventos';
import { estadoBoleta } from '../expensas/estado-boleta';
import { ConceptoPago, EstadoPago, MedioPago, Pago } from '../../database/entities';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { EstadoCuentaService } from '../expensas/estado-cuenta.service';
import { ZONA_POR_DEFECTO } from '../reservas/horario';
import { ReservasService } from '../reservas/reservas.service';
import { DestinoPagoDto } from './dto/destino-pago';
import { aCentavos } from '../expensas/prorrateo';
import { ListarPagosQuery } from './dto/listar-pagos.query';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { MercadoPagoClient, type PagoMercadoPago } from './mercado-pago.client';
import { PagosRepository, ContextoPago } from './pagos.repository';
import { generarReciboPdf } from './recibo-pdf';

/** Lo que no es aprobado, rechazado ni devuelto sigue en curso. */
export function estadoSegunMercadoPago(status: string): EstadoPago {
  switch (status) {
    case 'approved':
      return EstadoPago.APROBADO;
    case 'rejected':
    case 'cancelled':
      return EstadoPago.RECHAZADO;
    case 'refunded':
    case 'charged_back':
      return EstadoPago.REINTEGRADO;
    default:
      return EstadoPago.PENDIENTE;
  }
}

/**
 * Los pagos de expensas. La boleta es de expensas: acá sólo se registra el
 * pago y se le pide a expensas que recalcule el estado.
 */
/** Los últimos 4 de la tarjeta, sólo si son 4 dígitos: la base no acepta otra cosa. */
function ultimosDigitos(valor: string | null | undefined): string | null {
  return valor && /^[0-9]{4}$/.test(valor) ? valor : null;
}

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly pagos: PagosRepository,
    private readonly estadoCuenta: EstadoCuentaService,
    private readonly consorcios: ConsorciosService,
    private readonly mercadoPago: MercadoPagoClient,
    private readonly notificador: Notificador,
    private readonly reservas: ReservasService,
  ) {}

  async listar(usuario: UsuarioActual, query: ListarPagosQuery): Promise<Pago[]> {
    return this.pagos.listar(
      query,
      esGestor(usuario)
        ? { consorcioIds: consorciosGestionados(usuario) }
        : { unidadIds: await this.estadoCuenta.unidadesVisibles(usuario) },
    );
  }

  /**
   * Un pago con su unidad y su boleta: es la pantalla de "pago aprobado" o
   * "pago rechazado" que el vecino ve al volver de Mercado Pago.
   */
  async findOne(usuario: UsuarioActual, id: string): Promise<Pago> {
    const pago = await this.pagos.findConRelaciones(id);
    const visible =
      pago &&
      (esGestor(usuario)
        ? gestiona(usuario, pago.unidad.consorcioId)
        : (await this.estadoCuenta.unidadesVisibles(usuario))!.includes(pago.unidadId));
    // Un pago ajeno da 404 y no 403: un 403 confirmaría que existe.
    if (!visible) {
      throw new NotFoundException(`El pago ${id} no existe`);
    }
    return pago;
  }

  /**
   * El recibo en PDF, con los mismos permisos que el detalle. Sólo de un pago
   * aprobado: dar comprobante de algo que el banco rechazó sería mentir.
   * Se genera al vuelo, como la boleta, así que `recibo_url` queda sin usar.
   */
  async reciboPdf(
    usuario: UsuarioActual,
    id: string,
  ): Promise<{ buffer: Buffer; nombre: string }> {
    const pago = await this.findOne(usuario, id);
    if (pago.estado !== EstadoPago.APROBADO) {
      throw new BadRequestException(`El pago está ${pago.estado}: todavía no hay recibo`);
    }

    const consorcio = await this.consorcios.findOne(pago.unidad.consorcioId);
    const reserva = pago.reservaId ? await this.reservas.findInterna(pago.reservaId) : null;
    const buffer = await generarReciboPdf({
      pago,
      etiquetaUnidad: pago.unidad.etiqueta,
      periodo: pago.boleta?.liquidacion?.periodo ?? null,
      concepto: reserva
        ? `Seña ${reserva.amenity.nombre} · reserva del ${reserva.inicio.toLocaleDateString('es-AR', { timeZone: ZONA_POR_DEFECTO })}`
        : null,
      consorcio,
    });
    const numero = (pago.reciboNumero ?? pago.id).replace(/[^\w-]+/g, '');
    return { buffer, nombre: `recibo-${numero}.pdf` };
  }

  /** Transferencia, efectivo u otro medio que el administrador ya verificó. */
  async registrar(usuario: UsuarioActual, dto: RegistrarPagoDto): Promise<Pago> {
    const cobro = await this.cobrable(usuario, dto);
    if (aCentavos(dto.monto) > aCentavos(cobro.saldo)) {
      throw new BadRequestException(`El monto supera el saldo ($${cobro.saldo.toFixed(2)})`);
    }

    const pago = await this.pagos.crear({
      ...cobro.destino,
      monto: dto.monto,
      medio: dto.medio,
      estado: EstadoPago.APROBADO,
      fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
      registradoPorId: usuario.id,
    }, (contexto) => this.efectosPago(contexto));
    return pago;
  }

  // ── Mercado Pago ───────────────────────────────────────────────────────────

  /**
   * Arranca un cobro online por el saldo de la boleta o de la seña. El pago
   * nace PENDIENTE y su id viaja como `external_reference`: así el webhook
   * sabe a qué pago corresponde lo que confirma Mercado Pago.
   */
  async crearPreferencia(
    usuario: UsuarioActual,
    dto: DestinoPagoDto,
  ): Promise<{ pagoId: string; initPoint: string }> {
    const { destino, saldo, titulo } = await this.cobrable(usuario, dto);
    if (await this.pagos.preferenciaIncierta(destino)) {
      throw new ConflictException('El checkout anterior tiene resultado incierto. La administración debe conciliarlo antes de iniciar otro.');
    }

    // Un segundo "Pagar" (otra pestaña, un doble click) vuelve al checkout que
    // ya está abierto: dos preferencias por el mismo saldo son dos cobros posibles.
    const abierto = await this.pagos.pendienteDeMercadoPago(destino);
    if (abierto && aCentavos(abierto.monto) === aCentavos(saldo)) {
      const preferencia = await this.mercadoPago.obtenerPreferencia(abierto.mpPreferenceId!);
      return { pagoId: abierto.id, initPoint: preferencia.initPoint };
    }
    // Si el saldo cambió (entró un pago manual), ese checkout cobraría de más.
    if (abierto) {
      await this.pagos.actualizar(abierto.id, {
        estado: EstadoPago.RECHAZADO,
        mpStatusDetail: 'reemplazado_por_otro_saldo',
      });
    }

    const pago = await this.pagos.crear({
      ...destino,
      monto: saldo,
      medio: MedioPago.MERCADO_PAGO,
      estado: EstadoPago.PENDIENTE,
      registradoPorId: usuario.id,
    });

    try {
      const preferencia = await this.mercadoPago.crearPreferencia({
        titulo,
        monto: saldo,
        referencia: pago.id,
      });
      await this.pagos.actualizar(pago.id, { mpPreferenceId: preferencia.id });
      return { pagoId: pago.id, initPoint: preferencia.initPoint };
    } catch (error) {
      // Un timeout o un 5xx no prueba que el proveedor no haya creado el checkout.
      const respuesta = error instanceof HttpException ? error.getResponse() : null;
      const status = respuesta && typeof respuesta === 'object' ? (respuesta as { proveedorStatus?: number }).proveedorStatus : undefined;
      const rechazado = status !== undefined && status >= 400 && status < 500;
      await this.pagos.actualizar(pago.id, {
        estado: rechazado ? EstadoPago.RECHAZADO : EstadoPago.PENDIENTE,
        mpStatusDetail: rechazado ? 'preferencia_no_creada' : 'preferencia_incierta',
      });
      throw error;
    }
  }

  /**
   * Webhook de Mercado Pago. Del aviso sólo se usa el id: el estado real se
   * le pide a la API, porque el cuerpo lo puede mandar cualquiera. Es
   * idempotente: Mercado Pago reintenta, y reprocesar deja todo igual.
   */
  async procesarWebhook(aviso: {
    tipo?: string;
    dataId?: string;
    firma?: string;
    requestId?: string;
  }): Promise<void> {
    if (!aviso.dataId || !this.mercadoPago.firmaValida(aviso.firma, aviso.requestId, aviso.dataId)) {
      throw new UnauthorizedException('Firma de Mercado Pago inválida');
    }
    // Avisa también de otras cosas (merchant_order, etc.) que no usamos.
    if (aviso.tipo !== 'payment') return;

    const mp = await this.mercadoPago.obtenerPago(aviso.dataId);
    const pago = mp.external_reference ? await this.pagos.findById(mp.external_reference) : null;
    if (!pago) {
      this.logger.warn(`Pago de MP ${mp.id} sin pago nuestro (ref ${mp.external_reference})`);
      return;
    }
    await this.aplicarMercadoPago(pago, mp);
  }

  /**
   * Lo que hace el vecino al volver del checkout: le pregunta a Mercado Pago
   * cómo quedó su pago, sin esperar al webhook (que puede tardar, o no llegar
   * nunca en local sin un túnel). Aplica lo mismo que el webhook, así que da
   * igual cuál de los dos llegue primero.
   */
  async sincronizar(usuario: UsuarioActual, id: string): Promise<Pago> {
    const pago = await this.findOne(usuario, id);
    if (pago.medio !== MedioPago.MERCADO_PAGO || pago.estado !== EstadoPago.PENDIENTE) {
      return pago;
    }
    const mp = await this.mercadoPago.ultimoIntento(pago.id);
    if (mp) await this.aplicarMercadoPago(pago, mp);
    return this.findOne(usuario, id);
  }

  /** Lleva el pago al estado que dice Mercado Pago. Idempotente. */
  private async aplicarMercadoPago(pago: Pago, mp: PagoMercadoPago): Promise<void> {
    // Una preferencia admite varios intentos (uno rechazado, después otro
    // aprobado). Un aviso tardío de otro intento no pisa un pago ya aprobado.
    const mpPaymentId = String(mp.id);
    if (pago.mpPaymentId && pago.mpPaymentId !== mpPaymentId && pago.estado === EstadoPago.APROBADO) {
      this.logger.warn(`Pago ${pago.id} ya aprobado con ${pago.mpPaymentId}: ignoro el intento ${mpPaymentId}`);
      // Si ese otro intento también se cobró, la plata entró dos veces.
      if (estadoSegunMercadoPago(mp.status) === EstadoPago.APROBADO) {
        await this.avisarCobroDeMas(pago, mp.transaction_amount, `operación ${mpPaymentId}`);
      }
      return;
    }

    const estadoAnterior = pago.estado;
    const datos = {
      estado: estadoSegunMercadoPago(mp.status),
      mpPaymentId,
      mpStatusDetail: mp.status_detail,
      // Con qué pagó, para el comprobante ("Visa ···· 4417").
      mpMedioPago: mp.payment_method_id ?? null,
      mpUltimosDigitos: ultimosDigitos(mp.card?.last_four_digits),
      monto: mp.transaction_amount,
      fechaPago: mp.date_approved ? new Date(mp.date_approved) : null,
    };
    if (datos.estado === estadoAnterior) {
      await this.pagos.actualizar(pago.id, datos, (contexto) => this.efectosPago(contexto));
      return;
    }
    // Sólo si nadie lo movió desde que se leyó: el webhook y el "sincronizar"
    // del vecino pueden llegar juntos, y el recibo y el aviso salen una vez.
    const actualizado = await this.pagos.actualizarSiEstado(pago.id, estadoAnterior, datos, (contexto) => this.efectosPago(contexto));
    if (!actualizado) return;
    // Un reintegro baja lo pagado: la boleta vuelve atrás. Una seña reintegrada
    // vuelve sola a "pendiente", porque se calcula desde los pagos aprobados.
  }

  /**
   * A qué se le cobra y cuánto falta: la boleta de expensas (sólo la última
   * emitida de la unidad) o la seña de una reserva. Va uno de los dos.
   */
  private async cobrable(usuario: UsuarioActual, dto: DestinoPagoDto) {
    if (!!dto.boletaId === !!dto.reservaId) {
      throw new BadRequestException('Indicá la boleta o la reserva que se paga, una sola');
    }
    if (dto.boletaId) {
      const { boleta, saldo } = await this.estadoCuenta.boletaPagable(usuario, dto.boletaId);
      return {
        destino: {
          concepto: ConceptoPago.EXPENSA,
          boletaId: boleta.id,
          reservaId: null,
          unidadId: boleta.unidadId,
        },
        saldo,
        titulo: `Expensas ${boleta.liquidacion.periodo.slice(0, 7)} · ${boleta.unidad.etiqueta}`,
      };
    }
    const { reserva, saldo } = await this.reservas.senaPagable(usuario, dto.reservaId!);
    return {
      destino: {
        concepto: ConceptoPago.SENA_RESERVA,
        boletaId: null,
        reservaId: reserva.id,
        unidadId: reserva.unidadId,
      },
      saldo,
      titulo: `Seña ${reserva.amenity.nombre} · ${reserva.unidad.etiqueta}`,
    };
  }

  /** Reglas puras; el repository aplica el plan y el outbox en su transacción. */
  private efectosPago(c: ContextoPago) {
    const { pago, boleta, reserva } = c;
    const eventos: EventoDomus[] = [];
    const estado = boleta ? estadoBoleta(boleta.total, c.totalAprobado, boleta.liquidacion.fechaVencimiento, c.hoy) : undefined;
    if (c.primeraAprobacion) {
      const destinos = boleta ? c.vecinos : [reserva!.solicitadaPorId];
      for (const destinatarioId of destinos) eventos.push(crearAviso({ destinatarioId,
        asunto: boleta ? 'Recibimos tu pago' : `Recibimos la seña de ${reserva!.amenity.nombre}`,
        cuerpo: `Registramos un pago de $${pago.monto.toFixed(2)} (recibo ${pago.reciboNumero}).` + (boleta ? ` Tu boleta quedó ${estado}.` : ''),
        origen: boleta ? `pago:${pago.id}` : `reserva:${reserva!.id}`,
      }));
      const sobra = c.totalAprobado - (boleta?.total ?? reserva!.amenity.montoSena);
      if (aCentavos(sobra) > 0) eventos.push(crearAviso({ destinatarioId: c.administradorId,
        asunto: `Cobro duplicado en ${boleta ? 'la unidad ' + boleta.unidad.etiqueta : 'la seña de ' + reserva!.unidad.etiqueta}`,
        cuerpo: `Se cobraron $${sobra.toFixed(2)} de más. Conciliá el cobro y devolvé la diferencia desde Mercado Pago.`,
        origen: `cobro-duplicado:${boleta?.id ?? reserva!.id}`,
      }));
    }
    return { eventos, estadoBoleta: estado };
  }

  /** Sin nueva mutación del pago: exige un pendiente durable antes de confirmar el webhook. */
  private async avisarAlAdministrador(
    consorcioId: string,
    asunto: string,
    cuerpo: string,
    origen: string,
  ): Promise<void> {
    this.logger.warn(`${asunto}: ${cuerpo}`);
    const consorcio = await this.consorcios.findOne(consorcioId);
    await this.notificador.enviar({ destinatarioId: consorcio.administradorId, asunto, cuerpo, origen });
  }

  /**
   * Le avisa al administrador que un pago (de una boleta o de una seña) entró
   * de más y tiene que devolver la diferencia: la plata ya se cobró.
   */
  private async avisarCobroDeMas(pago: Pago, monto: number, referencia: string): Promise<void> {
    const devolver = `Devolvé la diferencia desde Mercado Pago.`;
    if (pago.boletaId) {
      const boleta = await this.estadoCuenta.findBoletaInterna(pago.boletaId);
      return await this.avisarAlAdministrador(
        boleta.liquidacion.consorcioId,
        `Cobro duplicado en la unidad ${boleta.unidad.etiqueta}`,
        `La boleta de ${boleta.liquidacion.periodo.slice(0, 7)} se cobró $${monto.toFixed(2)} de más (${referencia}). ${devolver}`,
        `cobro-duplicado:${boleta.id}`,
      );
    }
    const reserva = await this.reservas.findInterna(pago.reservaId!);
    await this.avisarAlAdministrador(
      reserva.amenity.consorcioId,
      `Cobro duplicado en la seña de ${reserva.unidad.etiqueta}`,
      `La seña de ${reserva.amenity.nombre} se cobró $${monto.toFixed(2)} de más (${referencia}). ${devolver}`,
      `cobro-duplicado:${reserva.id}`,
    );
  }

}
