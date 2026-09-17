'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { ConsorcioForm } from '@/components/consorcio-form';
import { consorciosService } from '@/services/consorcios';
import type { Consorcio, ConsorcioInput } from '@/types/consorcio';

export default function EditarConsorcioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [consorcio, setConsorcio] = useState<Consorcio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consorciosService
      .get(id)
      .then(setConsorcio)
      .catch(() => setError('No se encontró el consorcio.'));
  }, [id]);

  async function guardar(input: ConsorcioInput) {
    await consorciosService.update(id, input);
    router.push('/');
  }

  return (
    <>
      <header>
        <Link href="/" className="text-xs font-medium text-muted hover:text-ink">
          ← Consorcios
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {consorcio?.nombre ?? 'Consorcio'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Parametrización del consorcio y administrador asignado.
        </p>
      </header>

      <div className="mt-6">
        {consorcio && (
          <ConsorcioForm
            inicial={consorcio}
            textoBoton="Guardar cambios"
            onSubmit={guardar}
          />
        )}
        {!consorcio && !error && <p className="text-sm text-muted">Cargando…</p>}
        {error && (
          <p className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>
        )}
      </div>
    </>
  );
}
