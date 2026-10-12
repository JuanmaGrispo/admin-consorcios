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
  /** Con la liquidación: el período y, si se rechazó, hasta cuándo sigue vigente la deuda. */
  boleta?: { id: string; liquidacion?: { periodo: string; fechaVencimiento: string } | null } | null;
  reservaId: string | null;
  unidadId: string;
  /** Con el consorcio: la dirección del comprobante sale de ahí. */
  unidad?: { id: string; etiqueta: string; consorcioId: string } | null;
  monto: number;
  medio: MedioPago;
  estado: EstadoPago;
  fechaPago: string | null;
  mpPaymentId: string | null;
  /** Por qué Mercado Pago lo rechazó ("cc_rejected_insufficient_amount"). */
  mpStatusDetail: string | null;
  /** Con qué se pagó por Mercado Pago: "visa", "master", "account_money"… */
  mpMedioPago: string | null;
  /** Los últimos 4 de la tarjeta, si se pagó con una. */
  mpUltimosDigitos: string | null;
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
