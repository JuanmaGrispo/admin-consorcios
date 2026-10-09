'use client';

import { Send } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { reclamosService } from '@/services/reclamos';

interface ResponderReclamoProps {
  reclamoId: string;
  /** El administrador puede dejar una nota que el vecino no ve. */
  administrador?: boolean;
  onEnviado: () => void;
}

/** Suma un mensaje a la línea de tiempo del reclamo. */
export function ResponderReclamo({ reclamoId, administrador = false, onEnviado }: ResponderReclamoProps) {
  const id = useId();
  const [mensaje, setMensaje] = useState('');
  const [interna, setInterna] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!mensaje.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      await reclamosService.agregarMensaje(reclamoId, mensaje.trim(), administrador && interna);
      setMensaje('');
      setInterna(false);
      onEnviado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={`${id}-mensaje`}>
          {administrador ? 'Responder al vecino' : 'Escribile a la administración'}
        </FieldLabel>
        <Textarea
          id={`${id}-mensaje`}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={
            administrador && interna
              ? 'Una nota para la administración: el vecino no la ve.'
              : administrador
                ? 'Escribí una respuesta… se envía por la app y por email.'
                : 'Contanos si hay alguna novedad.'
          }
        />
      </Field>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {administrador ? (
          <Field orientation="horizontal" className="w-auto">
            <Switch id={`${id}-interna`} checked={interna} onCheckedChange={setInterna} />
            <FieldLabel htmlFor={`${id}-interna`} className="font-normal">
              Nota interna
            </FieldLabel>
          </Field>
        ) : (
          <span />
        )}
        <Button type="submit" variant="outline" disabled={enviando || !mensaje.trim()}>
          <Send />
          {enviando ? 'Enviando…' : 'Enviar'}
        </Button>
      </div>
    </form>
  );
}
