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
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { reclamosService } from '@/services/reclamos';
import type { EstadoReclamo, Reclamo } from '@/types/reclamo';

/** Qué dice el diálogo según a dónde va el reclamo. */
const TEXTOS: Record<EstadoReclamo, { titulo: string; descripcion: string; boton: string; placeholder: string }> = {
  RESUELTO: {
    titulo: 'Marcar como resuelto',
    descripcion: 'Se cierra el caso y se le avisa al vecino. Contale cómo se resolvió.',
    boton: 'Marcar resuelto',
    placeholder: 'Se cambió el flotante y no pierde más.',
  },
  EN_CURSO: {
    titulo: 'Pasar a en curso',
    descripcion: 'El vecino recibe un aviso con el cambio de estado.',
    boton: 'Pasar a en curso',
    placeholder: 'Ya estamos trabajando en esto.',
  },
  ESPERANDO_PROVEEDOR: {
    titulo: 'Esperando proveedor',
    descripcion: 'Para cuando el arreglo depende de que el proveedor venga o consiga un repuesto.',
    boton: 'Confirmar',
    placeholder: 'El técnico viene el lunes con el repuesto.',
  },
  NUEVO: {
    titulo: 'Volver a nuevo',
    descripcion: 'El reclamo vuelve a la columna de nuevos.',
    boton: 'Volver a nuevo',
    placeholder: '',
  },
};

interface DialogoCambiarEstadoProps {
  reclamo: Reclamo;
  /** A dónde lo lleva. `null` cierra el diálogo. */
  destino: EstadoReclamo | null;
  onCerrar: () => void;
  onCambiado: () => void;
}

/** Cambia el estado con un mensaje opcional que queda en la línea de tiempo. */
export function DialogoCambiarEstado({ reclamo, destino, onCerrar, onCambiado }: DialogoCambiarEstadoProps) {
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Reabrir un resuelto también pasa por EN_CURSO, pero se lee distinto.
  const reabre = reclamo.estado === 'RESUELTO' && destino !== null;
  const textos = destino ? TEXTOS[destino] : null;

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!destino) return;
    setGuardando(true);
    setError(null);
    try {
      await reclamosService.cambiarEstado(reclamo.id, destino, mensaje.trim() || undefined);
      setMensaje('');
      onCerrar();
      onCambiado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={destino !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          setError(null);
          onCerrar();
        }
      }}
    >
      <DialogContent>
        {textos && (
          <form onSubmit={confirmar} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{reabre ? 'Reabrir el reclamo' : textos.titulo}</DialogTitle>
              <DialogDescription>
                {reclamo.codigo} · {reclamo.unidad.etiqueta}.{' '}
                {reabre ? 'Vuelve a estar abierto y el vecino puede seguir escribiendo.' : textos.descripcion}
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="mensaje-estado">Mensaje (opcional)</FieldLabel>
              <Textarea
                id="mensaje-estado"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={textos.placeholder}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : reabre ? 'Reabrir' : textos.boton}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
