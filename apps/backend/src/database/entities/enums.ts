// GENERADO por `pnpm back db:generate-entities` — no editar a mano.
// Los valores salen de los tipos enum de Postgres.

export enum CanalNotificacion {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
}

export enum CategoriaNotificacion {
  BOLETAS = 'BOLETAS',
  VENCIMIENTOS = 'VENCIMIENTOS',
  RECLAMOS_RESERVAS = 'RECLAMOS_RESERVAS',
  COMUNICADOS = 'COMUNICADOS',
}

export enum ConceptoPago {
  EXPENSA = 'EXPENSA',
  SENA_RESERVA = 'SENA_RESERVA',
}

export enum CriterioDesempate {
  RECHAZADA = 'RECHAZADA',
  APROBADA = 'APROBADA',
}

export enum CriterioProrrateo {
  COEFICIENTE = 'COEFICIENTE',
  PARTES_IGUALES = 'PARTES_IGUALES',
}

export enum EstadoAsamblea {
  BORRADOR = 'BORRADOR',
  CONVOCADA = 'CONVOCADA',
  EN_CURSO = 'EN_CURSO',
  CERRADA = 'CERRADA',
  CERRADA_SIN_QUORUM = 'CERRADA_SIN_QUORUM',
}

export enum EstadoAsistencia {
  ASISTE = 'ASISTE',
  NO_ASISTE = 'NO_ASISTE',
  SIN_RESPONDER = 'SIN_RESPONDER',
  CON_PODER = 'CON_PODER',
}

export enum EstadoBoleta {
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL',
  PAGADA = 'PAGADA',
  VENCIDA = 'VENCIDA',
}

export enum EstadoEnvio {
  PENDIENTE = 'PENDIENTE',
  ENVIADO = 'ENVIADO',
  FALLIDO = 'FALLIDO',
}

export enum EstadoLiquidacion {
  BORRADOR = 'BORRADOR',
  PRORRATEO = 'PRORRATEO',
  PREVISUALIZACION = 'PREVISUALIZACION',
  EMITIDA = 'EMITIDA',
  CERRADA = 'CERRADA',
}

export enum EstadoPago {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  REINTEGRADO = 'REINTEGRADO',
}

export enum EstadoReclamo {
  NUEVO = 'NUEVO',
  EN_CURSO = 'EN_CURSO',
  ESPERANDO_PROVEEDOR = 'ESPERANDO_PROVEEDOR',
  RESUELTO = 'RESUELTO',
}

export enum EstadoReserva {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA',
  FINALIZADA = 'FINALIZADA',
}

export enum EstadoVotacion {
  BORRADOR = 'BORRADOR',
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA',
}

export enum FormaConteo {
  POR_COEFICIENTE = 'POR_COEFICIENTE',
  POR_UNIDAD = 'POR_UNIDAD',
}

export enum MayoriaRequerida {
  SIMPLE_PRESENTES = 'SIMPLE_PRESENTES',
  ABSOLUTA = 'ABSOLUTA',
  DOS_TERCIOS = 'DOS_TERCIOS',
}

export enum MedioPago {
  MERCADO_PAGO = 'MERCADO_PAGO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  EFECTIVO = 'EFECTIVO',
  OTRO = 'OTRO',
}

export enum ModalidadAsamblea {
  PRESENCIAL = 'PRESENCIAL',
  HIBRIDA = 'HIBRIDA',
  DIGITAL = 'DIGITAL',
}

export enum NaturalezaGasto {
  ORDINARIO = 'ORDINARIO',
  EXTRAORDINARIO = 'EXTRAORDINARIO',
  FONDO_RESERVA = 'FONDO_RESERVA',
}

export enum PadronVotacion {
  SOLO_PROPIETARIOS = 'SOLO_PROPIETARIOS',
  TODAS_LAS_UNIDADES = 'TODAS_LAS_UNIDADES',
}

export enum PeriodicidadMora {
  DIARIA = 'DIARIA',
  MENSUAL = 'MENSUAL',
}

export enum PrioridadReclamo {
  BAJA = 'BAJA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
}

export enum ResultadoVotacion {
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  SIN_QUORUM = 'SIN_QUORUM',
}

export enum RolUsuario {
  ADMINISTRADOR = 'ADMINISTRADOR',
  VECINO = 'VECINO',
}

export enum TipoAdjunto {
  IMAGEN = 'IMAGEN',
  PDF = 'PDF',
  OTRO = 'OTRO',
}

export enum TipoAsamblea {
  ORDINARIA = 'ORDINARIA',
  EXTRAORDINARIA = 'EXTRAORDINARIA',
}

export enum TipoEventoReclamo {
  CREACION = 'CREACION',
  ASIGNACION = 'ASIGNACION',
  CAMBIO_ESTADO = 'CAMBIO_ESTADO',
  RESPUESTA = 'RESPUESTA',
  NOTA_INTERNA = 'NOTA_INTERNA',
}

export enum TipoNotificacion {
  BOLETA = 'BOLETA',
  VENCIMIENTO = 'VENCIMIENTO',
  RECLAMO = 'RECLAMO',
  RESERVA = 'RESERVA',
  ASAMBLEA = 'ASAMBLEA',
  NOVEDAD = 'NOVEDAD',
}

export enum TipoPuntoOrden {
  INFORMATIVO = 'INFORMATIVO',
  CON_VOTACION = 'CON_VOTACION',
}

export enum TipoUnidad {
  DEPARTAMENTO = 'DEPARTAMENTO',
  LOCAL = 'LOCAL',
  COCHERA = 'COCHERA',
  BAULERA = 'BAULERA',
}

export enum VinculoUnidad {
  PROPIETARIO = 'PROPIETARIO',
  INQUILINO = 'INQUILINO',
}
