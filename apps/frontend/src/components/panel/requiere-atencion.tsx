'use client';

import { ChevronRight, CircleAlert, Clock, Vote, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createElement } from 'react';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { Button } from '@/components/ui/button';
import { fecha, fechaDeInstante, haceCuanto, periodo, pesos, porcentaje } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Atencion } from '@/types/panel';

interface Renglon {
  icono: LucideIcon;
  /** Sólo tokens de estado: lo urgente en destructive, lo que apura en warning. */
  tono: string;
  titulo: string;
  detalle: string;
  /** A dónde lleva, ya parado en el consorcio del aviso. */
  href: string;
}

function renglonDe(a: Atencion): Renglon {
  switch (a.tipo) {
    case 'DEUDA_ANTIGUA':
      return {
        icono: CircleAlert,
        tono: 'bg-destructive/10 text-destructive',
        titulo: `${a.unidades} ${a.unidades === 1 ? 'unidad vencida' : 'unidades vencidas'} hace más de ${a.dias} días`,
        detalle: `${a.consorcio} · ${pesos(a.saldo, { redondo: true })}`,
        href: '/admin/cobranzas',
      };
    case 'LIQUIDACION_SIN_EMITIR':
      return {
        icono: Clock,
        tono: 'bg-warning/10 text-warning',
        titulo: `Liquidación de ${periodo(a.periodo).toLowerCase()} sin emitir`,
        detalle: a.fechaVencimiento
          ? `${a.consorcio} · vence el ${fecha(a.fechaVencimiento)}`
          : `${a.consorcio} · todavía no se abrió`,
        href: '/admin/liquidaciones',
      };
    case 'QUORUM_BAJO':
      return {
        icono: Vote,
        tono: 'bg-warning/10 text-warning',
        titulo: `Quórum al ${porcentaje(a.quorumPorcentaje, 0)} para la asamblea del ${fechaDeInstante(a.fecha).slice(0, 5)}`,
        detalle: `${a.consorcio} · requiere ${porcentaje(a.quorumRequerido, 0)}`,
        href: `/admin/asambleas/${a.asambleaId}`,
      };
    case 'RECLAMO_SIN_ASIGNAR':
      return {
        icono: Wrench,
        tono: 'bg-accent text-accent-foreground',
        titulo: `Reclamo de ${a.categoria.toLowerCase()} sin asignar ${haceCuanto(a.creadoAt)}`,
        detalle: `${a.consorcio} · unidad ${a.unidad}`,
        href: '/admin/reclamos',
      };
  }
}

/** "Requiere tu atención" de la pantalla 01: lo que no puede esperar, de todos los consorcios. */
export function RequiereAtencion({ items }: { items: Atencion[] }) {
  const router = useRouter();
  const { consorcios, cambiar } = useConsorcioActivo();

  function ir(a: Atencion, href: string) {
    // Las pantallas trabajan sobre el consorcio activo: primero se para en el del aviso.
    if (consorcios.some((c) => c.id === a.consorcioId)) cambiar(a.consorcioId);
    router.push(href);
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nada pendiente: todos tus consorcios están al día.
      </p>
    );
  }

  return (
    <ul className="-mx-2 flex flex-col">
      {items.map((a, i) => {
        const r = renglonDe(a);
        return (
          <li key={`${a.tipo}-${i}`}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => ir(a, r.href)}
              className="h-auto w-full justify-start gap-3 px-2 py-2.5 text-left font-normal whitespace-normal"
            >
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', r.tono)}>
                {createElement(r.icono, { className: 'size-4' })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug font-medium">{r.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.detalle}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
