'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { consorciosService } from '@/services/consorcios';
import type { Consorcio } from '@/types/consorcio';

function domicilio(c: Consorcio): string {
  const calle = [c.calle, c.numero].filter(Boolean).join(' ');
  return [calle, c.barrio, c.ciudad].filter(Boolean).join(' · ') || '—';
}

export default function ConsorciosPage() {
  const [consorcios, setConsorcios] = useState<Consorcio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consorciosService
      .list()
      .then(setConsorcios)
      .catch(() => setError('No se pudieron cargar los consorcios.'));
  }, []);

  const total = consorcios?.length ?? 0;
  const activos = consorcios?.filter((c) => c.activo).length ?? 0;
  const unidades =
    consorcios?.reduce((sum, c) => sum + (c.cantidadUnidades ?? 0), 0) ?? 0;

  return (
    <>
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">
            Plataforma
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Consorcios</h1>
        </div>
        <Link
          href="/consorcios/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Nuevo consorcio
        </Link>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Consorcios', valor: total },
          { label: 'Activos', valor: activos },
          { label: 'Unidades totales', valor: unidades },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="text-xs font-medium tracking-wide text-muted uppercase">
              {kpi.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {consorcios ? kpi.valor : '—'}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-2 text-[11px] font-semibold tracking-widest text-muted uppercase">
              <th className="px-5 py-3">Consorcio</th>
              <th className="px-5 py-3">Administrador</th>
              <th className="px-5 py-3 text-right">Unidades</th>
              <th className="px-5 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {consorcios?.map((c) => (
              <tr
                key={c.id}
                className="border-b border-line-2 last:border-b-0 hover:bg-surface-2"
              >
                <td className="px-5 py-3.5">
                  <Link href={`/consorcios/${c.id}`} className="block">
                    <div className="font-medium text-ink">{c.nombre}</div>
                    <div className="mt-0.5 text-xs text-muted">{domicilio(c)}</div>
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  {c.administrador ? (
                    <>
                      <div className="text-ink-2">
                        {c.administrador.nombre} {c.administrador.apellido}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {c.administrador.email}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted">Sin asignar</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums">
                  {c.cantidadUnidades ?? 0}
                </td>
                <td className="px-5 py-3.5">
                  {c.activo ? (
                    <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-medium text-ok">
                      Activo
                    </span>
                  ) : (
                    <span className="rounded-full bg-bad-soft px-2.5 py-1 text-xs font-medium text-bad">
                      Inactivo
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {consorcios && consorcios.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-muted">
                  Todavía no hay consorcios. Creá el primero con “Nuevo consorcio”.
                </td>
              </tr>
            )}
            {!consorcios && !error && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-muted">
                  Cargando…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-bad">
                  {error}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
