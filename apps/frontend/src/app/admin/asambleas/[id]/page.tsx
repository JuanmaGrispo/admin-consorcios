'use client';

import { CalendarClock, Link2, MapPin, Pencil, Play, Plus, Send, Square, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { AsambleaDialog, type ValoresAsamblea } from '@/components/asambleas/asamblea-dialog';
import { MODALIDADES, TIPOS } from '@/components/asambleas/etiquetas';
import { OrdenDelDia } from '@/components/asambleas/orden-del-dia';
import { TablaAsistencia } from '@/components/asambleas/tabla-asistencia';
import { TarjetaActa } from '@/components/asambleas/tarjeta-acta';
import { TarjetaQuorum } from '@/components/asambleas/tarjeta-quorum';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { EstadoBadge } from '@/components/estado-badge';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DetalleVotacionAdmin } from '@/components/votaciones/detalle-votacion-admin';
import { VotacionDialog, type ValoresVotacion } from '@/components/votaciones/votacion-dialog';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { fechaHora } from '@/lib/formato';
import { asambleasService } from '@/services/asambleas';
import { votacionesService } from '@/services/votaciones';
import type { EstadoAsistencia, PuntoOrdenDia } from '@/types/asamblea';
import type { Votacion } from '@/types/votacion';

type Accion = 'convocar' | 'iniciar' | 'cerrar' | 'eliminar';

/** Qué votación se está armando: una nueva de la asamblea o la de un punto del orden del día. */
type NuevaVotacion = { punto?: PuntoOrdenDia };
type EdicionVotacion = { modo: 'cerrado' } | { modo: 'alta'; nueva: NuevaVotacion } | { modo: 'edicion'; votacion: Votacion };

const CONFIRMACIONES: Record<Accion, { titulo: string; descripcion: string; boton: string; aviso: string }> = {
  convocar: {
    titulo: '¿Convocar la asamblea?',
    descripcion:
      'Se arma el padrón de asistencia con el coeficiente actual de cada unidad y se avisa a los vecinos. Después ya no se edita.',
    boton: 'Convocar',
    aviso: 'Asamblea convocada: los vecinos ya pueden confirmar',
  },
  iniciar: {
    titulo: '¿Iniciar la asamblea?',
    descripcion: 'Pasa a “en curso”. No hace falta que ya haya quórum.',
    boton: 'Iniciar',
    aviso: 'Asamblea en curso',
  },
  cerrar: {
    titulo: '¿Cerrar la asamblea?',
    descripcion:
      'Queda cerrada, o cerrada sin quórum si no se alcanzó el porcentaje requerido. Después se sube el acta.',
    boton: 'Cerrar asamblea',
    aviso: 'Asamblea cerrada',
  },
  eliminar: {
    titulo: '¿Eliminar la asamblea?',
    descripcion: 'Es un borrador: se borra con su orden del día y no se puede recuperar.',
    boton: 'Eliminar',
    aviso: 'Asamblea eliminada',
  },
};

export default function AdminAsambleaDetallePage() {
  const { consorcio } = useConsorcioActivo();
  const { id } = useParams<{ id: string }>();
  // Otro edificio o otra asamblea arrancan de cero.
  return <DetalleAsamblea key={`${consorcio.id}-${id}`} id={id} />;
}

