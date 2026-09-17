import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // La clase de next/font va en <html> para que --font-sans del @theme la
    // encuentre en todo el árbol, portales de Radix incluidos.
    <html lang="es" className={plex.className}>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
