import { FileText, Image as ImageIcon, Paperclip, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fechaDeInstante } from '@/lib/formato';
import type { AdjuntoNovedad, Novedad } from '@/types/novedad';

const ICONOS: Record<AdjuntoNovedad['tipo'], typeof FileText> = {
  PDF: FileText,
  IMAGEN: ImageIcon,
  OTRO: Paperclip,
};

interface NovedadCardProps {
  novedad: Novedad;
  /** Sin leer al entrar a la pantalla: se marca aunque ya se haya avisado que se leyó. */
  nueva?: boolean;
}

/** Una novedad del muro, como la ve el vecino (pantalla 16 del prototipo). */
export function NovedadCard({ novedad, nueva }: NovedadCardProps) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {novedad.fijada && (
            <span className="flex items-center gap-1 font-semibold text-primary">
              <Pin className="size-3.5" />
              Fijado
            </span>
          )}
          <span className="tabular-nums">
            {novedad.publicadaAt && fechaDeInstante(novedad.publicadaAt)} · Administración
          </span>
          {nueva && <Badge>Nueva</Badge>}
        </div>
        <CardTitle>{novedad.titulo}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm whitespace-pre-line text-secondary-foreground">{novedad.cuerpo}</p>
        {novedad.novedadAdjuntos.length > 0 && (
          <ul className="flex flex-col gap-1">
            {novedad.novedadAdjuntos.map((a) => {
              const Icono = ICONOS[a.tipo];
              return (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Icono className="size-4 shrink-0" />
                    <span className="truncate">{a.nombre ?? 'Adjunto'}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** El muro mientras carga. */
export function NovedadCardEsqueleto() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-3/4" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </CardContent>
    </Card>
  );
}
