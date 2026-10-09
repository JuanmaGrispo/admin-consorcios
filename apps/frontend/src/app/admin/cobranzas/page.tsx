import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Expensas y pagos: quien lo toma reemplaza esta página entera. */
export default function AdminCobranzasPage() {
  return (
    <EnConstruccion
      titulo="Estado de cobranzas"
      pantalla="02 Estado de cobranzas"
      modulo="Expensas y pagos"
    />
  );
}
