'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { authService } from '@/services/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await authService.login(email, password);
      // refresh() para que el proxy vea la cookie nueva y deje pasar.
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Email o contraseña incorrectos'
          : 'No se pudo iniciar sesión. Probá de nuevo.',
      );
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent" />
          <span className="text-xl font-semibold tracking-tight">Domus</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-lg font-semibold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">
            Panel de administración de la plataforma
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-ink-2 uppercase">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-ink-2 uppercase">
                Contraseña
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
