'use client';

import { Check, ChevronDown, RotateCcw, Truck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { EstadoBadge } from '@/components/estado-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { fechaDeInstante } from '@/lib/formato';
import { reclamosService } from '@/services/reclamos';
import type { EstadoReclamo } from '@/types/reclamo';
import { DialogoAsignarProveedor } from './dialogo-asignar-proveedor';
import { DialogoCambiarEstado } from './dialogo-cambiar-estado';
import { FotosAdjuntas } from './fotos-adjuntas';
import { LineaDeTiempo } from './linea-de-tiempo';
import { ResponderReclamo } from './responder-reclamo';

const PRIORIDAD: Record<string, string> = { ALTA: 'alta', MEDIA: 'media', BAJA: 'baja' };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

interface DetalleReclamoAdminProps {
  reclamoId: string;
  /** Algo cambió (estado, proveedor, un mensaje): la bandeja se tiene que refrescar. */
  onCambio: () => void;
}

/**
 * El panel lateral de la bandeja (pantalla 04): fotos, línea de tiempo,
 * respuesta al vecino y las acciones de gestión. Se usa al costado del
 * tablero en desktop y dentro de un Sheet en pantallas chicas.
 */
export function DetalleReclamoAdmin({ reclamoId, onCambio }: DetalleReclamoAdminProps) {
  const { datos: reclamo, error, recargar } = usePedido(
    `reclamo:${reclamoId}`,
    () => reclamosService.detalle(reclamoId),
    'No se pudo cargar el reclamo.',
  );
  const [asignando, setAsignando] = useState(false);
  const [destino, setDestino] = useState<EstadoReclamo | null>(null);

  function actualizado() {
    recargar();
    onCambio();
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!reclamo) return <EsqueletoDetalle />;

  const resuelto = reclamo.estado === 'RESUELTO';
  const autor = `${reclamo.creadoPor.nombre} ${reclamo.creadoPor.apellido}`;
  // Los estados a los que se puede mover a mano, además de "resuelto", que tiene su botón.
  const otrosEstados = (['NUEVO', 'EN_CURSO', 'ESPERANDO_PROVEEDOR'] as const).filter(
    (e) => e !== reclamo.estado && (e !== 'ESPERANDO_PROVEEDOR' || reclamo.proveedorId),
  );
  const etiquetaEstado: Record<(typeof otrosEstados)[number], string> = {
    NUEVO: 'Volver a nuevo',
    EN_CURSO: 'Pasar a en curso',
    ESPERANDO_PROVEEDOR: 'Esperando proveedor',
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold">
            {reclamo.codigo} · {reclamo.unidad.etiqueta}
          </span>
          <EstadoBadge dominio="reclamo" estado={reclamo.estado} />
        </div>
        <h2 className="text-base font-semibold whitespace-pre-line">{reclamo.descripcion}</h2>
        <p className="text-xs text-muted-foreground">
          {autor} · abierto el {fechaDeInstante(reclamo.createdAt)} · prioridad {PRIORIDAD[reclamo.prioridad]}
          {reclamo.categoria && ` · ${reclamo.categoria.nombre}`}
        </p>
        {reclamo.proveedor && (
          <p className="mt-1 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-secondary-foreground">
            <Truck className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              {reclamo.proveedor.razonSocial}
              {reclamo.proveedor.telefono && (
                <span className="text-muted-foreground"> · {reclamo.proveedor.telefono}</span>
              )}
            </span>
          </p>
        )}
      </header>

      {reclamo.reclamoAdjuntos.length > 0 && (
        <Seccion titulo="Fotos adjuntas">
          <FotosAdjuntas adjuntos={reclamo.reclamoAdjuntos} />
        </Seccion>
      )}

      <Seccion titulo="Línea de tiempo">
        <LineaDeTiempo reclamo={reclamo} />
      </Seccion>

      <Separator />

      {resuelto ? (
        <p className="text-sm text-muted-foreground">
          El reclamo está resuelto. Para seguir la conversación, reabrilo.
        </p>
      ) : (
        <ResponderReclamo reclamoId={reclamo.id} administrador onEnviado={actualizado} />
      )}

      <div className="flex flex-wrap gap-2">
        {resuelto ? (
          <Button variant="outline" onClick={() => setDestino('EN_CURSO')}>
            <RotateCcw />
            Reabrir
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setAsignando(true)}>
              <UserPlus />
              {reclamo.proveedorId ? 'Reasignar' : 'Asignar proveedor'}
            </Button>
            {otrosEstados.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Estado
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {otrosEstados.map((e) => (
                    <DropdownMenuItem key={e} onSelect={() => setDestino(e)}>
                      {etiquetaEstado[e]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button className="sm:ml-auto" onClick={() => setDestino('RESUELTO')}>
              <Check />
              Marcar resuelto
            </Button>
          </>
        )}
      </div>

      <DialogoAsignarProveedor
        key={`${reclamo.id}:${reclamo.proveedorId}`}
        reclamo={reclamo}
        abierto={asignando}
        onAbiertoChange={setAsignando}
        onAsignado={actualizado}
      />
      <DialogoCambiarEstado
        reclamo={reclamo}
        destino={destino}
        onCerrar={() => setDestino(null)}
        onCambiado={actualizado}
      />
    </div>
  );
}

function EsqueletoDetalle() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-3 w-56" />
      <div className="flex gap-2">
        <Skeleton className="size-20 rounded-lg" />
        <Skeleton className="size-20 rounded-lg" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
