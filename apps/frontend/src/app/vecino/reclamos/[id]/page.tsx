'use client';

import { CircleCheck, Truck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { IconoCatalogo } from '@/components/catalogos/icono-catalogo';
import { EstadoBadge } from '@/components/estado-badge';
import { PageHeader } from '@/components/page-header';
import { FotosAdjuntas } from '@/components/reclamos/fotos-adjuntas';
import { LineaDeTiempo } from '@/components/reclamos/linea-de-tiempo';
import { ResponderReclamo } from '@/components/reclamos/responder-reclamo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { fecha, fechaDeInstante } from '@/lib/formato';
import { reclamosService } from '@/services/reclamos';

/**
 * El seguimiento de un reclamo del vecino (pantalla 13 · seguimiento): el
 * mismo contenido que el panel de detalle del administrador, sin las notas
 * internas ni las acciones de gestión.
 */
export default function VecinoReclamosDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { datos: reclamo, error, recargar } = usePedido(
    `reclamo:${id}`,
    () => reclamosService.detalle(id),
    'No se pudo cargar el reclamo.',
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader titulo="Reclamo" volverA="/vecino/reclamos" />
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!reclamo) return <EsqueletoDetalle />;

  const resuelto = reclamo.estado === 'RESUELTO';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo={reclamo.categoria?.nombre ?? 'Reclamo'}
        contexto={`${reclamo.codigo} · ${reclamo.unidad.etiqueta}`}
        volverA="/vecino/reclamos"
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconoCatalogo nombre={reclamo.categoria?.icono} />
              {reclamo.categoria?.nombre}
            </span>
            <EstadoBadge dominio="reclamo" estado={reclamo.estado} />
          </div>
          <p className="text-sm whitespace-pre-line">{reclamo.descripcion}</p>
          <p className="text-xs text-muted-foreground">
            Abierto el {fechaDeInstante(reclamo.createdAt)}
            {resuelto && reclamo.cerradoAt && ` · cerrado el ${fecha(reclamo.cerradoAt)}`}
          </p>
          {reclamo.proveedor && (
            <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-secondary-foreground">
              <Truck className="size-4 shrink-0 text-muted-foreground" />
              Lo atiende {reclamo.proveedor.razonSocial}
            </p>
          )}
          <FotosAdjuntas adjuntos={reclamo.reclamoAdjuntos} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <LineaDeTiempo reclamo={reclamo} />
        </CardContent>
      </Card>

      {resuelto ? (
        <Alert>
          <CircleCheck />
          <AlertDescription>
            Este reclamo está resuelto. Si el problema vuelve, abrí un reclamo nuevo.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <ResponderReclamo reclamoId={reclamo.id} onEnviado={recargar} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EsqueletoDetalle() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-7 w-40" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
