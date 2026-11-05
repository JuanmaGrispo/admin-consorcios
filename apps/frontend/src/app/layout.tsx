import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import { NonceProvider } from '@/components/nonce-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Domus',
  description: 'Sistema de administración de consorcios',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El nonce pertenece a esta respuesta: el HTML no puede prerenderizarse.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? '';
  return (
    // La clase de next/font va en <html> para que --font-sans del @theme la
    // encuentre en todo el árbol, portales de Radix incluidos.
    <html lang="es" className={plex.className}>
      <body className="min-h-screen font-sans antialiased">
        <NonceProvider nonce={nonce}>
          <TooltipProvider>{children}</TooltipProvider>
          {/* Los avisos de "se guardó" / "no se pudo": toast.success(...) desde cualquier pantalla. */}
          <Toaster position="top-center" />
        </NonceProvider>
      </body>
    </html>
  );
}
