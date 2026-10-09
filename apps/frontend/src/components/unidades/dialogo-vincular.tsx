'use client';

import { Search, UserPlus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api';
import { usuariosService } from '@/services/usuarios';
import type { Unidad, VinculoInput, VinculoUnidad } from '@/types/unidad';
import type { Usuario } from '@/types/usuario';
import { VINCULOS } from './etiquetas';

type Modo = 'existente' | 'nuevo';

interface DialogoVincularProps {
  unidad: Unidad;
  /** Ya hay un titular vigente: el backend no acepta otro, así que no se ofrece. */
  hayTitular: boolean;
  onVincular: (input: VinculoInput) => Promise<void>;
  onCerrar: () => void;
}

/**
 * Sumar un vecino a la unidad: uno que ya tiene cuenta (se busca por email)
 * o uno nuevo, que se da de alta en el mismo paso.
 */
export function DialogoVincular({ unidad, hayTitular, onVincular, onCerrar }: DialogoVincularProps) {
  const [modo, setModo] = useState<Modo>('existente');
  const [vinculo, setVinculo] = useState<VinculoUnidad>('PROPIETARIO');
  const [esTitular, setEsTitular] = useState(!hayTitular);
  const [desde, setDesde] = useState('');

  // Vecino existente
  const [email, setEmail] = useState('');
  const [encontrado, setEncontrado] = useState<Usuario | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [sinResultado, setSinResultado] = useState(false);

  // Vecino nuevo
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [emailNuevo, setEmailNuevo] = useState('');
  const [password, setPassword] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    setError(null);
    setEncontrado(null);
    setSinResultado(false);
    setBuscando(true);
    try {
      const [usuario] = await usuariosService.listar({ email: email.trim() });
      if (usuario) setEncontrado(usuario);
      else setSinResultado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo buscar el email.');
    } finally {
      setBuscando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const comun = { vinculo, esTitular, desde: desde || undefined };
    try {
      await onVincular(
        modo === 'existente'
          ? { ...comun, usuarioId: encontrado!.id }
          : {
              ...comun,
              nuevoUsuario: {
                nombre: nombre.trim(),
                apellido: apellido.trim(),
                email: emailNuevo.trim(),
                password,
                dni: dni.trim() || undefined,
                telefono: telefono.trim() || undefined,
              },
            },
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo vincular al vecino.');
      setEnviando(false);
    }
  }

  const listo = modo === 'nuevo' || encontrado !== null;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>Sumar vecino a {unidad.etiqueta}</DialogTitle>
          <DialogDescription>Como propietario o inquilino.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Tabs value={modo} onValueChange={(v) => setModo(v as Modo)}>
            <TabsList className="w-full">
              <TabsTrigger value="existente">Ya tiene cuenta</TabsTrigger>
              <TabsTrigger value="nuevo">Vecino nuevo</TabsTrigger>
            </TabsList>

            <TabsContent value="existente" className="mt-4">
              <Field>
                <FieldLabel htmlFor="buscar-email">Email</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="buscar-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEncontrado(null);
                      setSinResultado(false);
                    }}
                    placeholder="vecino@mail.com"
                  />
                  <Button type="button" variant="outline" onClick={buscar} disabled={!email.trim() || buscando}>
                    <Search data-icon="inline-start" />
                    {buscando ? 'Buscando…' : 'Buscar'}
                  </Button>
                </div>
                {encontrado && (
                  <FieldDescription className="text-foreground">
                    {encontrado.nombre} {encontrado.apellido} · {encontrado.email}
                  </FieldDescription>
                )}
                {sinResultado && (
                  <FieldDescription>
                    No hay ninguna cuenta con ese email. Dalo de alta en “Vecino nuevo”.
                  </FieldDescription>
                )}
              </Field>
            </TabsContent>

            <TabsContent value="nuevo" className="mt-4">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
                    <Input
                      id="nombre"
                      required={modo === 'nuevo'}
                      maxLength={80}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="apellido">Apellido</FieldLabel>
                    <Input
                      id="apellido"
                      required={modo === 'nuevo'}
                      maxLength={80}
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="email-nuevo">Email</FieldLabel>
                    <Input
                      id="email-nuevo"
                      type="email"
                      required={modo === 'nuevo'}
                      value={emailNuevo}
                      onChange={(e) => setEmailNuevo(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Contraseña inicial</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      required={modo === 'nuevo'}
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <FieldDescription>Mínimo 8 caracteres. Después la cambia desde su perfil.</FieldDescription>
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
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Vínculo</FieldLabel>
              <Select value={vinculo} onValueChange={(v) => setVinculo(v as VinculoUnidad)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VINCULOS).map(([clave, etiqueta]) => (
                    <SelectItem key={clave} value={clave}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="desde">Desde</FieldLabel>
              <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              <FieldDescription>Vacío: desde hoy.</FieldDescription>
            </Field>
          </div>

          <Field orientation="horizontal" className="rounded-lg bg-muted px-3 py-2.5">
            <Switch id="titular" checked={esTitular} onCheckedChange={setEsTitular} disabled={hayTitular} />
            <FieldLabel htmlFor="titular" className="font-normal text-secondary-foreground">
              {hayTitular
                ? 'Ya hay un titular vigente: para cambiarlo, terminá antes su vínculo'
                : 'Titular de la unidad (responsable principal)'}
            </FieldLabel>
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
            <Button type="submit" disabled={!listo || enviando}>
              <UserPlus data-icon="inline-start" />
              {enviando ? 'Vinculando…' : 'Vincular'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
