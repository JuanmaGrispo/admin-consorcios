import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { pesos } from '@/lib/formato';
import type { Boleta } from '@/types/expensa';

/**
 * El detalle de la boleta (pantalla 11): los gastos agrupados por rubro y,
 * aparte, lo que no es gasto del mes (fondo de reserva, saldo anterior, mora,
 * ajuste). Los importes ya son la parte de esta unidad.
 */
export function DetalleBoleta({ boleta }: { boleta: Boleta }) {
  const porRubro = new Map<string, number>();
  const otros: { concepto: string; monto: number }[] = [];
  for (const linea of boleta.boletaDetalles) {
    if (linea.gasto) {
      const rubro = linea.gasto.rubro.nombre;
      porRubro.set(rubro, (porRubro.get(rubro) ?? 0) + linea.monto);
    } else {
      otros.push({ concepto: linea.concepto, monto: linea.monto });
    }
  }
  const rubros = [...porRubro.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle por rubro</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rubros.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rubros.map(([rubro, monto]) => (
              <Linea key={rubro} concepto={rubro} monto={monto} />
            ))}
          </ul>
        )}
        {otros.length > 0 && (
          <ul className="flex flex-col gap-2 border-t pt-4">
            {otros.map((o, i) => (
              <Linea key={i} concepto={o.concepto} monto={o.monto} />
            ))}
          </ul>
        )}
        <div className="flex items-baseline justify-between border-t pt-4">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold tabular-nums">{pesos(boleta.total)}</span>
        </div>
        {boleta.motivoAjuste && (
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-secondary-foreground">
            Ajuste de la administración: {boleta.motivoAjuste}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Linea({ concepto, monto }: { concepto: string; monto: number }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0 text-secondary-foreground">{concepto}</span>
      <span className="shrink-0 tabular-nums">{pesos(monto)}</span>
    </li>
  );
}
