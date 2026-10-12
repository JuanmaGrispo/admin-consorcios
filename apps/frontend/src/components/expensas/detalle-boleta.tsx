import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { pesos, porcentaje } from '@/lib/formato';
import type { Boleta } from '@/types/expensa';

/** Las líneas que el backend agrega solas: se reconocen por el concepto. */
const SALDO_ANTERIOR = 'Saldo anterior impago';
const INTERESES_MORA = 'Intereses por mora';
const PREFIJO_AJUSTE = 'Ajuste: ';
/** Lo que otras unidades bonificaron o cargaron a mano: viaja sumado a las ordinarias. */
const PREFIJO_REDISTRIBUCION = 'Redistribución de ajustes';

interface LineaBoleta {
  concepto: string;
  monto: number;
}

/**
 * El detalle de la boleta (pantalla 11b): las ordinarias agrupadas por rubro
 * con su subtotal, después las extraordinarias y lo que no es gasto del mes
 * (fondo de reserva, saldo anterior, mora, ajuste). Los importes ya son la
 * parte de esta unidad.
 *
 * Saldo anterior, mora y ajuste salen de los campos de la boleta y no de sus
 * líneas: así figuran aunque sean $ 0 y no se cuentan dos veces.
 */
export function DetalleBoleta({ boleta }: { boleta: Boleta }) {
  const porRubro = new Map<string, number>();
  const redistribucion: LineaBoleta[] = [];
  const extraordinarias: LineaBoleta[] = [];
  const fondo: LineaBoleta[] = [];
  for (const linea of boleta.boletaDetalles) {
    if (linea.gasto?.naturaleza === 'ORDINARIO') {
      const rubro = linea.gasto.rubro.nombre;
      porRubro.set(rubro, (porRubro.get(rubro) ?? 0) + linea.monto);
    } else if (linea.gasto?.naturaleza === 'EXTRAORDINARIO') {
      extraordinarias.push({ concepto: `Expensas extraordinarias · ${linea.gasto.descripcion}`, monto: linea.monto });
    } else if (linea.gasto) {
      fondo.push({ concepto: `Fondo de reserva · ${linea.gasto.descripcion}`, monto: linea.monto });
    } else if (linea.concepto.startsWith(PREFIJO_REDISTRIBUCION)) {
      redistribucion.push({ concepto: linea.concepto, monto: linea.monto });
    } else if (
      linea.concepto !== SALDO_ANTERIOR &&
      linea.concepto !== INTERESES_MORA &&
      !linea.concepto.startsWith(PREFIJO_AJUSTE)
    ) {
      // El fondo de reserva por porcentaje ("Fondo de reserva (5%)").
      fondo.push({ concepto: linea.concepto, monto: linea.monto });
    }
  }
  const rubros = [...porRubro.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por rubro · coeficiente {porcentaje(boleta.coeficienteAplicado, 2)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(rubros.length > 0 || redistribucion.length > 0) && (
          <ul className="flex flex-col gap-2">
            {rubros.map(([rubro, monto]) => (
              <Linea key={rubro} concepto={rubro} monto={monto} />
            ))}
            {redistribucion.map((r, i) => (
              <Linea key={i} concepto={r.concepto} monto={r.monto} />
            ))}
          </ul>
        )}
        <ul className="flex flex-col gap-2 border-t pt-4">
          <Linea concepto="Subtotal expensas ordinarias" monto={boleta.importeOrdinarias} destacada />
          {extraordinarias.map((e, i) => (
            <Linea key={`e${i}`} concepto={e.concepto} monto={e.monto} />
          ))}
          {fondo.map((f, i) => (
            <Linea key={`f${i}`} concepto={f.concepto} monto={f.monto} />
          ))}
          <Linea concepto="Saldo anterior" monto={boleta.saldoAnterior} />
          <Linea concepto="Intereses por mora" monto={boleta.interesesMora} />
          {boleta.ajusteManual !== 0 && <Linea concepto="Ajuste de la administración" monto={boleta.ajusteManual} />}
        </ul>
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

function Linea({ concepto, monto, destacada }: LineaBoleta & { destacada?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className={destacada ? 'min-w-0 font-medium' : 'min-w-0 text-secondary-foreground'}>{concepto}</span>
      <span className={destacada ? 'shrink-0 font-medium tabular-nums' : 'shrink-0 tabular-nums'}>{pesos(monto)}</span>
    </li>
  );
}
