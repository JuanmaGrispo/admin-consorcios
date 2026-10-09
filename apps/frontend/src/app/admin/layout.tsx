import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { ConsorcioActivoProvider } from '@/components/admin/consorcio-activo';
import { SesionProvider } from '@/components/session';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

/**
 * El portal del administrador (pantallas 01 a 09 del prototipo): sidebar fija
 * con el selector de consorcio, y cada pantalla adentro. El superadmin también
 * entra: el backend lo deja ver todos los consorcios.
 */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SesionProvider roles={['ADMINISTRADOR', 'SUPER_ADMIN']}>
      <ConsorcioActivoProvider>
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset>
            {/* En desktop la sidebar está siempre; en mobile es la única forma de abrir el menú. */}
            <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-semibold">Domus</span>
            </header>
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </ConsorcioActivoProvider>
    </SesionProvider>
  );
}
