import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
});

export const metadata: Metadata = {
  title: 'Domus',
  description: 'Sistema de administración de consorcios',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${plex.variable} min-h-screen font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
