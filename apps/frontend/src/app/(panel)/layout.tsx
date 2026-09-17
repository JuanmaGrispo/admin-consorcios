import { SesionProvider } from '@/components/session';
import { Sidebar } from '@/components/sidebar';

export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SesionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-8 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </SesionProvider>
  );
}
