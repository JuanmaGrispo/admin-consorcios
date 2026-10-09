'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { perfilService } from '@/services/perfil';
import type { CanalNotificacion, CategoriaNotificacion } from '@/types/usuario';

const CANALES: Record<CanalNotificacion, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  PUSH: 'Notificaciones en el celular',
};

const CATEGORIAS: Record<CategoriaNotificacion, string> = {
  BOLETAS: 'Boletas de expensas',
  VENCIMIENTOS: 'Vencimientos',
  RECLAMOS_RESERVAS: 'Reclamos y reservas',
  COMUNICADOS: 'Novedades y asambleas',
};

/**
 * Qué avisos quiere recibir y por dónde (pantalla 16). Cada interruptor se
 * guarda al tocarlo. Los canales que todavía no envían se ven como "Pronto".
 */
export function PreferenciasAviso() {
  const pedido = usePedido('preferencias', () => perfilService.preferencias(), 'No se pudieron cargar tus avisos.');
  const grilla = pedido.datos ?? pedido.ultimo;
  // La combinación que se está guardando, para no dejar tocarla dos veces.
  const [guardando, setGuardando] = useState<string | null>(null);

  async function cambiar(canal: CanalNotificacion, categoria: CategoriaNotificacion, habilitado: boolean) {
    setGuardando(`${canal}:${categoria}`);
    try {
      await perfilService.actualizarPreferencias([{ canal, categoria, habilitado }]);
      pedido.recargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar la preferencia.');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avisos</CardTitle>
        <CardDescription>Elegí qué te avisamos y por dónde. Se guarda al tocar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {pedido.error ? (
          <Alert variant="destructive">
            <AlertDescription>{pedido.error}</AlertDescription>
          </Alert>
        ) : !grilla ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          grilla.map((canal) => (
            <section key={canal.canal} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {CANALES[canal.canal]}
                {!canal.disponible && <Badge variant="secondary">Pronto</Badge>}
              </h3>
              <div className="flex flex-col divide-y rounded-lg border">
                {canal.categorias.map((c) => {
                  const id = `${canal.canal}-${c.categoria}`;
                  return (
                    <Field key={c.categoria} orientation="horizontal" className="justify-between px-3 py-2.5">
                      <FieldLabel htmlFor={id} className="font-normal">
                        {CATEGORIAS[c.categoria]}
                      </FieldLabel>
                      <Switch
                        id={id}
                        checked={canal.disponible && c.habilitado}
                        disabled={!canal.disponible || guardando === `${canal.canal}:${c.categoria}`}
                        onCheckedChange={(valor) => cambiar(canal.canal, c.categoria, valor)}
                      />
                    </Field>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
