import { AppSidebar } from '@/components/app-sidebar';
import { SesionProvider } from '@/components/session';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SesionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Barra superior: en desktop solo el toggle; en mobile es la única
              forma de abrir el menú. */}
          <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-semibold">Domus</span>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SesionProvider>
  );
}
