'use client';

import { ArrowRight, Calculator, Lock, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { EmptyState } from '@/components/empty-state';
import { EstadoBadge } from '@/components/estado-badge';
import { BoletasLiquidacion } from '@/components/expensas/boletas-liquidacion';
import { DialogoNuevaLiquidacion } from '@/components/expensas/dialogo-nueva-liquidacion';
import { CRITERIOS, esEditable } from '@/components/expensas/etiquetas';
import { GastoDialog } from '@/components/expensas/gasto-dialog';
import { PasosLiquidacion } from '@/components/expensas/pasos-liquidacion';
import { TablaGastos } from '@/components/expensas/tabla-gastos';
import { TarjetaProrrateo } from '@/components/expensas/tarjeta-prorrateo';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { fecha, periodo as nombrePeriodo } from '@/lib/formato';
import { expensasService } from '@/services/expensas';
import type { Consorcio } from '@/types/consorcio';
import type { Gasto, GastoInput, Liquidacion, LiquidacionCambios, LiquidacionInput } from '@/types/expensa';

type Accion = 'emitir' | 'cerrar' | 'eliminar' | { gasto: Gasto };
type EdicionGasto = { modo: 'cerrado' } | { modo: 'alta' } | { modo: 'edicion'; gasto: Gasto };

/** El mes que sigue a "2026-08-01" → "2026-09". Sin liquidaciones, el mes actual. */
function periodoSiguiente(ultima?: Liquidacion): string {
  if (!ultima) return new Date().toISOString().slice(0, 7);
  const [anio, mes] = ultima.periodo.split('-').map(Number);
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

export default function AdminLiquidacionesPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sin la liquidación elegida antes.
  return <Liquidaciones key={consorcio.id} consorcio={consorcio} />;
}

/** La liquidación de expensas (pantalla 03): gastos → prorrateo → previsualización → emisión. */
function Liquidaciones({ consorcio }: { consorcio: Consorcio }) {
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const lista = usePedido(
    `liquidaciones:${consorcio.id}`,
    () => expensasService.listarLiquidaciones({ consorcioId: consorcio.id }),
    'No se pudieron cargar las liquidaciones.',
  );
  const liquidaciones = lista.datos ?? lista.ultimo ?? null;
  // Sin elegir, la más reciente que no esté cerrada: es la que se está trabajando.
  const id = elegidaId ?? liquidaciones?.find((l) => l.estado !== 'CERRADA')?.id ?? liquidaciones?.[0]?.id ?? null;

  async function crear(input: Omit<LiquidacionInput, 'consorcioId'>) {
    const nueva = await expensasService.crearLiquidacion({ consorcioId: consorcio.id, ...input });
    toast.success(`Liquidación de ${nombrePeriodo(nueva.periodo).toLowerCase()} abierta`);
    setCreando(false);
    setElegidaId(nueva.id);
    lista.recargar();
  }

  const nueva = (
    <Button variant={liquidaciones?.length ? 'outline' : 'default'} onClick={() => setCreando(true)}>
      <Plus data-icon="inline-start" />
      Nueva liquidación
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {lista.error ? (
        <>
          <PageHeader titulo="Liquidación de expensas" contexto={consorcio.nombre} />
          <Alert variant="destructive">
            <AlertDescription>{lista.error}</AlertDescription>
          </Alert>
        </>
      ) : !liquidaciones ? (
        <Skeleton className="h-96 w-full" />
      ) : liquidaciones.length === 0 || !id ? (
        <>
          <PageHeader titulo="Liquidación de expensas" contexto={consorcio.nombre} acciones={nueva} />
          <EmptyState
            icono={Calculator}
            titulo="Todavía no hay liquidaciones"
            descripcion="Abrí la del mes: cargás los gastos, el sistema reparte el total entre las unidades y emitís las boletas."
            accion={nueva}
          />
        </>
      ) : (
        <DetalleLiquidacion
          key={id}
          id={id}
          consorcio={consorcio}
          liquidaciones={liquidaciones}
          onElegir={setElegidaId}
          onCambio={lista.recargar}
          onBorrada={() => {
            setElegidaId(null);
            lista.recargar();
          }}
          accionNueva={nueva}
        />
      )}

      {creando && (
        <DialogoNuevaLiquidacion
          subtitulo={consorcio.nombre}
          periodoSugerido={periodoSiguiente(liquidaciones?.[0])}
          onCrear={crear}
          onCerrar={() => setCreando(false)}
        />
      )}
    </div>
  );
}

interface DetalleLiquidacionProps {
  id: string;
  consorcio: Consorcio;
  liquidaciones: Liquidacion[];
  onElegir: (id: string) => void;
  /** Cambió el estado o los totales: que el selector de períodos se entere. */
  onCambio: () => void;
  onBorrada: () => void;
  accionNueva: React.ReactNode;
}

function DetalleLiquidacion({
  id,
  consorcio,
  liquidaciones,
  onElegir,
  onCambio,
  onBorrada,
  accionNueva,
}: DetalleLiquidacionProps) {
  const [edicion, setEdicion] = useState<EdicionGasto>({ modo: 'cerrado' });
  const [accion, setAccion] = useState<Accion | null>(null);
  const [calculando, setCalculando] = useState(false);
  // Sube con cada cambio que mueve las boletas: la tabla de boletas se vuelve a pedir.
  const [version, setVersion] = useState(0);

  const pedido = usePedido(`liquidacion:${id}`, () => expensasService.obtenerLiquidacion(id), 'No se pudo cargar la liquidación.');
  const liquidacion = pedido.datos ?? pedido.ultimo;

  function huboCambios() {
    pedido.recargar();
    setVersion((v) => v + 1);
    onCambio();
  }

  async function guardarGasto(input: GastoInput) {
    if (edicion.modo === 'edicion') {
      await expensasService.actualizarGasto(id, edicion.gasto.id, input);
      toast.success('Gasto actualizado');
    } else {
      await expensasService.agregarGasto(id, input);
      toast.success('Gasto agregado');
    }
    setEdicion({ modo: 'cerrado' });
    huboCambios();
  }

  async function cambiarProrrateo(cambios: LiquidacionCambios) {
    await expensasService.actualizarLiquidacion(id, cambios);
    toast.success('Prorrateo actualizado');
    huboCambios();
  }

  async function previsualizar() {
    setCalculando(true);
    try {
      await expensasService.previsualizar(id);
      toast.success('Boletas calculadas');
      huboCambios();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudieron calcular las boletas.');
    } finally {
      setCalculando(false);
    }
  }

  if (pedido.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{pedido.error}</AlertDescription>
      </Alert>
    );
  }
  if (!liquidacion) return <Skeleton className="h-96 w-full" />;

  const editable = esEditable(liquidacion.estado);
  const nombre = nombrePeriodo(liquidacion.periodo);

  const confirmacion =
    accion === 'emitir'
      ? {
          titulo: `¿Emitir las boletas de ${nombre.toLowerCase()}?`,
          descripcion:
            'Se recalculan por última vez, quedan congeladas y les llegan a los vecinos. No se puede deshacer.',
          boton: 'Emitir boletas',
          destructiva: false,
          hacer: async () => {
            await expensasService.emitir(id);
            toast.success('Boletas emitidas: ya les llegaron a los vecinos');
          },
        }
      : accion === 'cerrar'
        ? {
            titulo: `¿Cerrar la liquidación de ${nombre.toLowerCase()}?`,
            descripcion: 'Da el período por terminado. Las boletas siguen vigentes como deuda y se pueden seguir cobrando.',
            boton: 'Cerrar liquidación',
            destructiva: false,
            hacer: async () => {
              await expensasService.cerrar(id);
              toast.success('Liquidación cerrada');
            },
          }
        : accion === 'eliminar'
          ? {
              titulo: `¿Eliminar la liquidación de ${nombre.toLowerCase()}?`,
              descripcion: 'Se borra con sus gastos y boletas. No se emitió, así que ningún vecino la vio.',
              boton: 'Eliminar',
              destructiva: true,
              hacer: async () => {
                await expensasService.borrarLiquidacion(id);
                toast.success('Liquidación eliminada');
              },
            }
          : accion
            ? {
                titulo: `¿Borrar “${accion.gasto.descripcion}”?`,
                descripcion: 'Sale del total del período. Si las boletas estaban calculadas, se recalculan.',
                boton: 'Borrar gasto',
                destructiva: true,
                hacer: async () => {
                  await expensasService.borrarGasto(id, accion.gasto.id);
                  toast.success('Gasto borrado');
                },
              }
            : null;

  return (
    <>
      <PageHeader
        titulo={`Liquidación de ${nombre.toLowerCase()}`}
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={`${CRITERIOS[liquidacion.criterioProrrateo].etiqueta.toLowerCase()} · vencimiento ${fecha(liquidacion.fechaVencimiento)}`}
        acciones={
          <>
            <Select value={id} onValueChange={onElegir}>
              <SelectTrigger className="w-44" aria-label="Período">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {liquidaciones.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {nombrePeriodo(l.periodo)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accionNueva}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <EstadoBadge dominio="liquidacion" estado={liquidacion.estado} />
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button variant="ghost" className="text-destructive" onClick={() => setAccion('eliminar')}>
              <Trash2 data-icon="inline-start" />
              Eliminar
            </Button>
          )}
          {liquidacion.estado === 'BORRADOR' && (
            <Button onClick={previsualizar} disabled={calculando || liquidacion.gastos.length === 0}>
              <ArrowRight data-icon="inline-start" />
              {calculando ? 'Calculando…' : 'Continuar a previsualización'}
            </Button>
          )}
          {liquidacion.estado === 'PREVISUALIZACION' && (
            <>
              <Button variant="outline" onClick={previsualizar} disabled={calculando}>
                <RefreshCw data-icon="inline-start" />
                {calculando ? 'Calculando…' : 'Recalcular'}
              </Button>
              <Button onClick={() => setAccion('emitir')}>
                <Send data-icon="inline-start" />
                Emitir boletas
              </Button>
            </>
          )}
          {liquidacion.estado === 'EMITIDA' && (
            <Button variant="outline" onClick={() => setAccion('cerrar')}>
              <Lock data-icon="inline-start" />
              Cerrar liquidación
            </Button>
          )}
          {(liquidacion.estado === 'EMITIDA' || liquidacion.estado === 'CERRADA') && (
            <Button asChild>
              <Link href="/admin/cobranzas">
                <ArrowRight data-icon="inline-start" />
                Ver cobranzas
              </Link>
            </Button>
          )}
        </div>
      </div>

      <PasosLiquidacion estado={liquidacion.estado} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <TablaGastos
          gastos={liquidacion.gastos}
          total={liquidacion.totalGastos}
          editable={editable}
          onAgregar={() => setEdicion({ modo: 'alta' })}
          onEditar={(gasto) => setEdicion({ modo: 'edicion', gasto })}
          onBorrar={(gasto) => setAccion({ gasto })}
        />
        <TarjetaProrrateo liquidacion={liquidacion} editable={editable} onCambiar={cambiarProrrateo} />
      </div>

      {liquidacion.estado !== 'BORRADOR' && <BoletasLiquidacion liquidacion={liquidacion} version={version} />}

      {edicion.modo !== 'cerrado' && (
        <GastoDialog
          consorcioId={consorcio.id}
          subtitulo={`Liquidación de ${nombre.toLowerCase()}`}
          gasto={edicion.modo === 'edicion' ? edicion.gasto : undefined}
          onGuardar={guardarGasto}
          onCerrar={() => setEdicion({ modo: 'cerrado' })}
        />
      )}

      <ConfirmarAccion
        abierto={confirmacion !== null}
        titulo={confirmacion?.titulo ?? ''}
        descripcion={confirmacion?.descripcion ?? ''}
        boton={confirmacion?.boton ?? ''}
        destructiva={confirmacion?.destructiva ?? true}
        onConfirmar={async () => {
          if (!confirmacion) return;
          await confirmacion.hacer();
          if (accion === 'eliminar') onBorrada();
          else huboCambios();
        }}
        onCerrar={() => setAccion(null)}
      />
    </>
  );
}
