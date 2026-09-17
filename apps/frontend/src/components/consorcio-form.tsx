'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { usuariosService } from '@/services/usuarios';
import type { Consorcio, ConsorcioInput, PeriodicidadMora } from '@/types/consorcio';
import type { Usuario } from '@/types/usuario';

interface Props {
  inicial?: Consorcio;
  textoBoton: string;
  onSubmit: (input: ConsorcioInput) => Promise<void>;
}

/** Estado del form: todo string (lo que hay en los inputs), se convierte al enviar. */
interface Campos {
  nombre: string;
  administradorId: string;
  calle: string;
  numero: string;
  barrio: string;
  ciudad: string;
  provincia: string;
  cp: string;
  cuit: string;
  cbu: string;
  diaVencimiento: string;
  tasaInteresMora: string;
  periodicidadMora: PeriodicidadMora;
  porcentajeFondoReserva: string;
  quorumDefault: string;
  activo: boolean;
}

function desdeConsorcio(c?: Consorcio): Campos {
  return {
    nombre: c?.nombre ?? '',
    administradorId: c?.administradorId ?? '',
    calle: c?.calle ?? '',
    numero: c?.numero ?? '',
    barrio: c?.barrio ?? '',
    ciudad: c?.ciudad ?? '',
    provincia: c?.provincia ?? '',
    cp: c?.cp ?? '',
    cuit: c?.cuit ?? '',
    cbu: c?.cbu ?? '',
    diaVencimiento: String(c?.diaVencimiento ?? 10),
    tasaInteresMora: String(c?.tasaInteresMora ?? 0),
    periodicidadMora: c?.periodicidadMora ?? 'MENSUAL',
    porcentajeFondoReserva: String(c?.porcentajeFondoReserva ?? 5),
    quorumDefault: String(c?.quorumDefault ?? 60),
    activo: c?.activo ?? true,
  };
}

