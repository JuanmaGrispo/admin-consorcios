'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import type { FilaCobranza } from '@/types/expensa';

type Alcance = 'todos' | 'pendientes' | 'vencidos';

const ALCANCES: { valor: Alcance; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos los que deben' },
  { valor: 'vencidos', etiqueta: 'Sólo los vencidos' },
  { valor: 'pendientes', etiqueta: 'Sólo los que todavía no vencieron' },
];

interface DialogoRecordatoriosProps {
  /** Si viene, el aviso es sólo para esa boleta; si no, para el período que se está viendo. */
  fila?: FilaCobranza;
  /** "Agosto 2026": para decir a quiénes les llega. */
  periodo?: string;
  onEnviar: (alcance: { situacion?: 'pendientes' | 'vencidos'; mensaje?: string }) => Promise<void>;
  onCerrar: () => void;
}

/** Avisar a quienes deben. Nunca le llega a quien ya pagó. */
export function DialogoRecordatorios({ fila, periodo, onEnviar, onCerrar }: DialogoRecordatoriosProps) {
  const [alcance, setAlcance] = useState<Alcance>('todos');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onEnviar({
        situacion: fila || alcance === 'todos' ? undefined : alcance,
        mensaje: mensaje.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron enviar los recordatorios.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fila ? `Recordatorio a ${fila.unidad.etiqueta}` : 'Enviar recordatorios'}</DialogTitle>
          <DialogDescription>
            {fila
              ? 'Les llega a los vecinos de la unidad.'
              : `Un aviso a cada vecino con saldo${periodo ? ` de ${periodo.toLowerCase()}` : ''}. A quien ya pagó no le llega.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FieldGroup>
            {!fila && (
              <RadioGroup value={alcance} onValueChange={(v) => setAlcance(v as Alcance)} aria-label="A quiénes">
                {ALCANCES.map((a) => (
                  <Field key={a.valor} orientation="horizontal">
                    <RadioGroupItem id={`alcance-${a.valor}`} value={a.valor} />
                    <FieldLabel htmlFor={`alcance-${a.valor}`} className="font-normal">
                      {a.etiqueta}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            )}
            <Field>
              <FieldLabel htmlFor="mensaje">Mensaje (opcional)</FieldLabel>
              <Textarea
                id="mensaje"
                rows={3}
                maxLength={500}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Les recordamos que el vencimiento es el 10. Pueden pagar desde la app."
              />
              <FieldDescription>Va junto con el saldo y el vencimiento de cada uno.</FieldDescription>
            </Field>
          </FieldGroup>
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
              {enviando ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
