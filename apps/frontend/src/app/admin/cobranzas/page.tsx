'use client';

import { BellRing, Calculator, FileSpreadsheet, Search, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { DialogoRecordatorios } from '@/components/cobranzas/dialogo-recordatorios';
import { DialogoRegistrarPago } from '@/components/cobranzas/dialogo-registrar-pago';
import { TablaCobranzas, TablaCobranzasEsqueleto } from '@/components/cobranzas/tabla-cobranzas';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Paginacion } from '@/components/paginacion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { fecha, pesos, periodo as nombrePeriodo } from '@/lib/formato';
import { expensasService } from '@/services/expensas';
import { pagosService } from '@/services/pagos';
import type { Consorcio } from '@/types/consorcio';
import type { FilaCobranza, Liquidacion, SituacionBoleta } from '@/types/expensa';
import type { PagoManualInput } from '@/types/pago';

type Solapa = 'todos' | SituacionBoleta;

const SOLAPAS: { valor: Solapa; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'pagados', etiqueta: 'Pagados' },
  { valor: 'pendientes', etiqueta: 'Pendientes' },
  { valor: 'vencidos', etiqueta: 'Vencidos' },
];

type Dialogo =
  | { tipo: 'ninguno' }
  | { tipo: 'pago'; filas: FilaCobranza[] }
  | { tipo: 'recordatorios'; fila?: FilaCobranza };

export default function AdminCobranzasPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sin filtros ni la grilla anterior.
  return <Cobranzas key={consorcio.id} consorcio={consorcio} />;
}

