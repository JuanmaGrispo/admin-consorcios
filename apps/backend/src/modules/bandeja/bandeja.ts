import { fechaLegible, instanteLegible, mesLegible } from '../../core/formato';
import type { EventoDomus } from '../../core/mensajeria/eventos';
import { TipoNotificacion } from '../../database/entities';

/** Lo que se guarda en la bandeja de cada destinatario por un evento. */
export interface AvisoDeBandeja {
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string | null;
  /** A qué pantalla lleva el aviso: `boleta`, `reclamo`, `asamblea`… */
  entidadTipo: string | null;
  entidadId: string | null;
}

const TIPO_POR_ORIGEN: Record<string, TipoNotificacion> = {
  boleta: TipoNotificacion.VENCIMIENTO,
  'cobro-duplicado': TipoNotificacion.BOLETA,
  pago: TipoNotificacion.BOLETA,
  reclamo: TipoNotificacion.RECLAMO,
  reserva: TipoNotificacion.RESERVA,
  votacion: TipoNotificacion.ASAMBLEA,
};

/** `entidad_id` es uuid en la base: otro id haría fallar el INSERT y el evento iría a la DLQ. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESULTADOS: Record<string, string> = {
  aprobada: 'se aprobó',
  rechazada: 'se rechazó',
  sin_quorum: 'no alcanzó el quórum',
};

/** El aviso in-app de un evento. Función pura, como las plantillas de mail. */
export function avisoDeBandeja(evento: EventoDomus): AvisoDeBandeja {
  switch (evento.tipo_evento) {
    case 'expensas.emitidas': {
      const p = evento.payload;
      return {
        tipo: TipoNotificacion.BOLETA,
        titulo: `Ya está disponible la boleta de ${mesLegible(p.periodo)}`,
        cuerpo: `Vence el ${fechaLegible(p.fecha_vencimiento)}.`,
        entidadTipo: 'liquidacion',
        entidadId: p.liquidacion_id,
      };
    }
    case 'asamblea.creada':
    case 'asamblea.recordatorio': {
      const p = evento.payload;
      const prefijo = evento.tipo_evento === 'asamblea.creada' ? 'Asamblea convocada' : 'Recordatorio';
      return {
        tipo: TipoNotificacion.ASAMBLEA,
        titulo: `${prefijo}: ${p.titulo}`,
        cuerpo: `El ${fechaLegible(p.fecha)} a las ${p.hora}${p.lugar ? ` en ${p.lugar}` : ''}.`,
        entidadTipo: 'asamblea',
        entidadId: p.asamblea_id,
      };
    }
    case 'votacion.nueva':
      return {
        tipo: TipoNotificacion.ASAMBLEA,
        titulo: `Nueva votación: ${evento.payload.titulo}`,
        cuerpo: `Cierra el ${instanteLegible(evento.payload.fecha_cierre)}.`,
        entidadTipo: 'votacion',
        entidadId: evento.payload.votacion_id,
      };
    case 'votacion.cerrada':
      return {
        tipo: TipoNotificacion.ASAMBLEA,
        titulo: `Resultado: ${evento.payload.titulo}`,
        cuerpo: `La votación ${RESULTADOS[evento.payload.resultado] ?? evento.payload.resultado}.`,
        entidadTipo: 'votacion',
        entidadId: evento.payload.votacion_id,
      };
    case 'reclamo.cerrado':
      return {
        tipo: TipoNotificacion.RECLAMO,
        titulo: `Tu reclamo ${evento.payload.codigo} está resuelto`,
        cuerpo: evento.payload.resolucion,
        entidadTipo: 'reclamo',
        entidadId: evento.payload.reclamo_id,
      };
    case 'novedad.publicada':
      return {
        tipo: TipoNotificacion.NOVEDAD,
        titulo: evento.payload.titulo,
        cuerpo: null,
        entidadTipo: 'novedad',
        entidadId: evento.payload.novedad_id,
      };
    case 'aviso.directo': {
      const p = evento.payload;
      const [prefijo, id] = p.origen.split(':');
      const conEntidad = !!id && UUID.test(id);
      return {
        tipo: TIPO_POR_ORIGEN[prefijo] ?? TipoNotificacion.NOVEDAD,
        titulo: p.asunto,
        cuerpo: p.cuerpo,
        entidadTipo: conEntidad ? prefijo : null,
        entidadId: conEntidad ? id : null,
      };
    }
  }
}
