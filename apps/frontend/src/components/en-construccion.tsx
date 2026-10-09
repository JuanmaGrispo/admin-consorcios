import { Hammer } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

interface EnConstruccionProps {
  titulo: string;
  /** El número de pantalla del prototipo (docs/diseno-front.html): "02 Estado de cobranzas". */
  pantalla: string;
  /** El módulo del reparto: quien lo toma reemplaza esta página entera. */
  modulo: string;
  volverA?: string;
}

/**
 * Lo que muestra una ruta que todavía no se construyó. Existe para que la
 * navegación esté completa desde el principio y nadie tenga que tocar la
 * sidebar ni la barra del vecino para sumar su pantalla.
 */
export function EnConstruccion({ titulo, pantalla, modulo, volverA }: EnConstruccionProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader titulo={titulo} volverA={volverA} />
      <EmptyState
        icono={Hammer}
        titulo="Pantalla en construcción"
        descripcion={`Diseño: ${pantalla}. Módulo: ${modulo}.`}
      />
    </div>
  );
}
