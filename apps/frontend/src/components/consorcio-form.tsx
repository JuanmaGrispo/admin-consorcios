'use client';

import { useEffect, useState } from 'react';
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

const inputCls =
  'rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface';

function Campo({
  etiqueta,
  children,
  ancho = '',
}: {
  etiqueta: string;
  children: React.ReactNode;
  ancho?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${ancho}`}>
      <span className="text-xs font-medium tracking-wide text-ink-2 uppercase">
        {etiqueta}
      </span>
      {children}
    </label>
  );
}

function Seccion({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {detalle && <p className="mt-0.5 text-xs text-muted">{detalle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
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
      <Seccion titulo="Identidad">
        <div className="grid grid-cols-3 gap-4">
          <Campo etiqueta="Nombre" ancho="col-span-2">
            <input
              required
              value={campos.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Edificio Libertador 1234"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Estado">
            <button
              type="button"
              onClick={() => set('activo', !campos.activo)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium ${
                campos.activo
                  ? 'border-line bg-ok-soft text-ok'
                  : 'border-line bg-bad-soft text-bad'
              }`}
            >
              {campos.activo ? 'Activo' : 'Inactivo'}
              <span className="text-xs opacity-70">cambiar</span>
            </button>
          </Campo>
        </div>
      </Seccion>

      <Seccion
        titulo="Administrador"
        detalle="El responsable del consorcio en la plataforma. Tiene que ser un usuario con rol ADMINISTRADOR."
      >
        <div className="grid grid-cols-3 gap-4">
          <Campo etiqueta="Administrador asignado" ancho="col-span-2">
            <select
              value={campos.administradorId}
              onChange={(e) => set('administradorId', e.target.value)}
              className={inputCls}
            >
              <option value="">Elegir…</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.apellido}, {a.nombre} · {a.email}
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setCreandoAdmin((v) => !v)}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink-2 hover:bg-accent-soft hover:text-accent"
            >
              {creandoAdmin ? 'Cancelar' : '+ Crear administrador'}
            </button>
          </div>
        </div>

        {creandoAdmin && (
          <div className="mt-4 rounded-lg border border-line-2 bg-surface-2 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Nombre">
                <input
                  value={nuevoAdmin.nombre}
                  onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, nombre: e.target.value })}
                  className={inputCls}
                />
              </Campo>
              <Campo etiqueta="Apellido">
                <input
                  value={nuevoAdmin.apellido}
                  onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, apellido: e.target.value })}
                  className={inputCls}
                />
              </Campo>
              <Campo etiqueta="Email">
                <input
                  type="email"
                  value={nuevoAdmin.email}
                  onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, email: e.target.value })}
                  className={inputCls}
                />
              </Campo>
              <Campo etiqueta="Contraseña (mín. 8)">
                <input
                  type="password"
                  value={nuevoAdmin.password}
                  onChange={(e) => setNuevoAdmin({ ...nuevoAdmin, password: e.target.value })}
                  className={inputCls}
                />
              </Campo>
            </div>
            {errorAdmin && <p className="mt-3 text-sm text-bad">{errorAdmin}</p>}
            <button
              type="button"
              onClick={crearAdmin}
              disabled={guardandoAdmin}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {guardandoAdmin ? 'Creando…' : 'Crear y asignar'}
            </button>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Domicilio">
        <div className="grid grid-cols-6 gap-4">
          <Campo etiqueta="Calle" ancho="col-span-3">
            <input value={campos.calle} onChange={(e) => set('calle', e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Número">
            <input value={campos.numero} onChange={(e) => set('numero', e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Barrio" ancho="col-span-2">
            <input value={campos.barrio} onChange={(e) => set('barrio', e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Ciudad" ancho="col-span-2">
            <input value={campos.ciudad} onChange={(e) => set('ciudad', e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Provincia" ancho="col-span-2">
            <input value={campos.provincia} onChange={(e) => set('provincia', e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Código postal" ancho="col-span-2">
            <input value={campos.cp} onChange={(e) => set('cp', e.target.value)} className={inputCls} />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Datos fiscales">
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="CUIT">
            <input
              value={campos.cuit}
              onChange={(e) => set('cuit', e.target.value)}
              placeholder="30-12345678-9"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="CBU (cuenta del consorcio)">
            <input
              value={campos.cbu}
              onChange={(e) => set('cbu', e.target.value)}
              maxLength={22}
              className={inputCls}
            />
          </Campo>
        </div>
      </Seccion>

      <Seccion
        titulo="Reglas de liquidación"
        detalle="Parámetros con los que se emiten las expensas de este consorcio."
      >
        <div className="grid grid-cols-5 gap-4">
          <Campo etiqueta="Día de vencimiento">
            <input
              type="number"
              min={1}
              max={31}
              value={campos.diaVencimiento}
              onChange={(e) => set('diaVencimiento', e.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Interés por mora (%)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={campos.tasaInteresMora}
              onChange={(e) => set('tasaInteresMora', e.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Periodicidad de mora">
            <select
              value={campos.periodicidadMora}
              onChange={(e) => set('periodicidadMora', e.target.value as PeriodicidadMora)}
              className={inputCls}
            >
              <option value="MENSUAL">Mensual</option>
              <option value="DIARIA">Diaria</option>
            </select>
          </Campo>
          <Campo etiqueta="Fondo de reserva (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={campos.porcentajeFondoReserva}
              onChange={(e) => set('porcentajeFondoReserva', e.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Quórum asambleas (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={campos.quorumDefault}
              onChange={(e) => set('quorumDefault', e.target.value)}
              className={inputCls}
            />
          </Campo>
        </div>
      </Seccion>

      {error && (
        <p className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? 'Guardando…' : textoBoton}
        </button>
      </div>
    </form>
  );
}
