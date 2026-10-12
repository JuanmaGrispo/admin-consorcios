import { CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fechaDeInstante, hora, porcentaje } from '@/lib/formato';
import type { EventoProximo } from '@/types/inicio';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ASISTENCIA: Record<string, string> = {
  ASISTE: 'Confirmaste que vas',
  CON_PODER: 'Vas con un poder',
  NO_ASISTE: 'Avisaste que no vas',
};

interface Renglon {
  titulo: string;
  detalle: string;
  href: string;
}

function renglonDe(e: EventoProximo): Renglon {
  switch (e.tipo) {
    case 'ASAMBLEA': {
      const quorum = e.quorumPorcentaje !== null ? ` · quórum ${porcentaje(e.quorumPorcentaje, 0)}` : '';
      return {
        titulo: `${e.titulo} · ${hora(e.fecha)}`,
        detalle:
          e.miAsistencia === 'SIN_RESPONDER'
            ? `Confirmá tu asistencia${quorum}`
            : `${(e.miAsistencia && ASISTENCIA[e.miAsistencia]) ?? e.lugar ?? 'Asamblea del edificio'}${quorum}`,
        href: `/vecino/asambleas#asamblea-${e.id}`,
      };
    }
    case 'RESERVA':
      return {
        titulo: `Tu reserva: ${e.titulo.toLowerCase()} · ${hora(e.fecha)} a ${hora(e.fin)}`,
        detalle: 'Aprobada por la administración',
        href: '/vecino/reservas',
      };
    case 'VOTACION':
      return {
        titulo: `Votación: ${e.titulo}`,
        detalle: `Cierra el ${fechaDeInstante(e.fecha).slice(0, 5)} a las ${hora(e.fecha)}`,
        href: `/vecino/asambleas?solapa=votaciones#votacion-${e.id}`,
      };
  }
}

/**
 * A dónde lleva "Ver todo": si la lista es sólo de reservas, a las reservas; si
 * es sólo de votaciones, a esa solapa; si no, a asambleas y votaciones.
 */
export function verTodoDe(eventos: EventoProximo[]): string {
  if (eventos.length > 0 && eventos.every((e) => e.tipo === 'RESERVA')) return '/vecino/reservas';
  if (eventos.length > 0 && eventos.every((e) => e.tipo === 'VOTACION')) return '/vecino/asambleas?solapa=votaciones';
  return '/vecino/asambleas';
}

/** "Próximos eventos" del inicio (pantalla 10): asambleas, reservas y votaciones, el más cercano primero. */
export function ProximosEventos({ eventos }: { eventos: EventoProximo[] }) {
  if (eventos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CalendarCheck className="size-7 text-muted-foreground" />
        <p className="text-sm font-medium">No tenés eventos próximos</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Cuando la administración publique una asamblea o te aprueben una reserva, aparecen acá.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href="/vecino/reservas">Reservar un amenity</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="-mx-2 flex flex-col">
      {eventos.map((e) => {
        const r = renglonDe(e);
        // Día y mes en la hora de Buenos Aires, igual que el resto de las fechas.
        const [dia, mes] = fechaDeInstante(e.fecha).split('/');
        return (
          <li key={`${e.tipo}-${e.id}`}>
            <Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2 font-normal whitespace-normal">
              <Link href={r.href}>
                <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-accent py-1 text-accent-foreground">
                  <span className="text-base leading-none font-bold tabular-nums">{dia}</span>
                  <span className="text-[11px] font-medium">{MESES_CORTOS[Number(mes) - 1]}</span>
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm leading-snug font-medium">{r.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{r.detalle}</span>
                </span>
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
