'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { perfilService } from '@/services/perfil';

/** Cambiar la contraseña propia: pide la actual y la nueva dos veces. */
export function CambiarPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noCoinciden = repetida !== '' && nueva !== repetida;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (noCoinciden) return;
    setError(null);
    setEnviando(true);
    try {
      await perfilService.cambiarPassword(actual, nueva);
      toast.success('Contraseña cambiada');
      setActual('');
      setNueva('');
      setRepetida('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseña</CardTitle>
        <CardDescription>Si te la dio la administración, cambiala por una tuya.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="actual">Contraseña actual</FieldLabel>
              <Input
                id="actual"
                type="password"
                required
                autoComplete="current-password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nueva">Nueva</FieldLabel>
                <Input
                  id="nueva"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                />
                <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="repetida">Repetila</FieldLabel>
                <Input
                  id="repetida"
                  type="password"
                  required
                  autoComplete="new-password"
                  aria-invalid={noCoinciden}
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                />
                {noCoinciden && <FieldDescription className="text-destructive">No coinciden.</FieldDescription>}
              </Field>
            </div>
          </FieldGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full sm:w-auto sm:self-end" disabled={enviando || noCoinciden}>
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
