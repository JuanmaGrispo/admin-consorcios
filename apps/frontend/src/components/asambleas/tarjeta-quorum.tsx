import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quórum</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums ${quorum.alcanzado ? 'text-success' : 'text-warning'}`}>
              {porcentaje(quorum.porcentaje)}
            </span>
            <span className="text-sm text-muted-foreground">de {porcentaje(quorum.requerido, 0)} requerido</span>
          </p>
          <Progress value={quorum.porcentaje} className="mt-2 h-2" />
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
