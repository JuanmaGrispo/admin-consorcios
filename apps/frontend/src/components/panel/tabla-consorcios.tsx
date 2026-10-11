'use client';

import { useRouter } from 'next/navigation';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { EstadoBadge } from '@/components/estado-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { domicilio, pesos, porcentaje } from '@/lib/formato';
import type { ConsorcioDelPanel } from '@/types/panel';

/**
 * "Mis consorcios" de la pantalla 01: la cobranza del período en cada
 * edificio. Una fila lleva a Cobranzas, parado en ese consorcio.
 */
export function TablaConsorcios({ consorcios }: { consorcios: ConsorcioDelPanel[] }) {
  const router = useRouter();
  const { consorcios: propios, cambiar } = useConsorcioActivo();

  function abrir(id: string) {
    if (propios.some((c) => c.id === id)) cambiar(id);
    router.push('/admin/cobranzas');
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted hover:bg-muted">
          <TableHead className="pl-5 text-xs tracking-wide text-muted-foreground uppercase">Consorcio</TableHead>
          <TableHead className="hidden text-right text-xs tracking-wide text-muted-foreground uppercase sm:table-cell">
            Unid.
          </TableHead>
          <TableHead className="hidden text-right text-xs tracking-wide text-muted-foreground uppercase md:table-cell">
            Emitido
          </TableHead>
          <TableHead className="hidden text-right text-xs tracking-wide text-muted-foreground uppercase md:table-cell">
            Cobrado
          </TableHead>
          <TableHead className="text-right text-xs tracking-wide text-muted-foreground uppercase">Morosidad</TableHead>
          <TableHead className="pr-5 text-xs tracking-wide text-muted-foreground uppercase">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {consorcios.map((c) => (
          <TableRow key={c.id} onClick={() => abrir(c.id)} className="cursor-pointer">
            <TableCell className="pl-5">
              <div className="font-medium">{domicilio(c.calle, c.numero) || c.nombre}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.barrio ?? c.nombre}</div>
            </TableCell>
            <TableCell className="hidden text-right text-secondary-foreground tabular-nums sm:table-cell">
              {c.unidades}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">
              {c.estado === 'SIN_EMITIR' ? '—' : pesos(c.emitido, { redondo: true })}
            </TableCell>
            <TableCell className="hidden text-right text-secondary-foreground tabular-nums md:table-cell">
              {c.estado === 'SIN_EMITIR' ? '—' : pesos(c.cobrado, { redondo: true })}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {c.estado === 'SIN_EMITIR' ? '—' : porcentaje(c.morosidad)}
            </TableCell>
            <TableCell className="pr-5">
              <EstadoBadge dominio="cobranza" estado={c.estado} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
