import { FileText, Paperclip, Pin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fechaDeInstante } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { AdjuntoNovedad, Novedad } from '@/types/novedad';

/**
 * Una novedad del muro como la ve el vecino (pantalla 16 del prototipo). La
 * fijada lleva borde azul y una franja "Fijado" arriba; las imágenes se ven
 * en el cuerpo y los PDF van como una fila para abrirlos.
 */
export function NovedadCard({ novedad }: { novedad: Novedad }) {
  const imagenes = novedad.novedadAdjuntos.filter((a) => a.tipo === 'IMAGEN');
  const archivos = novedad.novedadAdjuntos.filter((a) => a.tipo !== 'IMAGEN');

  return (
    <Card className={cn('gap-0 py-0', novedad.fijada && 'ring-primary')}>
      {novedad.fijada && (
        <div className="flex items-center gap-1.5 bg-accent px-4 py-2 text-xs font-semibold tracking-wider text-primary uppercase">
          <Pin className="size-3.5" />
          Fijado
        </div>
      )}
      <CardContent className="flex flex-col py-4">
        <p className="text-xs text-muted-foreground tabular-nums">
          {novedad.publicadaAt && fechaDeInstante(novedad.publicadaAt)} · Administración
        </p>
        <h2 className="mt-1.5 leading-snug font-semibold">{novedad.titulo}</h2>
        <p className="mt-1.5 text-sm/relaxed whitespace-pre-line text-secondary-foreground">
          {novedad.cuerpo}
        </p>

        {imagenes.map((a) => (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="mt-3 block">
            {/* Viene del storage con cualquier tamaño: next/image pediría configurar el dominio. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.nombre ?? `Imagen de “${novedad.titulo}”`}
              className="max-h-72 w-full rounded-lg border object-cover"
            />
          </a>
        ))}

        {archivos.map((a) => (
          <Archivo key={a.id} adjunto={a} />
        ))}
      </CardContent>
    </Card>
  );
}

/** Un PDF u otro archivo: fila gris con su ícono, que lo abre en otra pestaña. */
function Archivo({ adjunto }: { adjunto: AdjuntoNovedad }) {
  const Icono = adjunto.tipo === 'PDF' ? FileText : Paperclip;
  return (
    <a
      href={adjunto.url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-secondary-foreground hover:text-primary"
    >
      <Icono className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{adjunto.nombre ?? 'Adjunto'}</span>
    </a>
  );
}

/** El muro mientras carga. */
export function NovedadCardEsqueleto() {
  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-2 py-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </CardContent>
    </Card>
  );
}
