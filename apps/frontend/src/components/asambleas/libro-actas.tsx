'use client';

import { FileText, Upload } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { fechaDeInstante, porcentaje } from '@/lib/formato';
import type { Asamblea } from '@/types/asamblea';
import { anioDe, estaCerrada, TIPOS } from './etiquetas';

interface LibroActasProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Todas las del consorcio: el libro se queda con las cerradas. */
  asambleas: Asamblea[];
}

/**
 * El libro de actas del consorcio (botón de la pantalla 06): las asambleas
 * cerradas por año, con su acta firmada o el aviso de que falta subirla.
 */
export function LibroActas({ abierto, onOpenChange, asambleas }: LibroActasProps) {
  const cerradas = asambleas
    .filter(estaCerrada)
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
  const firmadas = cerradas.filter((a) => a.actaUrl).length;

  const porAnio = new Map<number, Asamblea[]>();
  for (const a of cerradas) {
    const anio = anioDe(a.fechaHora);
    porAnio.set(anio, [...(porAnio.get(anio) ?? []), a]);
  }

  return (
    <Sheet open={abierto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Libro de actas</SheetTitle>
          <SheetDescription>
            {cerradas.length === 0
              ? 'Las actas aparecen acá cuando se cierra una asamblea y se sube la firmada.'
              : `${firmadas} ${firmadas === 1 ? 'acta firmada' : 'actas firmadas'}` +
                (cerradas.length > firmadas ? ` · ${cerradas.length - firmadas} sin subir` : '')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4">
          {[...porAnio.entries()].map(([anio, delAnio]) => (
            <section key={anio} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {anio} · {delAnio.length} {delAnio.length === 1 ? 'asamblea' : 'asambleas'}
              </h3>
              <ul className="flex flex-col divide-y rounded-lg border">
                {delAnio.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fechaDeInstante(a.fechaHora)} · {TIPOS[a.tipo]}
                        {a.quorumPorcentaje !== null && ` · quórum ${porcentaje(a.quorumPorcentaje)}`}
                      </p>
                    </div>
                    {a.actaUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={a.actaUrl} target="_blank" rel="noreferrer">
                          <FileText data-icon="inline-start" />
                          Ver acta
                        </a>
                      </Button>
                    ) : (
                      <Button asChild variant="ghost" size="sm" className="text-warning hover:text-warning">
                        <Link href={`/admin/asambleas/${a.id}`}>
                          <Upload data-icon="inline-start" />
                          Subir acta
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
