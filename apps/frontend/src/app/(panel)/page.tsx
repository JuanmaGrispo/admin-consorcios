'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { consorciosService } from '@/services/consorcios';
import type { Consorcio } from '@/types/consorcio';

function domicilio(c: Consorcio): string {
  const calle = [c.calle, c.numero].filter(Boolean).join(' ');
  return [calle, c.barrio, c.ciudad].filter(Boolean).join(' · ') || '—';
}

export default function ConsorciosPage() {
  const [consorcios, setConsorcios] = useState<Consorcio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consorciosService
      .list()
      .then(setConsorcios)
      .catch(() => setError('No se pudieron cargar los consorcios.'));
  }, []);

  const kpis = [
    { label: 'Consorcios', valor: consorcios?.length },
    { label: 'Activos', valor: consorcios?.filter((c) => c.activo).length },
    {
      label: 'Unidades totales',
      valor: consorcios?.reduce((sum, c) => sum + (c.cantidadUnidades ?? 0), 0),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Plataforma
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Consorcios</h1>
        </div>
        <Button asChild>
          <Link href="/consorcios/nuevo">
            <Plus />
            Nuevo consorcio
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                {kpi.label}
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {consorcios ? kpi.valor : <Skeleton className="h-8 w-12" />}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Consorcio</TableHead>
              <TableHead>Administrador</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="pr-5">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!consorcios &&
              !error &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-1.5 h-3 w-56" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-6" />
                  </TableCell>
                  <TableCell className="pr-5">
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}

            {consorcios?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-5">
                  <Link href={`/consorcios/${c.id}`} className="block">
                    <div className="font-medium">{c.nombre}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{domicilio(c)}</div>
                  </Link>
                </TableCell>
                <TableCell>
                  {c.administrador ? (
                    <>
                      <div className="text-secondary-foreground">
                        {c.administrador.nombre} {c.administrador.apellido}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {c.administrador.email}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.cantidadUnidades ?? 0}
                </TableCell>
                <TableCell className="pr-5">
                  {c.activo ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="destructive">Inactivo</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {consorcios && consorcios.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  Todavía no hay consorcios. Creá el primero con “Nuevo consorcio”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
