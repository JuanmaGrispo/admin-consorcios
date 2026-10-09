'use client';

import { Pencil, Plus, Vote } from 'lucide-react';
import { useState } from 'react';
import { EstadoBadge } from '@/components/estado-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import type { PuntoOrdenDia } from '@/types/asamblea';
import type { Votacion } from '@/types/votacion';
import { EditorPuntos, puntosParaEnviar, type PuntoEditable } from './editor-puntos';

interface OrdenDelDiaProps {
  puntos: PuntoOrdenDia[];
  /** Las votaciones de la asamblea: cada una cuelga de un punto o es un punto nuevo. */
  votaciones: Votacion[];
  /** Sólo en borrador se puede reordenar o reescribir. */
  editable: boolean;
  /** Se puede armar la votación de un punto mientras la asamblea no cerró. */
  puedeCrearVotacion: boolean;
  onGuardar: (puntos: ReturnType<typeof puntosParaEnviar>) => Promise<void>;
  onCrearVotacion: (punto: PuntoOrdenDia) => void;
  onVerVotacion: (votacion: Votacion) => void;
}

/** El orden del día de la asamblea, con la votación de cada punto que la tenga. */
export function OrdenDelDia({
  puntos,
  votaciones,
  editable,
  puedeCrearVotacion,
  onGuardar,
  onCrearVotacion,
  onVerVotacion,
}: OrdenDelDiaProps) {
  const [editando, setEditando] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orden del día</CardTitle>
        {editable && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {puntos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay puntos.{editable ? ' Sumalos antes de convocar.' : ''}
          </p>
        ) : (
          <ol className="flex flex-col divide-y">
            {puntos.map((p) => {
              const votacion = votaciones.find((v) => v.puntoOrdenDiaId === p.id);
              return (
                <li key={p.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground tabular-nums">
                    {p.orden}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.titulo}</p>
                    {p.descripcion && <p className="text-sm text-muted-foreground">{p.descripcion}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.tipo === 'CON_VOTACION' ? 'Con votación' : 'Informativo'}
                    </p>
                  </div>
                  {p.tipo === 'CON_VOTACION' &&
                    (votacion ? (
                      <Button variant="outline" size="sm" onClick={() => onVerVotacion(votacion)}>
                        <Vote data-icon="inline-start" />
                        <EstadoBadge dominio="votacion" estado={votacion.estado} />
                      </Button>
                    ) : (
                      puedeCrearVotacion && (
                        <Button variant="outline" size="sm" onClick={() => onCrearVotacion(p)}>
                          <Plus data-icon="inline-start" />
                          Armar votación
                        </Button>
                      )
                    ))}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      {editando && (
        <DialogoOrdenDia
          puntos={puntos}
          onGuardar={async (nuevos) => {
            await onGuardar(nuevos);
            setEditando(false);
          }}
          onCerrar={() => setEditando(false)}
        />
      )}
    </Card>
  );
}

function DialogoOrdenDia({
  puntos,
  onGuardar,
  onCerrar,
}: {
  puntos: PuntoOrdenDia[];
  onGuardar: (puntos: ReturnType<typeof puntosParaEnviar>) => Promise<void>;
  onCerrar: () => void;
}) {
  const [editables, setEditables] = useState<PuntoEditable[]>(
    puntos.map((p) => ({ titulo: p.titulo, descripcion: p.descripcion ?? '', tipo: p.tipo })),
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar(puntosParaEnviar(editables));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el orden del día.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>Orden del día</DialogTitle>
          <DialogDescription>El número de cada punto es su posición en la lista.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <EditorPuntos puntos={editables} onCambiar={setEditables} />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar orden del día'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
