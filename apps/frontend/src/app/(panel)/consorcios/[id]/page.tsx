'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError } from '@/lib/api';
import { ConsorcioForm } from '@/components/consorcio-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { consorciosService } from '@/services/consorcios';
import type { ConsorcioInput } from '@/types/consorcio';

export default function EditarConsorcioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const pedido = usePedido(`consorcio:${id}`, () => consorciosService.getVersionado(id), 'No se encontró el consorcio.');
  const consorcio = pedido.datos?.datos;
  const error = pedido.error;
  const [conflicto, setConflicto] = useState(false);

  async function guardar(input: ConsorcioInput) {
    if (!pedido.datos?.etag) throw new ApiError(428, 'Recargá el consorcio antes de guardar.');
    try { await consorciosService.update(id, input, pedido.datos.etag); }
    catch (err) { if (err instanceof ApiError && err.status === 412) setConflicto(true); throw err; }
    router.push('/');
  }

  return (
    <>
      <header>
        <Link href="/" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Consorcios
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {consorcio?.nombre ?? 'Consorcio'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parametrización del consorcio y administrador asignado.
        </p>
      </header>

      <div className="mt-6">
        {conflicto && <Alert className="mb-4"><AlertDescription>
          El consorcio cambió. Tu borrador se conserva; recargá para revisar la versión nueva antes de editar de nuevo.
          <Button type="button" variant="outline" onClick={() => { pedido.recargar(); setConflicto(false); }}>
            Recargar y descartar borrador
          </Button>
        </AlertDescription></Alert>}
        {consorcio && (
          <ConsorcioForm
            key={pedido.datos?.etag}
            inicial={consorcio}
            textoBoton="Guardar cambios"
            onSubmit={guardar}
          />
        )}
        {!consorcio && !error && <Skeleton className="h-96" />}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
