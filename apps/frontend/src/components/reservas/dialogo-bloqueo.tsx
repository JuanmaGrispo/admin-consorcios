'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import type { BloqueoInput } from '@/types/reserva';

interface DialogoBloqueoProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** "SUM · Av. Rivadavia 4820". */
  subtitulo: string;
  onBloquear: (input: BloqueoInput) => Promise<void>;
}

/** "Bloquear fechas" (pantalla 05): mantenimiento, obra o lo que deje el amenity sin uso. */
export function DialogoBloqueo({ abierto, onOpenChange, subtitulo, onBloquear }: DialogoBloqueoProps) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>Bloquear fechas</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>
        <Formulario onBloquear={onBloquear} onCancelar={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ onBloquear, onCancelar }: Pick<DialogoBloqueoProps, 'onBloquear'> & { onCancelar: () => void }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('Mantenimiento');
  // El backend rechaza con 409 un bloqueo que pisa reservas: se explica y se ofrece cancelarlas.
  const [pisaReservas, setPisaReservas] = useState(false);
  const [cancelarReservas, setCancelarReservas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasta <= desde) {
      setError('El fin tiene que ser posterior al inicio.');
      return;
    }
    setEnviando(true);
    try {
      await onBloquear({ desde, hasta, motivo: motivo.trim() || undefined, cancelarReservas });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setPisaReservas(true);
      setError(err instanceof ApiError ? err.message : 'No se pudo bloquear.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="desde">Desde</FieldLabel>
          <Input id="desde" type="datetime-local" required value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="hasta">Hasta</FieldLabel>
          <Input id="hasta" type="datetime-local" required value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="motivo">Motivo</FieldLabel>
          <Input id="motivo" maxLength={120} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
        {pisaReservas && (
          <Field orientation="horizontal" className="rounded-lg bg-muted px-3 py-2.5 sm:col-span-2">
            <Checkbox
              id="cancelarReservas"
              checked={cancelarReservas}
              onCheckedChange={(v) => setCancelarReservas(v === true)}
            />
            <FieldLabel htmlFor="cancelarReservas" className="font-normal text-secondary-foreground">
              Cancelar las reservas que caen en esas fechas (se les avisa a los vecinos)
            </FieldLabel>
          </Field>
        )}
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">En el calendario se ve como bloqueado.</p>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando || (pisaReservas && !cancelarReservas)}>
          {enviando ? 'Bloqueando…' : 'Bloquear'}
        </Button>
      </DialogFooter>
    </form>
  );
}
