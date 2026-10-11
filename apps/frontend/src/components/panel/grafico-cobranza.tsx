import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { periodo as nombrePeriodo, pesos, porcentaje } from '@/lib/formato';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function mesCorto(periodo: string): string {
  return MESES_CORTOS[Number(periodo.slice(5, 7)) - 1] ?? periodo;
}

interface GraficoCobranzaProps {
  serie: { periodo: string; emitido: number; cobrado: number }[];
}

/**
 * "Cobranza últimos 6 meses" de la pantalla 01: por mes, lo emitido (azul
 * claro) y lo cobrado (azul Domus) lado a lado, sobre una sola escala. Debajo
 * de cada mes va el porcentaje cobrado, para que el dato no dependa del color;
 * el detalle en pesos está en el tooltip y en la tabla para lectores de pantalla.
 */
export function GraficoCobranza({ serie }: GraficoCobranzaProps) {
  const maximo = Math.max(...serie.map((s) => Math.max(s.emitido, s.cobrado)), 1);
  const alto = (monto: number) => `${Math.max((monto / maximo) * 100, monto > 0 ? 2 : 0)}%`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1-claro" />
          Emitido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1" />
          Cobrado
        </span>
      </div>

      <div className="grid h-44 grid-cols-6 items-end gap-2 border-b sm:gap-4" aria-hidden>
        {serie.map((s) => (
          <Tooltip key={s.periodo}>
            <TooltipTrigger asChild>
              {/* El área de hover es toda la columna del mes, más grande que las barras. */}
              <div className="flex h-full items-end justify-center gap-0.5 rounded-t-sm hover:bg-muted">
                <span className="w-full max-w-5 rounded-t-sm bg-chart-1-claro" style={{ height: alto(s.emitido) }} />
                <span className="w-full max-w-5 rounded-t-sm bg-chart-1" style={{ height: alto(s.cobrado) }} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{nombrePeriodo(s.periodo)}</p>
              <p className="tabular-nums">Emitido {pesos(s.emitido, { redondo: true })}</p>
              <p className="tabular-nums">Cobrado {pesos(s.cobrado, { redondo: true })}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-2 text-center sm:gap-4" aria-hidden>
        {serie.map((s) => (
          <div key={s.periodo} className="leading-tight">
            <div className="text-xs text-muted-foreground">{mesCorto(s.periodo)}</div>
            <div className="text-xs font-medium text-secondary-foreground tabular-nums">
              {s.emitido > 0 ? porcentaje((s.cobrado / s.emitido) * 100, 0) : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* El gráfico está oculto para lectores de pantalla: leen esta tabla. */}
      <div className="sr-only">
        <Table>
          <TableCaption>Emitido y cobrado de los últimos {serie.length} meses</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Emitido</TableHead>
              <TableHead>Cobrado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {serie.map((s) => (
              <TableRow key={s.periodo}>
                <TableCell>{nombrePeriodo(s.periodo)}</TableCell>
                <TableCell>{pesos(s.emitido)}</TableCell>
                <TableCell>{pesos(s.cobrado)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
