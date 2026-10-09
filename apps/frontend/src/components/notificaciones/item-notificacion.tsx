import { AlarmClock, Bell, CalendarDays, Landmark, Megaphone, Receipt, Vote, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { fechaDeInstante, haceCuanto } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Notificacion } from '@/types/notificacion';

/** A qué pantalla del vecino lleva cada aviso, según `entidadTipo`. */
export function destinoDe(n: Notificacion): string | null {
  switch (n.entidadTipo) {
    case 'reclamo':
      return n.entidadId ? `/vecino/reclamos/${n.entidadId}` : '/vecino/reclamos';
    case 'boleta':
      return n.entidadId ? `/vecino/expensas/${n.entidadId}` : '/vecino/expensas';
    case 'liquidacion':
    case 'pago':
      return '/vecino/expensas';
    case 'reserva':
      return '/vecino/reservas';
    case 'asamblea':
    case 'votacion':
      return '/vecino/asambleas';
    case 'novedad':
      return '/vecino/novedades';
    default:
      return null;
  }
}

const ICONOS: Record<string, LucideIcon> = {
  BOLETA: Receipt,
  VENCIMIENTO: AlarmClock,
  RECLAMO: Wrench,
  RESERVA: CalendarDays,
  ASAMBLEA: Landmark,
  NOVEDAD: Megaphone,
};

/** "Hace 2 días" la última semana; después, la fecha (como la pantalla 16). */
function cuandoLlego(valor: string): string {
  const dias = (Date.now() - new Date(valor).getTime()) / 86_400_000;
  if (dias >= 7) return fechaDeInstante(valor);
  const texto = haceCuanto(valor);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Un aviso del centro de notificaciones (pantalla 16, "Centro de
 * notificaciones"): los sin leer en azul suave, los leídos en blanco.
 */
export function ItemNotificacion({ notificacion: n, onAbrir }: { notificacion: Notificacion; onAbrir: () => void }) {
  const sinLeer = n.leidaAt === null;
  // Votaciones van con su propio ícono aunque el tipo sea ASAMBLEA.
  const icono = n.entidadTipo === 'votacion' ? Vote : (ICONOS[n.tipo] ?? Bell);
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
        sinLeer ? 'border-transparent bg-accent hover:border-primary/40' : 'bg-card hover:bg-muted',
      )}
    >
      {createElement(icono, {
        className: cn('mt-0.5 size-4 shrink-0', sinLeer ? 'text-primary' : 'text-muted-foreground'),
        'aria-hidden': true,
      })}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', sinLeer ? 'font-semibold' : 'font-medium')}>{n.titulo}</span>
        {n.cuerpo && <span className="mt-0.5 line-clamp-2 block text-xs text-secondary-foreground">{n.cuerpo}</span>}
        <span className="mt-1 block text-xs text-muted-foreground">{cuandoLlego(n.createdAt)}</span>
      </span>
      {sinLeer && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />}
    </button>
  );
}

export function ItemNotificacionEsqueleto() {
  return <Skeleton className="h-16 rounded-xl" />;
}
