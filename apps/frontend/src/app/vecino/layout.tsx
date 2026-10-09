import { SesionProvider } from '@/components/session';
import { BarraVecino } from '@/components/vecino/barra-vecino';
import { EsqueletoVecino } from '@/components/vecino/esqueleto-vecino';
import { NavegacionVecino } from '@/components/vecino/navegacion-vecino';
import { UnidadActivaProvider } from '@/components/vecino/unidad-activa';

/**
 * El portal del vecino (pantallas 10 a 16 del prototipo): pensado para el
 * celular, con la barra de navegación abajo. En la compu se ve como una
 * columna centrada del ancho de un teléfono, igual que en el diseño.
 */
export default function VecinoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SesionProvider roles={['VECINO']} esqueleto={<EsqueletoVecino />}>
      <UnidadActivaProvider>
        <BarraVecino />
        {/* pb-24: que la barra de abajo no tape el final de la pantalla. */}
        <main className="mx-auto w-full max-w-md px-4 pt-4 pb-24">{children}</main>
        <NavegacionVecino />
      </UnidadActivaProvider>
    </SesionProvider>
  );
}
