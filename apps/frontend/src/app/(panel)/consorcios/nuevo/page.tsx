'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConsorcioForm } from '@/components/consorcio-form';
import { consorciosService } from '@/services/consorcios';
import type { ConsorcioInput } from '@/types/consorcio';

export default function NuevoConsorcioPage() {
  const router = useRouter();

  async function crear(input: ConsorcioInput) {
    await consorciosService.create(input);
    router.push('/');
  }

  return (
    <>
      <header>
        <Link href="/" className="text-xs font-medium text-muted hover:text-ink">
          ← Consorcios
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Nuevo consorcio</h1>
        <p className="mt-1 text-sm text-muted">
          Alta de un edificio en la plataforma: identidad, administrador
          responsable y reglas de liquidación.
        </p>
      </header>

      <div className="mt-6">
        <ConsorcioForm textoBoton="Crear consorcio" onSubmit={crear} />
      </div>
    </>
  );
}
