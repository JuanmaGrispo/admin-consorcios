'use client';

import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { iniciales } from '@/lib/formato';
import { perfilService } from '@/services/perfil';
import type { Usuario } from '@/types/usuario';

interface DatosPerfilProps {
  perfil: Usuario;
  /** Después de guardar: que la página vuelva a pedir el perfil. */
  onGuardado: () => void;
}

/** Foto, nombre y teléfono propios. El email lo cambia la administración. */
export function DatosPerfil({ perfil, onGuardado }: DatosPerfilProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState(perfil.nombre);
  const [apellido, setApellido] = useState(perfil.apellido);
  const [telefono, setTelefono] = useState(perfil.telefono ?? '');
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambio =
    nombre.trim() !== perfil.nombre ||
    apellido.trim() !== perfil.apellido ||
    telefono.trim() !== (perfil.telefono ?? '');

  async function cambiarFoto(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const { url } = await perfilService.subirAvatar(archivo);
      await perfilService.actualizar({ avatarUrl: url });
      toast.success('Foto actualizada');
      onGuardado();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  async function sacarFoto() {
    setSubiendo(true);
    try {
      await perfilService.actualizar({ avatarUrl: null });
      toast.success('Foto eliminada');
      onGuardado();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo sacar la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await perfilService.actualizar({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
      });
      toast.success('Datos guardados');
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar tus datos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus datos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {perfil.avatarUrl && <AvatarImage src={perfil.avatarUrl} alt="" />}
            <AvatarFallback className="text-lg">{iniciales(perfil.nombre, perfil.apellido)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <Input
              ref={entrada}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Foto de perfil"
              onChange={(e) => {
                void cambiarFoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button variant="outline" size="sm" onClick={() => entrada.current?.click()} disabled={subiendo}>
              <Camera data-icon="inline-start" />
              {subiendo ? 'Subiendo…' : perfil.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
            </Button>
            {perfil.avatarUrl && (
              <Button variant="ghost" size="sm" onClick={sacarFoto} disabled={subiendo}>
                <Trash2 data-icon="inline-start" />
                Sacar
              </Button>
            )}
          </div>
        </div>

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
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" value={perfil.email} disabled />
                <FieldDescription>Para cambiarlo, pedíselo a la administración.</FieldDescription>
              </Field>
            </div>
          </FieldGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full sm:w-auto sm:self-end" disabled={!cambio || enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