/** Una asamblea llevada de punta a punta: edición, convocatoria, quórum, asistencia, votaciones y acta. */
function DetalleAsamblea({ id }: { id: string }) {
  const { consorcio } = useConsorcioActivo();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [votacion, setVotacion] = useState<EdicionVotacion>({ modo: 'cerrado' });
  // Se guarda el id: la votación del panel sale siempre de la lista recién pedida.
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const pedido = usePedido(
    `asamblea:${id}`,
    async () => {
      const asamblea = await asambleasService.obtener(id);
      // El padrón existe desde que se convoca; las votaciones, desde el borrador.
      const [asistencias, votaciones] = await Promise.all([
        asamblea.estado === 'BORRADOR' ? Promise.resolve(null) : asambleasService.listarAsistencias(id),
        votacionesService.listar({ asambleaId: id }),
      ]);
      return { asamblea, asistencias, votaciones };
    },
    'No se pudo cargar la asamblea.',
  );
  const asamblea = pedido.datos?.asamblea ?? null;
  const asistencias = pedido.datos?.asistencias ?? null;
  const votaciones = pedido.datos?.votaciones ?? [];
  const error = pedido.error ?? null;
  const seleccionada = votaciones.find((v) => v.id === seleccionadaId) ?? null;
  const recargar = pedido.recargar;

  async function editar(valores: ValoresAsamblea) {
    if (!asamblea) return;
    // El backend exige fecha futura cada vez que la recibe: si no cambió, no se
    // manda, así un borrador vencido se puede editar sin tocarle la fecha.
    const mismaFecha = new Date(valores.fechaHora).getTime() === new Date(asamblea.fechaHora).getTime();
    // El orden del día de una existente se edita aparte, con su propio endpoint.
    await asambleasService.actualizar(id, {
      titulo: valores.titulo,
      tipo: valores.tipo,
      modalidad: valores.modalidad,
      fechaHora: mismaFecha ? undefined : valores.fechaHora,
      lugar: valores.lugar,
      linkVideollamada: valores.linkVideollamada,
      quorumRequerido: valores.quorumRequerido,
    });
    toast.success('Asamblea actualizada');
    setEditando(false);
    recargar();
  }

  async function ejecutar(que: Accion) {
    if (que === 'eliminar') {
      await asambleasService.eliminar(id);
    } else {
      await asambleasService[que](id);
    }
    toast.success(CONFIRMACIONES[que].aviso);
    if (que === 'eliminar') router.replace('/admin/asambleas');
    else recargar();
  }

  async function registrar(
    unidadId: string,
    datos: { estado: EstadoAsistencia; apoderadoUnidadId?: string },
  ) {
    try {
      await asambleasService.registrarAsistencia(id, unidadId, datos);
      toast.success('Asistencia registrada');
      recargar();
    } catch (err) {
      // El diálogo de poder muestra el error adentro: se relanza sin toast para no avisarlo dos veces.
      if (datos.estado === 'CON_PODER') throw err;
      toast.error(err instanceof ApiError ? err.message : 'No se pudo registrar la asistencia.');
    }
  }

  async function guardarVotacion(valores: ValoresVotacion) {
    const { opciones, ...resto } = valores;
    if (votacion.modo === 'edicion') {
      const { id: votacionId } = votacion.votacion;
      await votacionesService.actualizar(votacionId, resto);
      await votacionesService.reemplazarOpciones(votacionId, opciones);
      toast.success('Votación actualizada');
    } else if (votacion.modo === 'alta') {
      if (!asamblea) return;
      // El de la asamblea, no el activo: se puede llegar por link desde otro edificio.
      await votacionesService.crear({
        consorcioId: asamblea.consorcioId,
        ...(votacion.nueva.punto ? { puntoOrdenDiaId: votacion.nueva.punto.id } : { asambleaId: id }),
        ...resto,
        opciones,
      });
      toast.success('Votación creada en borrador');
    }
    setVotacion({ modo: 'cerrado' });
    recargar();
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader titulo="Asamblea" volverA="/admin/asambleas" />
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!asamblea) return <DetalleEsqueleto />;

  const estado = asamblea.estado;
  const sinCerrar = estado === 'BORRADOR' || estado === 'CONVOCADA' || estado === 'EN_CURSO';
  const confirmacion = accion ? CONFIRMACIONES[accion] : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        volverA="/admin/asambleas"
        titulo={asamblea.titulo}
        contexto={`Asamblea ${TIPOS[asamblea.tipo].toLowerCase()}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" />
              {fechaHora(asamblea.fechaHora)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {MODALIDADES[asamblea.modalidad]}
              {asamblea.lugar && ` · ${asamblea.lugar}`}
            </span>
            {asamblea.linkVideollamada && (
              <a
                href={asamblea.linkVideollamada}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Link2 className="size-4" />
                Videollamada
              </a>
            )}
          </span>
        }
        acciones={
          <>
            <EstadoBadge dominio="asamblea" estado={estado} />
            {estado === 'BORRADOR' && (
              <>
                <Button variant="ghost" className="text-destructive" onClick={() => setAccion('eliminar')}>
                  <Trash2 data-icon="inline-start" />
                  Eliminar
                </Button>
                <Button variant="outline" onClick={() => setEditando(true)}>
                  <Pencil data-icon="inline-start" />
                  Editar
                </Button>
                <Button onClick={() => setAccion('convocar')} disabled={asamblea.puntoOrdenDias.length === 0}>
                  <Send data-icon="inline-start" />
                  Convocar
                </Button>
              </>
            )}
            {estado === 'CONVOCADA' && (
              <Button onClick={() => setAccion('iniciar')}>
                <Play data-icon="inline-start" />
                Iniciar
              </Button>
            )}
            {estado === 'EN_CURSO' && (
              <Button onClick={() => setAccion('cerrar')}>
                <Square data-icon="inline-start" />
                Cerrar asamblea
              </Button>
            )}
          </>
        }
      />

      {estado === 'BORRADOR' && asamblea.puntoOrdenDias.length === 0 && (
        <Alert>
          <AlertDescription>Armá el orden del día para poder convocar.</AlertDescription>
        </Alert>
      )}

      {asamblea.quorum && <TarjetaQuorum quorum={asamblea.quorum} />}

      <OrdenDelDia
        puntos={asamblea.puntoOrdenDias}
        votaciones={votaciones}
        editable={estado === 'BORRADOR'}
        puedeCrearVotacion={sinCerrar}
        onGuardar={async (puntos) => {
          await asambleasService.reemplazarOrdenDia(id, puntos);
          toast.success('Orden del día actualizado');
          recargar();
        }}
        onCrearVotacion={(punto) => setVotacion({ modo: 'alta', nueva: { punto } })}
        onVerVotacion={(v) => setSeleccionadaId(v.id)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Votaciones</CardTitle>
          {sinCerrar && (
            <CardAction>
              <Button variant="outline" size="sm" onClick={() => setVotacion({ modo: 'alta', nueva: {} })}>
                <Plus data-icon="inline-start" />
                Nueva votación
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {votaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta asamblea todavía no tiene votaciones.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {votaciones.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Button
                    variant="link"
                    className="h-auto min-w-0 flex-1 justify-start truncate px-0 font-medium text-foreground"
                    onClick={() => setSeleccionadaId(v.id)}
                  >
                    {v.titulo}
                  </Button>
                  <EstadoBadge dominio="votacion" estado={v.estado} />
                  {v.resultado && <EstadoBadge dominio="resultado" estado={v.resultado} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {estado !== 'BORRADOR' && (
        <TablaAsistencia
          asistencias={asistencias}
          editable={estado === 'CONVOCADA' || estado === 'EN_CURSO'}
          onRegistrar={registrar}
        />
      )}

      <TarjetaActa asamblea={asamblea} onCargada={recargar} />

      <DetalleVotacionAdmin
        votacion={seleccionada}
        onCerrar={() => setSeleccionadaId(null)}
        onEditar={(v) => {
          setSeleccionadaId(null);
          setVotacion({ modo: 'edicion', votacion: v });
        }}
        onCambio={recargar}
      />

      {editando && (
        <AsambleaDialog
          abierto
          onOpenChange={(abierto) => !abierto && setEditando(false)}
          subtitulo={consorcio.nombre}
          asamblea={asamblea}
          onGuardar={editar}
        />
      )}

      {votacion.modo !== 'cerrado' && (
        <VotacionDialog
          abierto
          onOpenChange={(abierto) => !abierto && setVotacion({ modo: 'cerrado' })}
          consorcioId={asamblea.consorcioId}
          subtitulo={consorcio.nombre}
          asamblea={{ id, titulo: asamblea.titulo }}
          votacion={votacion.modo === 'edicion' ? votacion.votacion : undefined}
          tituloInicial={votacion.modo === 'alta' ? votacion.nueva.punto?.titulo : undefined}
          onGuardar={guardarVotacion}
        />
      )}

      <ConfirmarAccion
        abierto={accion !== null}
        titulo={confirmacion?.titulo ?? ''}
        descripcion={confirmacion?.descripcion ?? ''}
        boton={confirmacion?.boton ?? ''}
        destructiva={accion === 'eliminar'}
        onConfirmar={() => ejecutar(accion!)}
        onCerrar={() => setAccion(null)}
      />
    </div>
  );
}

function DetalleEsqueleto() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
