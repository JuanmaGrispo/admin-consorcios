import { Badge } from '@/components/ui/badge';

type Variante = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

interface Estilo {
  etiqueta: string;
  variante: Variante;
}

/**
 * Cómo se ve cada estado del backend, en un solo lugar. Las pantallas no
 * deciden colores: si un reclamo está "En curso", se ve igual en la bandeja
 * del administrador y en "Mis reclamos". Las claves son los enums del backend.
 */
const ESTADOS = {
  boleta: {
    PENDIENTE: { etiqueta: 'Pendiente', variante: 'warning' },
    PARCIAL: { etiqueta: 'Pago parcial', variante: 'warning' },
    PAGADA: { etiqueta: 'Pagado', variante: 'success' },
    VENCIDA: { etiqueta: 'Vencido', variante: 'destructive' },
  },
  liquidacion: {
    BORRADOR: { etiqueta: 'Borrador', variante: 'secondary' },
    PRORRATEO: { etiqueta: 'Prorrateo', variante: 'secondary' },
    PREVISUALIZACION: { etiqueta: 'Previsualización', variante: 'warning' },
    EMITIDA: { etiqueta: 'Emitida', variante: 'success' },
    CERRADA: { etiqueta: 'Cerrada', variante: 'outline' },
  },
  pago: {
    PENDIENTE: { etiqueta: 'Procesando', variante: 'warning' },
    APROBADO: { etiqueta: 'Aprobado', variante: 'success' },
    RECHAZADO: { etiqueta: 'Rechazado', variante: 'destructive' },
    REINTEGRADO: { etiqueta: 'Reintegrado', variante: 'secondary' },
  },
  reclamo: {
    NUEVO: { etiqueta: 'Nuevo', variante: 'default' },
    EN_CURSO: { etiqueta: 'En curso', variante: 'warning' },
    ESPERANDO_PROVEEDOR: { etiqueta: 'Esperando proveedor', variante: 'secondary' },
    RESUELTO: { etiqueta: 'Resuelto', variante: 'success' },
  },
  prioridad: {
    ALTA: { etiqueta: 'Alta', variante: 'destructive' },
    MEDIA: { etiqueta: 'Media', variante: 'warning' },
    BAJA: { etiqueta: 'Baja', variante: 'secondary' },
  },
  reserva: {
    PENDIENTE: { etiqueta: 'Esperando aprobación', variante: 'warning' },
    APROBADA: { etiqueta: 'Aprobada', variante: 'success' },
    RECHAZADA: { etiqueta: 'Rechazada', variante: 'destructive' },
    CANCELADA: { etiqueta: 'Cancelada', variante: 'secondary' },
    FINALIZADA: { etiqueta: 'Finalizada', variante: 'outline' },
  },
  asamblea: {
    BORRADOR: { etiqueta: 'Borrador', variante: 'secondary' },
    CONVOCADA: { etiqueta: 'Confirmando asistencia', variante: 'warning' },
    EN_CURSO: { etiqueta: 'En curso', variante: 'default' },
    CERRADA: { etiqueta: 'Cerrada', variante: 'success' },
    CERRADA_SIN_QUORUM: { etiqueta: 'Cerrada sin quórum', variante: 'destructive' },
  },
  votacion: {
    BORRADOR: { etiqueta: 'Borrador', variante: 'secondary' },
    ABIERTA: { etiqueta: 'Abierta', variante: 'success' },
    CERRADA: { etiqueta: 'Cerrada', variante: 'outline' },
  },
  resultado: {
    APROBADA: { etiqueta: 'Aprobada', variante: 'success' },
    RECHAZADA: { etiqueta: 'Rechazada', variante: 'destructive' },
    SIN_QUORUM: { etiqueta: 'Sin quórum', variante: 'warning' },
  },
  asistencia: {
    ASISTE: { etiqueta: 'Asiste', variante: 'success' },
    CON_PODER: { etiqueta: 'Con poder', variante: 'default' },
    NO_ASISTE: { etiqueta: 'No asiste', variante: 'destructive' },
    SIN_RESPONDER: { etiqueta: 'Sin responder', variante: 'secondary' },
  },
  /** El estado de cobranza de un consorcio en el panel general (GET /panel). */
  cobranza: {
    AL_DIA: { etiqueta: 'Al día', variante: 'success' },
    ATENCION: { etiqueta: 'Atención', variante: 'warning' },
    MOROSIDAD_ALTA: { etiqueta: 'Morosidad alta', variante: 'destructive' },
    SIN_EMITIR: { etiqueta: 'Sin emitir', variante: 'secondary' },
  },
} satisfies Record<string, Record<string, Estilo>>;

export type DominioEstado = keyof typeof ESTADOS;

interface EstadoBadgeProps<D extends DominioEstado> {
  dominio: D;
  estado: keyof (typeof ESTADOS)[D] & string;
  /** Para cambiar el texto sin cambiar el color: "Vencido · 32 días", "Por vencer". */
  children?: React.ReactNode;
}

export function EstadoBadge<D extends DominioEstado>({ dominio, estado, children }: EstadoBadgeProps<D>) {
  const estilo = (ESTADOS[dominio] as Record<string, Estilo>)[estado] ?? {
    etiqueta: estado,
    variante: 'outline' as const,
  };
  return <Badge variant={estilo.variante}>{children ?? estilo.etiqueta}</Badge>;
}