export function ConsorcioForm({ inicial, textoBoton, onSubmit }: Props) {
  const [campos, setCampos] = useState<Campos>(() => desdeConsorcio(inicial));
  const [admins, setAdmins] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Alta de administrador inline, para no salir del flujo de crear consorcio.
  const [creandoAdmin, setCreandoAdmin] = useState(false);
  const [nuevoAdmin, setNuevoAdmin] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
  });
  const [errorAdmin, setErrorAdmin] = useState<string | null>(null);
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);

  useEffect(() => {
    usuariosService
      .administradores()
      .then(setAdmins)
      .catch(() => setError('No se pudo cargar la lista de administradores.'));
  }, []);

  function set<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
  }

  async function crearAdmin() {
    setErrorAdmin(null);
    setGuardandoAdmin(true);
    try {
      const creado = await usuariosService.create(nuevoAdmin);
      setAdmins((prev) =>
        [...prev, creado].sort((a, b) => a.apellido.localeCompare(b.apellido)),
      );
      set('administradorId', creado.id);
      setCreandoAdmin(false);
      setNuevoAdmin({ nombre: '', apellido: '', email: '', password: '' });
    } catch (err) {
      setErrorAdmin(
        err instanceof ApiError ? err.message : 'No se pudo crear el administrador.',
      );
    } finally {
      setGuardandoAdmin(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!campos.administradorId) {
      setError('Asigná un administrador: todo consorcio tiene uno responsable.');
      return;
    }

    setEnviando(true);
    try {
      await onSubmit({
        nombre: campos.nombre.trim(),
        administradorId: campos.administradorId,
        calle: campos.calle.trim() || undefined,
        numero: campos.numero.trim() || undefined,
        barrio: campos.barrio.trim() || undefined,
        ciudad: campos.ciudad.trim() || undefined,
        provincia: campos.provincia.trim() || undefined,
        cp: campos.cp.trim() || undefined,
        cuit: campos.cuit.trim() || undefined,
        cbu: campos.cbu.trim() || undefined,
        diaVencimiento: Number(campos.diaVencimiento),
        tasaInteresMora: Number(campos.tasaInteresMora),
        periodicidadMora: campos.periodicidadMora,
        porcentajeFondoReserva: Number(campos.porcentajeFondoReserva),
        quorumDefault: Number(campos.quorumDefault),
        activo: campos.activo,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
            <Input
              id="nombre"
              required
              value={campos.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Edificio Libertador 1234"
            />
          </Field>
          <Field orientation="horizontal" className="sm:mt-6">
            <Switch
              id="activo"
              checked={campos.activo}
              onCheckedChange={(v) => set('activo', v)}
            />
            <FieldLabel htmlFor="activo">{campos.activo ? 'Activo' : 'Inactivo'}</FieldLabel>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrador</CardTitle>
          <CardDescription>
            El responsable del consorcio en la plataforma. Tiene que ser un
            usuario con rol ADMINISTRADOR.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="administrador">Administrador asignado</FieldLabel>
              <Select
                value={campos.administradorId}
                onValueChange={(v) => set('administradorId', v)}
              >
                <SelectTrigger id="administrador" className="w-full">
                  <SelectValue placeholder="Elegir…" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.apellido}, {a.nombre} · {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex sm:items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setCreandoAdmin((v) => !v)}
              >
                {creandoAdmin ? 'Cancelar' : '+ Crear administrador'}
              </Button>
            </div>
          </div>

          {creandoAdmin && (
            <div className="rounded-lg bg-muted p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="adm-nombre">Nombre</FieldLabel>
                  <Input
                    id="adm-nombre"
                    value={nuevoAdmin.nombre}
                    onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, nombre: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="adm-apellido">Apellido</FieldLabel>
                  <Input
                    id="adm-apellido"
                    value={nuevoAdmin.apellido}
                    onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, apellido: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="adm-email">Email</FieldLabel>
                  <Input
                    id="adm-email"
                    type="email"
                    value={nuevoAdmin.email}
                    onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, email: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="adm-password">Contraseña</FieldLabel>
                  <Input
                    id="adm-password"
                    type="password"
                    value={nuevoAdmin.password}
                    onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, password: e.target.value })}
                  />
                  <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
                </Field>
              </div>
              {errorAdmin && (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription>{errorAdmin}</AlertDescription>
                </Alert>
              )}
              <Button
                type="button"
                onClick={crearAdmin}
                disabled={guardandoAdmin}
                className="mt-3"
              >
                {guardandoAdmin ? 'Creando…' : 'Crear y asignar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domicilio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field className="sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="calle">Calle</FieldLabel>
            <Input id="calle" value={campos.calle} onChange={(e) => set('calle', e.target.value)} />
          </Field>
          <Field className="lg:col-span-1">
            <FieldLabel htmlFor="numero">Número</FieldLabel>
            <Input id="numero" value={campos.numero} onChange={(e) => set('numero', e.target.value)} />
          </Field>
          <Field className="lg:col-span-2">
            <FieldLabel htmlFor="barrio">Barrio</FieldLabel>
            <Input id="barrio" value={campos.barrio} onChange={(e) => set('barrio', e.target.value)} />
          </Field>
          <Field className="lg:col-span-2">
            <FieldLabel htmlFor="ciudad">Ciudad</FieldLabel>
            <Input id="ciudad" value={campos.ciudad} onChange={(e) => set('ciudad', e.target.value)} />
          </Field>
          <Field className="lg:col-span-2">
            <FieldLabel htmlFor="provincia">Provincia</FieldLabel>
            <Input id="provincia" value={campos.provincia} onChange={(e) => set('provincia', e.target.value)} />
          </Field>
          <Field className="lg:col-span-2">
            <FieldLabel htmlFor="cp">Código postal</FieldLabel>
            <Input id="cp" value={campos.cp} onChange={(e) => set('cp', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="cuit">CUIT</FieldLabel>
            <Input
              id="cuit"
              value={campos.cuit}
              onChange={(e) => set('cuit', e.target.value)}
              placeholder="30-12345678-9"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cbu">CBU (cuenta del consorcio)</FieldLabel>
            <Input
              id="cbu"
              value={campos.cbu}
              onChange={(e) => set('cbu', e.target.value)}
              maxLength={22}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de liquidación</CardTitle>
          <CardDescription>
            Parámetros con los que se emiten las expensas de este consorcio.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field>
            <FieldLabel htmlFor="vencimiento">Día de vencimiento</FieldLabel>
            <Input
              id="vencimiento"
              type="number"
              min={1}
              max={31}
              value={campos.diaVencimiento}
              onChange={(e) => set('diaVencimiento', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mora">Interés por mora (%)</FieldLabel>
            <Input
              id="mora"
              type="number"
              min={0}
              step="0.01"
              value={campos.tasaInteresMora}
              onChange={(e) => set('tasaInteresMora', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="periodicidad">Periodicidad de mora</FieldLabel>
            <Select
              value={campos.periodicidadMora}
              onValueChange={(v) => set('periodicidadMora', v as PeriodicidadMora)}
            >
              <SelectTrigger id="periodicidad" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MENSUAL">Mensual</SelectItem>
                <SelectItem value="DIARIA">Diaria</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="reserva">Fondo de reserva (%)</FieldLabel>
            <Input
              id="reserva"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={campos.porcentajeFondoReserva}
              onChange={(e) => set('porcentajeFondoReserva', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="quorum">Quórum asambleas (%)</FieldLabel>
            <Input
              id="quorum"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={campos.quorumDefault}
              onChange={(e) => set('quorumDefault', e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={enviando} className="w-full sm:w-auto">
          {enviando ? 'Guardando…' : textoBoton}
        </Button>
      </div>
    </form>
  );
}
