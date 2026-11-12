'use client';

import { BookOpen, RotateCcw, SendHorizontal, ThumbsDown, ThumbsUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useSesion } from '@/components/session';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { asistenteService } from '@/services/asistente';
import type { RespuestaAsistente } from '@/types/asistente';
import { BotonDomot } from './boton-domot';

const MAX_PREGUNTA = 500;

/** Cómo se nombra cada consulta de datos en la respuesta. */
const DATOS: Record<string, string> = {
  consultar_saldo: 'tu saldo',
  mis_reclamos: 'tus reclamos',
  mis_reservas: 'tus reservas',
  disponibilidad_amenity: 'los horarios del amenity',
  deuda_antigua: 'la deuda vencida',
};

const SUGERENCIAS: Record<'VECINO' | 'ADMINISTRADOR', string[]> = {
  VECINO: ['¿Cómo pago las expensas?', '¿Cuánto debo?', '¿Cómo reservo el SUM?'],
  ADMINISTRADOR: ['¿Cómo hago la liquidación del mes?', '¿Cómo registro un pago por transferencia?'],
};

type Mensaje =
  | { id: string; autor: 'usuario'; texto: string }
  | { id: string; autor: 'asistente'; respuesta: RespuestaAsistente; voto?: boolean };

/** La pantalla actual, recortada a la sección: `/vecino/reclamos/123` → `/vecino/reclamos`. */
function pantallaDe(ruta: string): string {
  return ruta.split('/').slice(0, 3).join('/');
}

/** Las negritas del manual (`**Pagar**`) como <strong>; el resto, texto plano. */
function ConNegritas({ texto }: { texto: string }) {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? <strong key={i}>{parte}</strong> : <Fragment key={i}>{parte}</Fragment>,
  );
}

/** Mientras llega, una negrita abierta (`**Expen`) se muestra sin los asteriscos. */
function sinNegritaAbierta(texto: string): string {
  const abiertas = texto.split('**').length - 1;
  if (abiertas % 2 === 0) return texto;
  const ultima = texto.lastIndexOf('**');
  return texto.slice(0, ultima) + texto.slice(ultima + 2);
}

/**
 * Domot, el asistente de ayuda: un botón flotante que abre el chat en un
 * panel lateral. Responde con el manual de usuario y guía; nunca hace nada
 * por el usuario. Los botones de las respuestas sólo llevan a una pantalla.
 */
