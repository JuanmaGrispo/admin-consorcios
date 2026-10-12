import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fechaDeInstante, hora, porcentaje } from '@/lib/formato';
import type { Asamblea } from '@/types/asamblea';
import { anioDe, estaCerrada } from './etiquetas';

/** Cuántas cerradas entran en el promedio de participación. */
const ULTIMAS = 5;

interface Kpi {
  etiqueta: string;
  valor: string;
  detalle: string;
}

/** "2026-09-12" del instante en Buenos Aires, para contar días de calendario. */
function dia(valor: string | Date): number {
  return Date.parse(
    new Date(valor).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
  );
}

/** "hoy", "mañana", "en 8 días" o "hace 2 días" (un borrador puede quedar vencido). */
function cuando(fechaHora: string): string {
  const dias = Math.round((dia(fechaHora) - dia(new Date())) / 86_400_000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias > 1) return `en ${dias} días`;
  return `hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
}

function kpisDe(asambleas: Asamblea[], anio: number | null): Kpi[] {
  // La próxima es la más cercana que todavía no cerró, en curso incluida.
  const proxima = asambleas
    .filter((a) => !estaCerrada(a))
    .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))[0];

  const cerradas = asambleas
    .filter(estaCerrada)
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
  const delAnio = anio === null ? cerradas : cerradas.filter((a) => anioDe(a.fechaHora) === anio);
  const firmadas = delAnio.filter((a) => a.actaUrl).length;

  const conQuorum = cerradas.filter((a) => a.quorumPorcentaje !== null).slice(0, ULTIMAS);
  const promedio = conQuorum.length
    ? conQuorum.reduce((suma, a) => suma + (a.quorumPorcentaje ?? 0), 0) / conQuorum.length
    : null;

  return [
    {
      etiqueta: 'Próxima asamblea',
      valor: proxima ? fechaDeInstante(proxima.fechaHora) : '—',
      detalle: !proxima
        ? 'No hay ninguna convocada'
        : proxima.estado === 'EN_CURSO'
          ? `En curso · ${hora(proxima.fechaHora)}`
          : `${cuando(proxima.fechaHora)} · ${hora(proxima.fechaHora)}${proxima.estado === 'BORRADOR' ? ' · borrador' : ''}`,
    },
    {
      etiqueta: 'Quórum confirmado',
      valor: proxima?.quorumPorcentaje != null ? porcentaje(proxima.quorumPorcentaje) : '—',
      detalle: !proxima
        ? 'Sin asamblea por delante'
        : proxima.quorumPorcentaje === null
          ? `Se mide al convocar · requiere ${porcentaje(proxima.quorumRequerido, 2)}`
          : `requiere ${porcentaje(proxima.quorumRequerido, 2)}`,
    },
    {
      etiqueta: 'Actas firmadas',
      valor: String(firmadas),
      detalle:
        delAnio.length === firmadas
          ? anio === null
            ? 'en el libro de actas'
            : `en el libro de actas ${anio}`
          : `de ${delAnio.length} cerradas · faltan ${delAnio.length - firmadas}`,
    },
    {
      etiqueta: 'Participación promedio',
      valor: promedio === null ? '—' : porcentaje(promedio),
      detalle:
        conQuorum.length === 0
          ? 'Todavía no cerró ninguna'
          : conQuorum.length === 1
            ? 'la última asamblea'
            : `últimas ${conQuorum.length} asambleas`,
    },
  ];
}

/**
 * El resumen arriba del listado (pantalla 06): la próxima asamblea con su
 * quórum, las actas firmadas del año y la participación de las últimas.
 * Todo sale del listado, sin pedir nada más.
 */
export function KpisAsambleas({ asambleas, anio }: { asambleas: Asamblea[] | null; anio: number | null }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Resumen de asambleas">
      {asambleas
        ? kpisDe(asambleas, anio).map((kpi) => (
            <Card key={kpi.etiqueta}>
              <CardHeader>
                <CardDescription className="text-xs font-medium tracking-wide uppercase">{kpi.etiqueta}</CardDescription>
                <CardTitle className="text-xl font-bold tabular-nums sm:text-2xl">{kpi.valor}</CardTitle>
                <p className="text-xs text-muted-foreground">{kpi.detalle}</p>
              </CardHeader>
            </Card>
          ))
        : Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardHeader className="gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-32" />
              </CardHeader>
            </Card>
          ))}
    </section>
  );
}
