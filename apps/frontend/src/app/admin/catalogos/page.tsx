'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { CategoriasReclamoCatalogo } from '@/components/catalogos/categorias-reclamo';
import { ProveedoresCatalogo } from '@/components/catalogos/proveedores';
import { RubrosGastoCatalogo } from '@/components/catalogos/rubros-gasto';
import { PageHeader } from '@/components/page-header';
import { useSesion } from '@/components/session';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SOLAPAS = ['categorias', 'proveedores', 'rubros'] as const;
type Solapa = (typeof SOLAPAS)[number];

/**
 * Los datos de referencia que el administrador carga una vez y usan los demás
 * módulos: categorías de reclamo, proveedores y rubros de gasto. No está en el
 * prototipo: sigue el estilo de sus tablas. La solapa vive en la URL
 * (`?solapa=proveedores`) para poder linkear directo a una.
 */
export default function AdminCatalogosPage() {
  // useSearchParams necesita un Suspense para que la página se pueda prerenderizar.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Catalogos />
    </Suspense>
  );
}

function Catalogos() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { usuario } = useSesion();
  const { consorcio } = useConsorcioActivo();

  const pedida = params.get('solapa');
  const solapa: Solapa = SOLAPAS.includes(pedida as Solapa) ? (pedida as Solapa) : 'categorias';
  const props = { consorcioId: consorcio.id, esSuperAdmin: usuario.rol === 'SUPER_ADMIN' };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        contexto={consorcio.nombre}
        titulo="Catálogos"
        descripcion="Lo que se carga una vez y usan reclamos y expensas. Los compartidos los administra la plataforma."
      />

      <Tabs value={solapa} onValueChange={(v) => router.replace(`${pathname}?solapa=${v}`, { scroll: false })}>
        <TabsList className="w-full sm:w-fit">
          {/* En el celular las tres solapas con el nombre largo no entran. */}
          <TabsTrigger value="categorias">
            Categorías<span className="hidden sm:inline">&nbsp;de reclamo</span>
          </TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="rubros">
            Rubros<span className="hidden sm:inline">&nbsp;de gasto</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="categorias" className="mt-4">
          <CategoriasReclamoCatalogo {...props} />
        </TabsContent>
        <TabsContent value="proveedores" className="mt-4">
          <ProveedoresCatalogo {...props} />
        </TabsContent>
        <TabsContent value="rubros" className="mt-4">
          <RubrosGastoCatalogo {...props} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
