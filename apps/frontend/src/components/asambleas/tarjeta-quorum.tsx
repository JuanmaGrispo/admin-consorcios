import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { porcentaje } from '@/lib/formato';
import type { EstadoAsistencia, Quorum } from '@/types/asamblea';

const CONTEO: { estado: EstadoAsistencia; etiqueta: string }[] = [
  { estado: 'ASISTE', etiqueta: 'Asisten' },
  { estado: 'CON_PODER', etiqueta: 'Con poder' },
  { estado: 'NO_ASISTE', etiqueta: 'No asisten' },
  { estado: 'SIN_RESPONDER', etiqueta: 'Sin responder' },
];

/** El quórum en vivo: cuánto hay, cuánto falta y cuántas unidades respondieron cada cosa. */
export function TarjetaQuorum({ quorum }: { quorum: Quorum }) {
  const requerido = Math.min(quorum.requerido, 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quórum por coeficiente</CardTitle>
        <CardDescription>
          Se requiere {porcentaje(quorum.requerido, 2)} de los coeficientes para sesionar.
        </CardDescription>
        <CardAction>
          <Badge variant={quorum.alcanzado ? 'success' : 'warning'}>
            {quorum.alcanzado ? 'Quórum alcanzado' : 'Quórum no alcanzado'}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums ${quorum.alcanzado ? 'text-success' : 'text-warning'}`}>
              {porcentaje(quorum.porcentaje)}
            </span>
            <span className="text-sm text-muted-foreground">de {porcentaje(quorum.requerido, 2)} requerido</span>
          </p>
          {/* La barra con una marca donde está el requerido. */}
          <div className="relative mt-3">
            <Progress
              value={Math.min(quorum.porcentaje, 100)}
              aria-label="Quórum alcanzado"
              className={`h-2 ${quorum.alcanzado ? '[&>*]:bg-success' : '[&>*]:bg-warning'}`}
            />
            <span
              aria-hidden
              className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground"
              style={{ left: `${requerido}%` }}
            />
          </div>
          <div className="relative mt-1 h-4 text-xs text-muted-foreground tabular-nums">
            {/* Los extremos se callan si el requerido les queda encima. */}
            {requerido >= 15 && <span className="absolute left-0">0%</span>}
            <span
              className={`absolute whitespace-nowrap ${requerido > 80 ? '-translate-x-full' : requerido < 15 ? '' : '-translate-x-1/2'}`}
              style={{ left: `${requerido}%` }}
            >
              {porcentaje(quorum.requerido, 2)} requerido
            </span>
            {requerido <= 80 && <span className="absolute right-0">100%</span>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {quorum.alcanzado
              ? 'Hay quórum para sesionar.'
              : quorum.faltanUnidades === null
                ? `Faltan ${porcentaje(quorum.faltanPuntos)}: aunque respondan todos, no se llega.`
                : `Faltan ${porcentaje(quorum.faltanPuntos)}: con ${quorum.faltanUnidades} ${quorum.faltanUnidades === 1 ? 'unidad más' : 'unidades más'} se llega.`}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
          {CONTEO.map((c) => (
            <div key={c.estado}>
              <dt className="text-xs text-muted-foreground">{c.etiqueta}</dt>
              <dd className="text-lg font-semibold tabular-nums">{quorum.conteo[c.estado] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
