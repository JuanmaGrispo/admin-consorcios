'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError } from '@/lib/api';

interface ConfirmarAccionProps {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  boton: string;
  /** Si tira error, el diálogo queda abierto y lo muestra (un 409 "tiene reclamos" se explica solo). */
  onConfirmar: () => Promise<void>;
  onCerrar: () => void;
}

/** Confirmación de algo destructivo (borrar, dar de baja, sacar del muro) que muestra el error del backend adentro. */
export function ConfirmarAccion({ abierto, titulo, descripcion, boton, onConfirmar, onCerrar }: ConfirmarAccionProps) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar(e: React.MouseEvent) {
    // Que el diálogo no se cierre solo: si falla, el error se muestra adentro.
    e.preventDefault();
    setTrabajando(true);
    setError(null);
    try {
      await onConfirmar();
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <AlertDialog
      open={abierto}
      onOpenChange={(valor) => {
        if (!valor) {
          setError(null);
          onCerrar();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmar} disabled={trabajando}>
            {trabajando ? 'Un momento…' : boton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
