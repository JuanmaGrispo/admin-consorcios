import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Notificador } from '../../core/notificaciones/notificador';
import { ConceptoPago, EstadoPago, MedioPago, Pago } from '../../database/entities';
import { consorciosGestionados, esGestor, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { ConsorciosService } from '../consorcios/consorcios.service';
import { ExpensasService } from '../expensas/expensas.service';
import { aCentavos } from '../expensas/prorrateo';
import { ListarPagosQuery } from './dto/listar-pagos.query';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { MercadoPagoClient } from './mercado-pago.client';
import { PagosRepository } from './pagos.repository';
import { formatearNumeroRecibo } from './recibo';
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
@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly pagos: PagosRepository,
    private readonly expensas: ExpensasService,
    private readonly consorcios: ConsorciosService,
    private readonly mercadoPago: MercadoPagoClient,
    private readonly notificador: Notificador,
  ) {}

  async listar(usuario: UsuarioActual, query: ListarPagosQuery): Promise<Pago[]> {
    return this.pagos.listar(
      query,
      esGestor(usuario)
        ? { consorcioIds: consorciosGestionados(usuario) }
        : { unidadIds: await this.expensas.unidadesVisibles(usuario) },
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
        : (await this.expensas.unidadesVisibles(usuario))!.includes(pago.unidadId));
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
    const buffer = await generarReciboPdf({
      pago,
      etiquetaUnidad: pago.unidad.etiqueta,
      periodo: pago.boleta?.liquidacion?.periodo ?? null,
      consorcio,
    });
    const numero = (pago.reciboNumero ?? pago.id).replace(/[^\w-]+/g, '');
    return { buffer, nombre: `recibo-${numero}.pdf` };
  }

  /** Transferencia, efectivo u otro medio que el administrador ya verificó. */
  async registrar(usuario: UsuarioActual, dto: RegistrarPagoDto): Promise<Pago> {
    const { boleta, saldo } = await this.expensas.boletaPagable(usuario, dto.boletaId);
    if (aCentavos(dto.monto) > aCentavos(saldo)) {
      throw new BadRequestException(`El monto supera el saldo de la boleta ($${saldo.toFixed(2)})`);
    }

    const pago = await this.pagos.crear({
      concepto: ConceptoPago.EXPENSA,
      boletaId: boleta.id,
      unidadId: boleta.unidadId,
      monto: dto.monto,
      medio: dto.medio,
      estado: EstadoPago.APROBADO,
      fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
      registradoPorId: usuario.id,
    });
    await this.alAprobarse(pago);
    return pago;
  }

  // ── Mercado Pago ───────────────────────────────────────────────────────────

  /**
   * Arranca un cobro online por el saldo de la boleta. El pago nace PENDIENTE
   * y su id viaja como `external_reference`: así el webhook sabe a qué pago
   * corresponde lo que confirma Mercado Pago.
   */
  async crearPreferencia(
    usuario: UsuarioActual,
    boletaId: string,
  ): Promise<{ pagoId: string; initPoint: string }> {
    const { boleta, saldo } = await this.expensas.boletaPagable(usuario, boletaId);
    const pago = await this.pagos.crear({
      concepto: ConceptoPago.EXPENSA,
      boletaId: boleta.id,
      unidadId: boleta.unidadId,
      monto: saldo,
      medio: MedioPago.MERCADO_PAGO,
      estado: EstadoPago.PENDIENTE,
      registradoPorId: usuario.id,
    });

    try {
      const preferencia = await this.mercadoPago.crearPreferencia({
        titulo: `Expensas ${boleta.liquidacion.periodo.slice(0, 7)} · ${boleta.unidad.etiqueta}`,
        monto: saldo,
        referencia: pago.id,
      });
      await this.pagos.actualizar(pago.id, { mpPreferenceId: preferencia.id });
      return { pagoId: pago.id, initPoint: preferencia.initPoint };
    } catch (error) {
      // Sin preferencia no hay forma de que ese pago se complete.
      await this.pagos.actualizar(pago.id, {
        estado: EstadoPago.RECHAZADO,
        mpStatusDetail: 'preferencia_no_creada',
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

    // Una preferencia admite varios intentos (uno rechazado, después otro
    // aprobado). Un aviso tardío de otro intento no pisa un pago ya aprobado.
    const mpPaymentId = String(mp.id);
    if (pago.mpPaymentId && pago.mpPaymentId !== mpPaymentId && pago.estado === EstadoPago.APROBADO) {
      this.logger.warn(`Pago ${pago.id} ya aprobado con ${pago.mpPaymentId}: ignoro el intento ${mpPaymentId}`);
      return;
    }

    const estadoAnterior = pago.estado;
    const actualizado = await this.pagos.actualizar(pago.id, {
      estado: estadoSegunMercadoPago(mp.status),
      mpPaymentId,
      mpStatusDetail: mp.status_detail,
      monto: mp.transaction_amount,
      fechaPago: mp.date_approved ? new Date(mp.date_approved) : null,
    });

    if (actualizado.estado === estadoAnterior) return;
    if (actualizado.estado === EstadoPago.APROBADO) await this.alAprobarse(actualizado);
    // Un reintegro baja lo pagado: la boleta vuelve atrás.
    else await this.expensas.sincronizarEstado(actualizado.boletaId!);
  }

  /**
   * Le da número de recibo, mueve el estado de la boleta y avisa. El aviso
   * nunca corta el pago.
   */
  private async alAprobarse(pago: Pago): Promise<void> {
    const conRecibo = await this.numerarRecibo(pago);
    const boleta = await this.expensas.sincronizarEstado(pago.boletaId!);

    for (const destinatarioId of await this.expensas.vecinosDe(pago.unidadId)) {
      try {
        await this.notificador.enviar({
          destinatarioId,
          asunto: 'Recibimos tu pago',
          cuerpo: `Registramos un pago de $${pago.monto.toFixed(2)} (recibo ${conRecibo.reciboNumero}). Tu boleta quedó ${boleta.estado}.`,
          origen: `pago:${pago.id}`,
        });
      } catch (error) {
        this.logger.warn(`No se pudo avisar a ${destinatarioId}: ${String(error)}`);
      }
    }
  }

  /**
   * Numera el recibo la primera vez que el pago queda aprobado. Si ya tiene
   * número, se conserva: el webhook de Mercado Pago reintenta, y un recibo que
   * cambia de número cada vez que llega un aviso no sirve como comprobante.
   */
  private async numerarRecibo(pago: Pago): Promise<Pago> {
    if (pago.reciboNumero) return pago;
    const correlativo = await this.pagos.siguienteCorrelativoRecibo();
    return this.pagos.actualizar(pago.id, {
      reciboNumero: formatearNumeroRecibo(correlativo),
    });
  }
}
