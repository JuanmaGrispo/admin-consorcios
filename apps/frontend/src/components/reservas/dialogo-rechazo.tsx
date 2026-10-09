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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import type { Reserva } from '@/types/reserva';
import { cuando } from './tiempo';

interface DialogoRechazoProps {
  /** La reserva a rechazar; null lo cierra. */
  reserva: Reserva | null;
  onCerrar: () => void;
  onRechazar: (reserva: Reserva, motivo: string) => Promise<void>;
}

/** Rechazar pide el motivo: al vecino le llega con el aviso. */
export function DialogoRechazo({ reserva, onCerrar, onRechazar }: DialogoRechazoProps) {
  return (
    <Dialog open={reserva !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>Rechazar reserva</DialogTitle>
          <DialogDescription>
            {reserva &&
              `${reserva.amenity.nombre} · ${reserva.unidad.etiqueta} · ${cuando(reserva.inicio, reserva.fin)}`}
          </DialogDescription>
        </DialogHeader>
        {reserva && <Formulario reserva={reserva} onRechazar={onRechazar} onCerrar={onCerrar} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ reserva, onRechazar, onCerrar }: DialogoRechazoProps & { reserva: Reserva }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onRechazar(reserva, motivo.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar la reserva.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="motivoRechazo">Motivo</FieldLabel>
        <Textarea
          id="motivoRechazo"
          required
          maxLength={200}
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ese día hay mantenimiento."
        />
        <FieldDescription>El vecino lo lee en el aviso.</FieldDescription>
      </Field>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" disabled={enviando || !motivo.trim()}>
          {enviando ? 'Rechazando…' : 'Rechazar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
