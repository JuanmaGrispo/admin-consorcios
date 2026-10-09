import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fechaHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { EstadoReclamo, ReclamoDetalle, ReclamoEvento } from '@/types/reclamo';

const NOMBRE_ESTADO: Record<EstadoReclamo, string> = {
  NUEVO: 'Nuevo',
  EN_CURSO: 'En curso',
  ESPERANDO_PROVEEDOR: 'Esperando proveedor',
  RESUELTO: 'Resuelto',
};

/** El renglón principal de cada evento, como en el prototipo ("Asignado a Gasparini Servicios"). */
function titulo(evento: ReclamoEvento, reclamo: ReclamoDetalle, esElUltimoProveedor: boolean): string {
  const delVecino = evento.autorId === reclamo.creadoPorId;
  switch (evento.tipo) {
    case 'CREACION':
      return delVecino ? 'Reclamo creado por el vecino' : 'Reclamo creado por la administración';
    case 'ASIGNACION':
      // El evento no guarda a quién se asignó: el nombre sólo es seguro para la asignación vigente.
      return esElUltimoProveedor && reclamo.proveedor
        ? `Asignado a ${reclamo.proveedor.razonSocial}`
        : 'Proveedor asignado';
    case 'CAMBIO_ESTADO':
      if (evento.estadoNuevo === 'RESUELTO') return 'Marcado como resuelto';
      if (evento.estadoAnterior === 'RESUELTO') return 'Reclamo reabierto';
      return `Pasó a ${evento.estadoNuevo ? NOMBRE_ESTADO[evento.estadoNuevo] : 'otro estado'}`;
    case 'RESPUESTA':
      return delVecino ? 'Mensaje del vecino' : 'Respuesta de la administración';
    case 'NOTA_INTERNA':
      return 'Nota interna';
  }
}

interface LineaDeTiempoProps {
  reclamo: ReclamoDetalle;
}

/**
 * La historia del caso, la más nueva arriba. Al vecino el backend ya le
 * saca las notas internas; al administrador le llegan marcadas para que no
 * las confunda con lo que ve el vecino.
 */
export function LineaDeTiempo({ reclamo }: LineaDeTiempoProps) {
  const ultimaAsignacion = reclamo.eventos.find((e) => e.tipo === 'ASIGNACION')?.id;
  const fotos = reclamo.reclamoAdjuntos.length;

  return (
    <ol className="flex flex-col">
      {reclamo.eventos.map((evento, i) => {
        const ultimo = i === reclamo.eventos.length - 1;
        const interna = evento.tipo === 'NOTA_INTERNA';
        const autor = evento.autor ? `${evento.autor.nombre} ${evento.autor.apellido}` : null;
        const detalle =
          evento.tipo === 'CREACION' && fotos > 0
            ? `con ${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`
            : autor;

        return (
          <li key={evento.id} className="flex gap-3">
            <div className="flex flex-col items-center pt-1.5">
              <span
                className={cn('size-2 shrink-0 rounded-full', i === 0 ? 'bg-primary' : 'bg-border')}
              />
              {!ultimo && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className={cn('min-w-0 flex-1', !ultimo && 'pb-4')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{titulo(evento, reclamo, evento.id === ultimaAsignacion)}</span>
                {interna && (
                  <Badge variant="outline">
                    <Lock />
                    Sólo administración
                  </Badge>
                )}
              </div>
              {evento.mensaje && (
                <p
                  className={cn(
                    'mt-1 rounded-lg px-3 py-2 text-sm whitespace-pre-line text-secondary-foreground',
                    interna ? 'border border-dashed' : 'bg-muted',
                  )}
                >
                  {evento.mensaje}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {[fechaHora(evento.createdAt), detalle].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
