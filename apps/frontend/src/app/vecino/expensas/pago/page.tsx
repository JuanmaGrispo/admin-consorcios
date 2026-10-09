import { EnConstruccion } from '@/components/en-construccion';

/** Módulo Expensas y pagos: quien lo toma reemplaza esta página entera. */
export default function VecinoExpensasPagoPage() {
  return (
    <EnConstruccion
      titulo="Pagar expensas"
      pantalla="12 Pago con Mercado Pago (también es la vuelta del checkout)"
      modulo="Expensas y pagos"
      volverA="/vecino/expensas"
    />
  );
}
