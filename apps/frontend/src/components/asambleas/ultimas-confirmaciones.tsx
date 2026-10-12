import { EstadoBadge } from '@/components/estado-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { haceCuanto } from '@/lib/formato';
import type { Asistencia } from '@/types/asamblea';

/**
 * Las últimas respuestas al "¿Asistís?" (pantalla 09): quién confirmó, por
 * qué unidad y qué dijo. Los poderes muestran a qué unidad se lo dieron.
 */
export function UltimasConfirmaciones({ confirmaciones }: { confirmaciones: Asistencia[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimas confirmaciones</CardTitle>
        <CardDescription>Lo que respondieron los vecinos o cargó la administración.</CardDescription>
      </CardHeader>
      <CardContent>
        {confirmaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no respondió nadie.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {confirmaciones.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{c.unidad?.etiqueta ?? '—'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {c.confirmadaPor ? `${c.confirmadaPor.nombre} ${c.confirmadaPor.apellido}` : 'Sin nombre'}
                  </p>
                  {c.confirmadaAt && <p className="text-xs text-muted-foreground">{haceCuanto(c.confirmadaAt)}</p>}
                </div>
                {c.estado === 'CON_PODER' && c.apoderadoUnidad ? (
                  <Badge>Con poder a {c.apoderadoUnidad.etiqueta}</Badge>
                ) : (
                  <EstadoBadge dominio="asistencia" estado={c.estado} />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
