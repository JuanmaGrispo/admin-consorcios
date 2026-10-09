'use client';

import { UserCheck } from 'lucide-react';
import { useState } from 'react';
import { EstadoBadge } from '@/components/estado-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { porcentaje } from '@/lib/formato';
import type { Asistencia, EstadoAsistencia } from '@/types/asamblea';

interface TablaAsistenciaProps {
  /** Null mientras carga. */
  asistencias: Asistencia[] | null;
  /** El padrón se puede corregir mientras la asamblea está convocada o en curso. */
  editable: boolean;
  onRegistrar: (
    unidadId: string,
    datos: { estado: EstadoAsistencia; apoderadoUnidadId?: string },
  ) => Promise<void>;
}

const ESTADOS: { estado: EstadoAsistencia; etiqueta: string }[] = [
  { estado: 'ASISTE', etiqueta: 'Asiste' },
  { estado: 'NO_ASISTE', etiqueta: 'No asiste' },
  { estado: 'SIN_RESPONDER', etiqueta: 'Sin responder' },
  { estado: 'CON_PODER', etiqueta: 'Con poder…' },
];

/** El padrón de asistencia: quién respondió y, para el administrador, cargar presentes y poderes. */
export function TablaAsistencia({ asistencias, editable, onRegistrar }: TablaAsistenciaProps) {
  const [conPoder, setConPoder] = useState<Asistencia | null>(null);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Asistencia</CardTitle>
        <CardDescription>Una fila por unidad, con el coeficiente con el que entró al padrón.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {!asistencias ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : asistencias.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            El padrón se arma al convocar la asamblea.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:uppercase [&>*:first-child]:pl-4 [&>*:last-child]:pr-4">
                <TableHead>Unidad</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Coef.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Respondió</TableHead>
                {editable && (
                  <TableHead>
                    <span className="sr-only">Registrar</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {asistencias.map((a) => (
                <TableRow key={a.id} className="[&>*:first-child]:pl-4 [&>*:last-child]:pr-4">
                  <TableCell className="font-medium">{a.unidad?.etiqueta ?? '—'}</TableCell>
                  <TableCell className="hidden text-right text-secondary-foreground tabular-nums sm:table-cell">
                    {porcentaje(a.coeficienteAplicado, 4)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-0.5">
                      <EstadoBadge dominio="asistencia" estado={a.estado} />
                      {a.apoderadoUnidad && (
                        <span className="text-xs text-muted-foreground">Por {a.apoderadoUnidad.etiqueta}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-secondary-foreground md:table-cell">
                    {a.confirmadaPor ? `${a.confirmadaPor.nombre} ${a.confirmadaPor.apellido}` : '—'}
                  </TableCell>
                  {editable && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="xs">
                            Registrar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ESTADOS.filter((e) => e.estado !== a.estado).map((e) => (
                            <DropdownMenuItem
                              key={e.estado}
                              onSelect={() =>
                                e.estado === 'CON_PODER'
                                  ? setConPoder(a)
                                  : void onRegistrar(a.unidadId, { estado: e.estado })
                              }
                            >
                              {e.etiqueta}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {conPoder && asistencias && (
        <DialogoPoder
          asistencia={conPoder}
          candidatas={asistencias.filter((a) => a.unidadId !== conPoder.unidadId)}
          onGuardar={async (apoderadoUnidadId) => {
            await onRegistrar(conPoder.unidadId, { estado: 'CON_PODER', apoderadoUnidadId });
            setConPoder(null);
          }}
          onCerrar={() => setConPoder(null)}
        />
      )}
    </Card>
  );
}

/** Elegir qué unidad representa a la que dio poder. */
function DialogoPoder({
  asistencia,
  candidatas,
  onGuardar,
  onCerrar,
}: {
  asistencia: Asistencia;
  candidatas: Asistencia[];
  onGuardar: (apoderadoUnidadId: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [apoderado, setApoderado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar(apoderado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el poder.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Poder de {asistencia.unidad?.etiqueta}</DialogTitle>
          <DialogDescription>
            La unidad que la representa vota por ella. Cuenta como presente para el quórum.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Field>
            <FieldLabel>La representa</FieldLabel>
            <Select value={apoderado} onValueChange={setApoderado}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí una unidad" />
              </SelectTrigger>
              <SelectContent>
                {candidatas.map((c) => (
                  <SelectItem key={c.unidadId} value={c.unidadId}>
                    {c.unidad?.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={!apoderado || enviando}>
              <UserCheck data-icon="inline-start" />
              {enviando ? 'Guardando…' : 'Registrar poder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
