import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Notificador } from '../../core/notificaciones/notificador';
import { ConceptoPago, EstadoPago, Pago } from '../../database/entities';
import type { UsuarioActual } from '../auth/auth.types';
import { ExpensasService } from '../expensas/expensas.service';
import { aCentavos } from '../expensas/prorrateo';
import { ListarPagosQuery } from './dto/listar-pagos.query';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { PagosRepository } from './pagos.repository';

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
    private readonly notificador: Notificador,
  ) {}

  async listar(usuario: UsuarioActual, query: ListarPagosQuery): Promise<Pago[]> {
    return this.pagos.listar(query, await this.expensas.unidadesVisibles(usuario));
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

  /** Mueve el estado de la boleta y avisa. El aviso nunca corta el pago. */
  private async alAprobarse(pago: Pago): Promise<void> {
    const boleta = await this.expensas.sincronizarEstado(pago.boletaId!);

    for (const destinatarioId of await this.expensas.vecinosDe(pago.unidadId)) {
      try {
        await this.notificador.enviar({
          destinatarioId,
          asunto: 'Recibimos tu pago',
          cuerpo: `Registramos un pago de $${pago.monto.toFixed(2)}. Tu boleta quedó ${boleta.estado}.`,
          origen: `pago:${pago.id}`,
        });
      } catch (error) {
        this.logger.warn(`No se pudo avisar a ${destinatarioId}: ${String(error)}`);
      }
    }
  }
}
