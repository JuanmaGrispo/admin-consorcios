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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import type { Usuario, UsuarioCambios } from '@/types/usuario';

interface VecinoDialogProps {
  vecino: Usuario;
  onGuardar: (cambios: UsuarioCambios) => Promise<void>;
  onCerrar: () => void;
}

/** Corregir los datos de un vecino: nombre, email, DNI y teléfono. */
export function VecinoDialog({ vecino, onGuardar, onCerrar }: VecinoDialogProps) {
  const [nombre, setNombre] = useState(vecino.nombre);
  const [apellido, setApellido] = useState(vecino.apellido);
  const [email, setEmail] = useState(vecino.email);
  const [dni, setDni] = useState(vecino.dni ?? '');
  const [telefono, setTelefono] = useState(vecino.telefono ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        dni: dni.trim(),
        telefono: telefono.trim(),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>
            {vecino.nombre} {vecino.apellido}
          </DialogTitle>
          <DialogDescription>Datos de la cuenta del vecino.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
                <Input id="nombre" required maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="apellido">Apellido</FieldLabel>
                <Input
                  id="apellido"
                  required
                  maxLength={80}
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dni">DNI</FieldLabel>
                <Input id="dni" maxLength={20} value={dni} onChange={(e) => setDni(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
                <Input
                  id="telefono"
                  type="tel"
                  maxLength={30}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="sm:items-center">
            <p className="text-xs text-muted-foreground sm:mr-auto">Con el email nuevo entra desde la próxima vez.</p>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