/** El estado de cobranzas (pantalla 02): quién pagó, quién debe y qué hacer con cada uno. */
function Cobranzas({ consorcio }: { consorcio: Consorcio }) {
  const liquidaciones = usePedido(
    `liquidaciones:${consorcio.id}`,
    () => expensasService.listarLiquidaciones({ consorcioId: consorcio.id }),
    'No se pudieron cargar los períodos.',
  );
  // Sólo se cobra lo emitido.
  const emitidas = liquidaciones.datos?.filter((l) => l.estado === 'EMITIDA' || l.estado === 'CERRADA');

  if (liquidaciones.error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader titulo="Estado de cobranzas" contexto={consorcio.nombre} />
        <Alert variant="destructive">
          <AlertDescription>{liquidaciones.error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!emitidas) return <Skeleton className="h-96 w-full" />;
  if (emitidas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader titulo="Estado de cobranzas" contexto={consorcio.nombre} />
        <EmptyState
          icono={Calculator}
          titulo="Todavía no hay boletas emitidas"
          descripcion="Cuando emitas la primera liquidación, acá vas a ver quién pagó y quién debe."
          accion={
            <Button asChild>
              <Link href="/admin/liquidaciones">Ir a liquidaciones</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <Grilla consorcio={consorcio} emitidas={emitidas} />;
}

function Grilla({ consorcio, emitidas }: { consorcio: Consorcio; emitidas: Liquidacion[] }) {
  // El último período emitido: es el que se está cobrando.
  const [periodo, setPeriodo] = useState(emitidas[0].periodo.slice(0, 7));
  const [solapa, setSolapa] = useState<Solapa>('todos');
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: 'ninguno' });
  const [preparando, setPreparando] = useState(false);

  const liquidacion = emitidas.find((l) => l.periodo.slice(0, 7) === periodo);
  const alcance = { consorcioId: consorcio.id, periodo, buscar: buscar || undefined };

  const resumen = usePedido(`resumen:${periodo}:${buscar}`, () => expensasService.resumen(alcance));
  const grilla = usePedido(
    `cobranzas:${periodo}:${solapa}:${buscar}:${pagina}`,
    () =>
      expensasService.listarBoletas({
        ...alcance,
        situacion: solapa === 'todos' ? undefined : solapa,
        pagina,
      }),
    'No se pudo cargar la grilla.',
  );
  const datos = grilla.datos ?? grilla.ultimo;
  const kpis = resumen.datos ?? resumen.ultimo;

  function recargar() {
    grilla.recargar();
    resumen.recargar();
  }

  /** "Registrar pago" del encabezado: hay que elegir entre las que deben del período. */
  async function abrirPago() {
    setPreparando(true);
    try {
      const { items } = await expensasService.listarBoletas({ ...alcance, buscar: undefined, limite: 100 });
      const conSaldo = items.filter((f) => f.saldo > 0);
      if (conSaldo.length === 0) toast.info('Nadie debe nada en este período');
      else setDialogo({ tipo: 'pago', filas: conSaldo });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudieron cargar las boletas.');
    } finally {
      setPreparando(false);
    }
  }

  async function registrar(input: PagoManualInput, fila: FilaCobranza) {
    await pagosService.registrar(input);
    toast.success(`Pago de ${fila.unidad.etiqueta} registrado`);
    setDialogo({ tipo: 'ninguno' });
    recargar();
  }

  async function enviarRecordatorios(fila: FilaCobranza | undefined, opciones: { situacion?: 'pendientes' | 'vencidos'; mensaje?: string }) {
    const r = await expensasService.enviarRecordatorios(
      fila ? { boletaId: fila.id, mensaje: opciones.mensaje } : { consorcioId: consorcio.id, periodo, ...opciones },
    );
    toast.success(
      r.avisos === 0
        ? 'No había a quién avisarle'
        : `${r.avisos} ${r.avisos === 1 ? 'aviso enviado' : 'avisos enviados'}${r.sinDestinatario ? ` · ${r.sinDestinatario} sin vecino a quien avisar` : ''}`,
    );
    setDialogo({ tipo: 'ninguno' });
  }

  async function intentar(accion: () => Promise<void>, error: string) {
    try {
      await accion();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : error);
    }
  }

  const conteo = (s: Solapa) => (kpis ? kpis.conteos[s] : undefined);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Estado de cobranzas"
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={
          liquidacion &&
          `Período ${nombrePeriodo(liquidacion.periodo).toLowerCase()} · vencimiento ${fecha(liquidacion.fechaVencimiento)}${kpis ? ` · ${kpis.conteos.todos} unidades` : ''}`
        }
        acciones={
          <>
            <Button
              variant="outline"
              onClick={() => intentar(() => expensasService.exportar({ ...alcance, situacion: solapa === 'todos' ? undefined : solapa }), 'No se pudo exportar.')}
            >
              <FileSpreadsheet data-icon="inline-start" />
              Exportar a Excel
            </Button>
            <Button variant="outline" onClick={() => setDialogo({ tipo: 'recordatorios' })}>
              <BellRing data-icon="inline-start" />
              Enviar recordatorios
            </Button>
            <Button onClick={abrirPago} disabled={preparando}>
              <Wallet data-icon="inline-start" />
              Registrar pago
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Emitido del período" valor={kpis?.emitido} />
        <Kpi titulo="Cobrado" valor={kpis?.cobrado} />
        <Kpi titulo="Saldo pendiente" valor={kpis?.saldoPendiente} />
        <Kpi titulo="Intereses acumulados" valor={kpis?.interesesAcumulados} />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <form
            className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              setBuscar(texto.trim());
              setPagina(1);
            }}
          >
            <Input
              type="search"
              aria-label="Buscar unidad o propietario"
              placeholder="Buscar unidad o propietario"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
              <Search />
            </Button>
            {buscar && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setTexto('');
                  setBuscar('');
                  setPagina(1);
                }}
              >
                <X />
              </Button>
            )}
          </form>

          <ToggleGroup
            type="single"
            spacing={1}
            value={solapa}
            onValueChange={(valor) => {
              if (!valor) return;
              setSolapa(valor as Solapa);
              setPagina(1);
            }}
            className="rounded-lg border bg-muted p-0.5"
          >
            {SOLAPAS.map((s) => (
              <ToggleGroupItem
                key={s.valor}
                value={s.valor}
                size="sm"
                className="px-3 data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:shadow-xs"
              >
                {s.etiqueta}
                {conteo(s.valor) !== undefined && <span className="tabular-nums opacity-60">{conteo(s.valor)}</span>}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Select
            value={periodo}
            onValueChange={(p) => {
              setPeriodo(p);
              setPagina(1);
            }}
          >
            <SelectTrigger className="w-40 sm:ml-auto" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {emitidas.map((l) => (
                <SelectItem key={l.id} value={l.periodo.slice(0, 7)}>
                  {nombrePeriodo(l.periodo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {grilla.error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription>{grilla.error}</AlertDescription>
            </Alert>
          </div>
        ) : !datos ? (
          <TablaCobranzasEsqueleto />
        ) : datos.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {buscar ? `Nadie coincide con “${buscar}”.` : 'No hay boletas en esta solapa.'}
          </p>
        ) : (
          <>
            <TablaCobranzas
              filas={datos.items}
              onRegistrarPago={(fila) => setDialogo({ tipo: 'pago', filas: [fila] })}
              onRecordatorio={(fila) => setDialogo({ tipo: 'recordatorios', fila })}
              onBoleta={(fila) =>
                intentar(
                  () => expensasService.descargarBoleta(fila.id, `${fila.unidad.etiqueta}-${fila.periodo}`),
                  'No se pudo generar la boleta.',
                )
              }
              onRecibo={(fila) =>
                fila.ultimoPago &&
                intentar(() => pagosService.descargarRecibo(fila.ultimoPago!.id), 'No se pudo generar el recibo.')
              }
            />
            <Paginacion
              pagina={datos.pagina}
              paginas={datos.paginas}
              total={datos.total}
              mostrando={datos.items.length}
              sustantivo="boletas"
              onCambiar={setPagina}
            />
          </>
        )}
      </Card>

      {dialogo.tipo === 'pago' && (
        <DialogoRegistrarPago filas={dialogo.filas} onRegistrar={registrar} onCerrar={() => setDialogo({ tipo: 'ninguno' })} />
      )}
      {dialogo.tipo === 'recordatorios' && (
        <DialogoRecordatorios
          fila={dialogo.fila}
          periodo={liquidacion && nombrePeriodo(liquidacion.periodo)}
          onEnviar={(opciones) => enviarRecordatorios(dialogo.fila, opciones)}
          onCerrar={() => setDialogo({ tipo: 'ninguno' })}
        />
      )}
    </div>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor?: number }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{titulo}</p>
        {valor === undefined ? (
          <Skeleton className="mt-2 h-7 w-28" />
        ) : (
          <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{pesos(valor, { redondo: true })}</p>
        )}
      </CardContent>
    </Card>
  );
}
