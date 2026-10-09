export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REINTEGRADO';
export type MedioPago = 'MERCADO_PAGO' | 'TRANSFERENCIA' | 'EFECTIVO' | 'OTRO';
/** Mercado Pago entra sólo por su flujo: a mano se registran los demás. */
export type MedioManual = Exclude<MedioPago, 'MERCADO_PAGO'>;
export type ConceptoPago = 'EXPENSA' | 'SENA_RESERVA';

/** GET /pagos y GET /pagos/:id. */
export interface Pago {
  id: string;
  concepto: ConceptoPago;
  boletaId: string | null;
  boleta?: { id: string; liquidacion?: { periodo: string } | null } | null;
  reservaId: string | null;
  unidadId: string;
  unidad?: { id: string; etiqueta: string } | null;
  monto: number;
  medio: MedioPago;
  estado: EstadoPago;
  fechaPago: string | null;
  mpPaymentId: string | null;
  /** Por qué Mercado Pago lo rechazó ("cc_rejected_insufficient_amount"). */
  mpStatusDetail: string | null;
  reciboNumero: string | null;
  createdAt: string;
}

/** POST /pagos: un pago que registra la administración. */
export interface PagoManualInput {
  boletaId: string;
  monto: number;
  medio: MedioManual;
  fechaPago?: string;
}
