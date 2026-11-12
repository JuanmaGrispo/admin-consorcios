'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** El círculo y el robot adentro, con un poco de aire alrededor. */
const TAMANO = 60;
const TAMANO_ROBOT = 52;
const MARGEN = 8;
/** Lo que hay que mover el puntero para que cuente como arrastre y no como toque. */
const UMBRAL_ARRASTRE = 5;
const CLAVE = 'domus.domot.posicion';
/** Cada cuánto aparece el "¿Necesitás ayuda?", y cuánto se queda. */
const CADA_MS = 30_000;
const VISIBLE_MS = 5_000;
const PRIMERA_VEZ_MS = 3_000;

interface Posicion {
  x: number;
  y: number;
}

/** Que el botón no quede afuera de la pantalla, por ejemplo después de girar el celular. */
function dentro({ x, y }: Posicion): Posicion {
  return {
    x: Math.min(Math.max(MARGEN, x), window.innerWidth - TAMANO - MARGEN),
    y: Math.min(Math.max(MARGEN, y), window.innerHeight - TAMANO - MARGEN),
  };
}

type Portal = 'vecino' | 'admin';

/** Distancia al borde cuando queda pegado a un costado. */
const BORDE = 16;
/** El ancho de la columna del portal del vecino (`max-w-md`). */
const COLUMNA_VECINO = 448;

/**
 * Dónde queda pegado a cada costado. En el vecino, con la pantalla más ancha
 * que la columna, son los bordes de la columna: el mismo lugar donde arranca.
 */
function costados(portal: Portal): { izquierda: number; derecha: number } {
  const ancho = window.innerWidth;
  const afuera = portal === 'vecino' ? Math.max(0, (ancho - COLUMNA_VECINO) / 2) : 0;
  return { izquierda: afuera + BORDE, derecha: ancho - afuera - BORDE - TAMANO };
}

/** Lo pega al costado más cercano: nunca queda en el medio. La altura se respeta. */
function pegar(p: Posicion, portal: Portal): Posicion {
  const { izquierda, derecha } = costados(portal);
  return { x: p.x + TAMANO / 2 < window.innerWidth / 2 ? izquierda : derecha, y: dentro(p).y };
}

/** Dónde lo dejó el usuario la última vez, en este navegador. Puede no haber nada. */
function guardada(portal: Portal): Posicion | null {
  if (typeof window === 'undefined') return null;
  try {
    const p = JSON.parse(window.localStorage.getItem(CLAVE) ?? 'null') as Posicion | null;
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? pegar(p, portal) : null;
  } catch {
    return null;
  }
}

/**
 * Domot, el botón flotante del asistente. Arranca abajo a la derecha y se
 * puede arrastrar si tapa algo: al soltarlo se pega al costado más cercano,
 * a la altura donde quedó, y la posición se guarda en el navegador. Un toque
 * sin arrastrar abre el chat.
 *
 * Cada 30 segundos asoma un "¿Necesitás ayuda?" del lado que da al centro de
 * la pantalla, para quien todavía no lo vio.
 *
 * `vecino` lo sube por encima de la barra de navegación de abajo y, en la
 * compu, lo pega al borde de la columna central en vez al de la pantalla.
 */
export function BotonDomot({ portal, onAbrir }: { portal: Portal; onAbrir: () => void }) {
  // null: todavía no lo movió, se usa el lugar por defecto (con CSS).
  const [posicion, setPosicion] = useState<Posicion | null>(() => guardada(portal));
  const arrastre = useRef<{ inicio: Posicion; boton: Posicion; movio: boolean } | null>(null);
  const [aviso, setAviso] = useState(false);
  const [encima, setEncima] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(() => {
    let ocultar: ReturnType<typeof setTimeout> | undefined;
    const mostrar = () => {
      setAviso(true);
      ocultar = setTimeout(() => setAviso(false), VISIBLE_MS);
    };
    const primera = setTimeout(mostrar, PRIMERA_VEZ_MS);
    const cada = setInterval(mostrar, CADA_MS);
    return () => {
      clearTimeout(primera);
      clearTimeout(ocultar);
      clearInterval(cada);
    };
  }, []);

  useEffect(() => {
    const ajustar = () => setPosicion((p) => (p ? pegar(p, portal) : p));
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [portal]);

  function alApretar(e: PointerEvent<HTMLButtonElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { inicio: { x: e.clientX, y: e.clientY }, boton: { x: caja.left, y: caja.top }, movio: false };
  }

  function alMover(e: PointerEvent<HTMLButtonElement>) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.inicio.x;
    const dy = e.clientY - a.inicio.y;
    if (!a.movio && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
    if (!a.movio) setArrastrando(true);
    a.movio = true;
    setPosicion(dentro({ x: a.boton.x + dx, y: a.boton.y + dy }));
  }

  function alSoltar() {
    const a = arrastre.current;
    arrastre.current = null;
    setArrastrando(false);
    if (!a?.movio) {
      onAbrir();
      return;
    }
    if (!posicion) return;
    const pegado = pegar(posicion, portal);
    setPosicion(pegado);
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(pegado));
    } catch {
      /* sin almacenamiento, la posición dura hasta recargar */
    }
  }

  // El texto va hacia el centro: si el botón está a la derecha, a su izquierda, y al revés.
  const aLaIzquierda = !(posicion && posicion.x + TAMANO / 2 < window.innerWidth / 2);
  const visible = (aviso || encima) && !arrastrando;

  return (
    <div
      style={posicion ? { left: posicion.x, top: posicion.y } : undefined}
      className={cn(
        'fixed z-40',
        // Al soltarlo se desliza hasta el costado; mientras se arrastra sigue al dedo sin demora.
        !arrastrando && 'transition-[left,top] duration-300 ease-out motion-reduce:transition-none',
        !posicion &&
          (portal === 'vecino'
            ? // Arriba de la barra de abajo y contra el borde derecho de la columna de 28rem.
              'right-[max(1rem,calc(50vw-13rem))] bottom-24'
            : 'right-4 bottom-4'),
      )}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setEncima(true)}
      onPointerLeave={() => setEncima(false)}
    >
      {/* Sale de Domot hacia afuera y vuelve hacia él: crece desde el borde que lo toca. */}
      <span
        aria-hidden
        onClick={onAbrir}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-lg bg-popover px-3 py-1.5 text-sm font-medium whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-foreground/10',
          'transition-[opacity,scale,translate] duration-300 ease-out motion-reduce:transition-none',
          aLaIzquierda ? 'right-full mr-3 origin-right' : 'left-full ml-3 origin-left',
          visible
            ? 'translate-x-0 scale-100 opacity-100'
            : cn('pointer-events-none scale-75 opacity-0', aLaIzquierda ? 'translate-x-3' : '-translate-x-3'),
        )}
      >
        ¿Necesitás ayuda?
      </span>
      <Button
        variant="outline"
        aria-label="¿Necesitás ayuda? Abrir el chat de Domot"
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={() => {
          arrastre.current = null;
          setArrastrando(false);
        }}
        onKeyDown={(e) => {
          // El arrastre es con el puntero; con el teclado, Enter o espacio abren el chat.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAbrir();
          }
        }}
        className="size-15 cursor-grab touch-none rounded-full bg-card p-0 shadow-lg select-none hover:bg-card active:cursor-grabbing"
      >
        <Image src="/domot.png" alt="" width={TAMANO_ROBOT} height={TAMANO_ROBOT} draggable={false} priority />
      </Button>
    </div>
  );
}
