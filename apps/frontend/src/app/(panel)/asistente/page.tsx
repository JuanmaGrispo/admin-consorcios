'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { asistenteService } from '@/services/asistente';

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

/** El asistente de ayuda visto por el dueño de la plataforma: prenderlo, apagarlo y ver cómo anda. */
export default function AsistentePage() {
  const [dias, setDias] = useState('7');
  const { datos, error, recargar } = usePedido(`asistente-metricas-${dias}`, () =>
    asistenteService.metricas(Number(dias)),
  );
  const [guardando, setGuardando] = useState(false);

  async function cambiar(habilitado: boolean) {
    setGuardando(true);
    try {
      await asistenteService.cambiarHabilitado(habilitado);
      toast.success(habilitado ? 'Asistente prendido' : 'Asistente apagado');
      recargar();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo cambiar el asistente.');
    } finally {
      setGuardando(false);
    }
  }

  const votos = datos ? datos.feedback.util + datos.feedback.noUtil : 0;
  const kpis = datos && [
    { label: 'Preguntas', valor: datos.preguntas.toLocaleString('es-AR') },
    {
      label: 'Respondidas con IA',
      valor: datos.preguntas ? `${Math.round((datos.porOrigen.llm / datos.preguntas) * 100)} %` : '—',
    },
    { label: 'Costo', valor: usd(datos.costoUsd) },
    { label: 'Latencia promedio', valor: `${(datos.latenciaPromedioMs / 1000).toLocaleString('es-AR')} s` },
    { label: 'Útiles', valor: votos ? `${Math.round((datos.feedback.util / votos) * 100)} % de ${votos}` : '—' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Plataforma</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Asistente de ayuda</h1>
        </div>
        <ToggleGroup type="single" variant="outline" value={dias} onValueChange={(v) => v && setDias(v)}>
          <ToggleGroupItem value="1">Hoy</ToggleGroupItem>
          <ToggleGroupItem value="7">7 días</ToggleGroupItem>
          <ToggleGroupItem value="30">30 días</ToggleGroupItem>
        </ToggleGroup>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estado</CardTitle>
          <CardDescription>
            Apagado, los vecinos y administradores dejan de ver el botón de ayuda en un minuto como mucho.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {datos ? (
            <>
              <Field orientation="horizontal">
                <Switch
                  id="habilitado"
                  checked={datos.habilitado}
                  disabled={guardando}
                  onCheckedChange={(v) => void cambiar(v)}
                />
                <FieldLabel htmlFor="habilitado">{datos.habilitado ? 'Prendido' : 'Apagado'}</FieldLabel>
              </Field>
              <div className="flex flex-wrap gap-2">
                {datos.modeloConfigurado ? (
                  <Badge variant="success">IA configurada</Badge>
                ) : (
                  <Badge variant="warning">Sin API key: responde sólo el manual</Badge>
                )}
                {datos.disyuntorAbierto && <Badge variant="destructive">La IA no responde: usando el manual</Badge>}
                {datos.costoHoyUsd >= datos.topeDiarioUsd && (
                  <Badge variant="warning">Tope diario alcanzado: usando el manual</Badge>
                )}
              </div>
              <FieldDescription>
                Gasto de hoy: {usd(datos.costoHoyUsd)} de un tope de {usd(datos.topeDiarioUsd)}.
              </FieldDescription>
            </>
          ) : (
            <Skeleton className="h-6 w-40" />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(kpis ?? Array.from({ length: 5 }, () => null)).map((k, i) => (
          <Card key={k?.label ?? i}>
            <CardHeader>
              <CardDescription>{k?.label ?? <Skeleton className="h-4 w-20" />}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{k?.valor ?? <Skeleton className="h-7 w-16" />}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {datos && (
        <Card>
          <CardHeader>
            <CardTitle>Quién respondió</CardTitle>
            <CardDescription>
              Cuando la IA falla, tarda o se pasa del tope, responde la búsqueda en el manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">IA: {datos.porOrigen.llm}</Badge>
            <Badge variant="secondary">Manual: {datos.porOrigen.manual}</Badge>
            <Badge variant="secondary">Rechazos: {datos.porOrigen.rechazo}</Badge>
          </CardContent>
        </Card>
      )}

      {datos && datos.errores.length > 0 && (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motivo del fallback</TableHead>
                <TableHead className="text-right">Veces</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.errores.map((e) => (
                <TableRow key={e.error}>
                  <TableCell>{e.error}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.veces}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