export function AsistenteAyuda({ portal }: { portal: 'vecino' | 'admin' }) {
  const { usuario } = useSesion();
  const rol = usuario.rol === 'SUPER_ADMIN' ? null : usuario.rol;
  const { datos: estado } = usePedido(rol ? 'asistente-estado' : null, asistenteService.estado);
  const [abierto, setAbierto] = useState(false);

  // El superadministrador no usa el asistente, y apagado no se ofrece.
  if (!rol || !estado?.habilitado) return null;

  return (
    <>
      {!abierto && <BotonDomot portal={portal} onAbrir={() => setAbierto(true)} />}
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <Chat rol={rol} onNavegar={() => setAbierto(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function Chat({ rol, onNavegar }: { rol: 'VECINO' | 'ADMINISTRADOR'; onNavegar: () => void }) {
  const pathname = usePathname();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacionId, setConversacionId] = useState<string>();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  /** Lo que va llegando de la respuesta mientras el modelo la escribe. */
  const [enCurso, setEnCurso] = useState('');
  const [error, setError] = useState<string>();
  const final = useRef<HTMLDivElement>(null);

  useEffect(() => {
    final.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, enviando, enCurso]);

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (!limpia || enviando) return;
    setError(undefined);
    setTexto('');
    setMensajes((m) => [...m, { id: crypto.randomUUID(), autor: 'usuario', texto: limpia }]);
    setEnviando(true);
    try {
      const respuesta = await asistenteService.preguntarEnVivo(
        { pregunta: limpia, conversacion_id: conversacionId, pantalla: pantallaDe(pathname) },
        (pedazo) => setEnCurso((t) => t + pedazo),
      );
      setConversacionId(respuesta.conversacion_id);
      setMensajes((m) => [...m, { id: respuesta.interaccion_id, autor: 'asistente', respuesta }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la pregunta. Probá de nuevo.');
    } finally {
      // La respuesta final reemplaza al texto parcial: es la validada, con fuentes y botones.
      setEnCurso('');
      setEnviando(false);
    }
  }

  async function votar(id: string, util: boolean) {
    setMensajes((m) => m.map((x) => (x.id === id && x.autor === 'asistente' ? { ...x, voto: util } : x)));
    // El voto es una ayuda para mejorar: si falla, no vale la pena molestar al usuario.
    await asistenteService.feedback(id, util).catch(() => undefined);
  }

  function nuevaConversacion() {
    setMensajes([]);
    setConversacionId(undefined);
    setError(undefined);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="flex-row items-center gap-3 border-b pr-12">
        <Image src="/domot.png" alt="" width={40} height={40} className="shrink-0 rounded-full bg-card shadow-sm" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle>Domot</SheetTitle>
          <SheetDescription>El asistente de ayuda de Domus</SheetDescription>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {mensajes.length === 0 && (
          <div className="flex flex-col gap-2">
            <div className="mr-8 rounded-xl border bg-card p-3">
              <p>
                ¡Hola! Soy <strong>Domot</strong>. Te ayudo a encontrar dónde está cada cosa en Domus y cómo hacerla,
                con el manual de la app. No hago cambios por vos: te guío paso a paso.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Mis respuestas se generan con IA y pueden tener errores: ante una duda, consultá a la administración.
                No compartas datos personales.
              </p>
            </div>
            <p className="mt-2 text-muted-foreground">Podés empezar por acá:</p>
            {SUGERENCIAS[rol].map((s) => (
              <Button key={s} variant="outline" size="sm" className="justify-start" onClick={() => void enviar(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}

        {mensajes.map((m) =>
          m.autor === 'usuario' ? (
            <div key={m.id} className="ml-8 self-end rounded-xl bg-primary px-3 py-2 text-primary-foreground">
              {m.texto}
            </div>
          ) : (
            <RespuestaBurbuja
              key={m.id}
              respuesta={m.respuesta}
              voto={m.voto}
              onVotar={(util) => void votar(m.id, util)}
              onNavegar={onNavegar}
            />
          ),
        )}

        {enviando &&
          (enCurso ? (
            <div className="mr-8 rounded-xl border bg-card p-3">
              <p className="whitespace-pre-line">
                <ConNegritas texto={sinNegritaAbierta(enCurso)} />
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-muted-foreground/40 align-text-bottom" />
              </p>
            </div>
          ) : (
            <div className="mr-8 flex flex-col gap-2 rounded-xl border bg-card p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div ref={final} />
      </div>

      <form
        className="flex flex-col gap-2 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter baja de línea.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar(texto);
            }
          }}
          placeholder="Escribí tu pregunta"
          maxLength={MAX_PREGUNTA}
          rows={2}
          className="max-h-32 resize-none"
          aria-label="Tu pregunta"
        />
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={nuevaConversacion} disabled={mensajes.length === 0}>
            <RotateCcw />
            Nueva conversación
          </Button>
          <Button type="submit" size="sm" disabled={enviando || !texto.trim()}>
            <SendHorizontal />
            Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}

function RespuestaBurbuja({
  respuesta: r,
  voto,
  onVotar,
  onNavegar,
}: {
  respuesta: RespuestaAsistente;
  voto?: boolean;
  onVotar: (util: boolean) => void;
  onNavegar: () => void;
}) {
  const datos = r.datos_consultados.map((d) => DATOS[d]).filter(Boolean);
  return (
    <div className="mr-8 flex flex-col gap-3 rounded-xl border bg-card p-3">
      <p className="whitespace-pre-line">
        <ConNegritas texto={r.respuesta} />
      </p>

      {r.acciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.acciones.map((a) => (
            <Button key={a.ruta} asChild size="sm" variant="secondary">
              <Link href={a.ruta} onClick={onNavegar}>
                {a.etiqueta}
              </Link>
            </Button>
          ))}
        </div>
      )}

      {r.derivar_a_humano && r.origen !== 'rechazo' && (
        <Badge variant="warning" className="self-start">
          Para esto conviene hablar con la administración
        </Badge>
      )}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {r.fuentes.length > 0 && (
          <span className="flex items-start gap-1">
            <BookOpen className="mt-0.5 size-3 shrink-0" />
            Manual: {r.fuentes.map((f) => f.seccion).join(' · ')}
          </span>
        )}
        {datos.length > 0 && <span>Consulté {datos.join(', ')}.</span>}
        {r.origen === 'manual' && <span>Respuesta tomada del manual, sin IA.</span>}
      </div>

      <div className="flex items-center gap-1 self-end">
        <span className="mr-1 text-xs text-muted-foreground">¿Te sirvió?</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Me sirvió"
          aria-pressed={voto === true}
          className={cn(voto === true && 'text-primary')}
          onClick={() => onVotar(true)}
        >
          <ThumbsUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="No me sirvió"
          aria-pressed={voto === false}
          className={cn(voto === false && 'text-destructive')}
          onClick={() => onVotar(false)}
        >
          <ThumbsDown />
        </Button>
      </div>
    </div>
  );
}
