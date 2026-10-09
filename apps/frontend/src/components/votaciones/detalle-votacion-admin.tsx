'use client';

import { Download, Pencil, Send, Trash2, Vote } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { EstadoBadge } from '@/components/estado-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import { fechaHora, porcentaje } from '@/lib/formato';
import { votacionesService } from '@/services/votaciones';
import type { FilaPadron, Votacion, VotacionDetalle } from '@/types/votacion';
import { DESEMPATES, FORMAS_CONTEO, MAYORIAS } from './etiquetas';
import { EscrutinioBarras } from './escrutinio-barras';

interface DetalleVotacionAdminProps {
  /** La fila del listado: trae las reglas con el `padron` como enum, que el detalle pisa. */
  votacion: Votacion | null;
  onCerrar: () => void;
  onEditar: (votacion: Votacion) => void;
  /** Después de publicar, cerrar, eliminar o cargar un voto: que la página recargue. */
  onCambio: () => void;
}

/**
 * Una votación vista por el administrador, en un panel lateral: reglas,
 * conteo, padrón con quién votó y las acciones del ciclo (publicar, cerrar,
 * editar, borrar, cargar un voto presencial).
 */
export function DetalleVotacionAdmin({ votacion, onCerrar, onEditar, onCambio }: DetalleVotacionAdminProps) {
  return (
    <Sheet open={votacion !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {/* Se monta con la votación elegida: cada una carga de cero. */}
        {votacion && (
          <Contenido key={votacion.id} votacion={votacion} onCerrar={onCerrar} onEditar={onEditar} onCambio={onCambio} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Contenido({
  votacion,
  onCerrar,
  onEditar,
  onCambio,
}: {
  votacion: Votacion;
  onCerrar: () => void;
  onEditar: (votacion: Votacion) => void;
  onCambio: () => void;
}) {
  const [detalle, setDetalle] = useState<VotacionDetalle | null>(null);
  const [padron, setPadron] = useState<FilaPadron[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [confirmando, setConfirmando] = useState<'cerrar' | 'eliminar' | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      votacionesService.obtener(votacion.id),
      votacion.estado === 'BORRADOR' ? Promise.resolve(null) : votacionesService.padronConVotos(votacion.id),
    ])
      .then(([d, p]) => {
        if (!vigente) return;
        setError(null);
        setDetalle(d);
        setPadron(p);
      })
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la votación.');
      });
    return () => {
      vigente = false;
    };
  }, [votacion.id, votacion.estado, version]);

  const estado = detalle?.estado ?? votacion.estado;

  async function publicar() {
    setTrabajando(true);
    try {
      await votacionesService.publicar(votacion.id);
      toast.success('Votación publicada: los vecinos ya pueden votar');
      onCambio();
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo publicar la votación.');
    } finally {
      setTrabajando(false);
    }
  }

  async function cargarVoto(unidadId: string, opcionId: string) {
    try {
      await votacionesService.votarPresencial(votacion.id, unidadId, opcionId);
      toast.success('Voto cargado');
      onCambio();
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cargar el voto.');
    }
  }

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex flex-wrap items-center gap-1.5">
          <EstadoBadge dominio="votacion" estado={estado} />
          {(detalle?.resultado ?? votacion.resultado) && (
            <EstadoBadge dominio="resultado" estado={(detalle?.resultado ?? votacion.resultado)!} />
          )}
        </div>
        <SheetTitle>{votacion.titulo}</SheetTitle>
        <SheetDescription>
          {fechaHora(votacion.apertura)} → {fechaHora(votacion.cierre)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 p-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {votacion.descripcion && <p className="text-sm text-secondary-foreground">{votacion.descripcion}</p>}

        <Seccion titulo="Reglas">
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <Dato nombre="Mayoría" valor={MAYORIAS[votacion.mayoria].etiqueta} />
            <Dato nombre="Conteo" valor={FORMAS_CONTEO[votacion.formaConteo]} />
            <Dato nombre="Si hay empate" valor={DESEMPATES[votacion.desempate]} />
            <Dato
              nombre="Padrón"
              valor={
                detalle
                  ? `${detalle.padron.unidades} ${detalle.padron.unidades === 1 ? 'unidad' : 'unidades'}`
                  : '—'
              }
            />
          </dl>
          {votacion.adjuntoUrl && (
            <Button asChild variant="outline" size="sm" className="self-start">
              <a href={votacion.adjuntoUrl} target="_blank" rel="noreferrer">
                <Download data-icon="inline-start" />
                Ver adjunto
              </a>
            </Button>
          )}
        </Seccion>

        <Seccion titulo="Opciones">
          <ul className="flex flex-wrap gap-1.5">
            {votacion.opcionVotos.map((o) => (
              <li key={o.id} className="rounded-md bg-muted px-2 py-1 text-sm">
                {o.etiqueta}
              </li>
            ))}
          </ul>
        </Seccion>

        {estado !== 'BORRADOR' && (
          <Seccion titulo="Conteo">
            {!detalle ? (
              <Skeleton className="h-24 w-full" />
            ) : detalle.escrutinio ? (
              <EscrutinioBarras escrutinio={detalle.escrutinio} cerrada={estado === 'CERRADA'} />
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay votos.</p>
            )}
          </Seccion>
        )}

        {estado !== 'BORRADOR' && (
          <Seccion titulo="Quién votó">
            {!padron ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <PadronConVotos
                filas={padron}
                votacion={votacion}
                puedeCargar={estado === 'ABIERTA' && votacion.asambleaId !== null}
                onCargar={cargarVoto}
              />
            )}
          </Seccion>
        )}
      </div>

      <SheetFooter className="border-t sm:flex-row sm:justify-end">
        {estado === 'BORRADOR' && (
          <>
            <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={() => setConfirmando('eliminar')}>
              <Trash2 data-icon="inline-start" />
              Eliminar
            </Button>
            <Button variant="outline" onClick={() => onEditar(votacion)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
            <Button onClick={publicar} disabled={trabajando}>
              <Send data-icon="inline-start" />
              {trabajando ? 'Publicando…' : 'Publicar'}
            </Button>
          </>
        )}
        {estado === 'ABIERTA' && (
          <Button variant="outline" onClick={() => setConfirmando('cerrar')}>
            <Vote data-icon="inline-start" />
            Cerrar votación
          </Button>
        )}
      </SheetFooter>

      <ConfirmarAccion
        abierto={confirmando === 'cerrar'}
        titulo="¿Cerrar la votación?"
        descripcion="Se cuentan los votos y queda el resultado. Después no se puede votar."
        boton="Cerrar votación"
        destructiva={false}
        onConfirmar={async () => {
          await votacionesService.cerrar(votacion.id);
          toast.success('Votación cerrada');
          onCambio();
          setVersion((v) => v + 1);
        }}
        onCerrar={() => setConfirmando(null)}
      />
      <ConfirmarAccion
        abierto={confirmando === 'eliminar'}
        titulo={`¿Eliminar “${votacion.titulo}”?`}
        descripcion="Es un borrador: se borra y no se puede recuperar."
        boton="Eliminar"
        onConfirmar={async () => {
          await votacionesService.eliminar(votacion.id);
          toast.success('Votación eliminada');
          onCambio();
          onCerrar();
        }}
        onCerrar={() => setConfirmando(null)}
      />
    </>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

function Dato({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{nombre}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function PadronConVotos({
  filas,
  votacion,
  puedeCargar,
  onCargar,
}: {
  filas: FilaPadron[];
  votacion: Votacion;
  /** El voto presencial sólo se carga en votaciones de asamblea abiertas. */
  puedeCargar: boolean;
  onCargar: (unidadId: string, opcionId: string) => void;
}) {
  const opciones = new Map(votacion.opcionVotos.map((o) => [o.id, o.etiqueta]));
  const faltan = filas.filter((f) => !f.voto).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Votaron {filas.length - faltan} de {filas.length}.
      </p>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Peso</TableHead>
              <TableHead>Voto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.unidadId}>
                <TableCell className="font-medium">{f.etiqueta}</TableCell>
                <TableCell className="text-right text-secondary-foreground tabular-nums">
                  {votacion.formaConteo === 'POR_UNIDAD' ? '1' : porcentaje(f.peso, 4)}
                </TableCell>
                <TableCell>
                  {f.voto ? (
                    <span>
                      {opciones.get(f.voto.opcionId) ?? '—'}
                      <span className="block text-xs text-muted-foreground">
                        {f.voto.cargadoPorLaAdministracion ? 'Presencial' : f.voto.anticipado ? 'App · anticipado' : 'App'}
                      </span>
                    </span>
                  ) : puedeCargar ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="xs">
                          Cargar voto
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {votacion.opcionVotos.map((o) => (
                          <DropdownMenuItem key={o.id} onSelect={() => onCargar(f.unidadId, o.id)}>
                            {o.etiqueta}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-muted-foreground">Sin votar</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
