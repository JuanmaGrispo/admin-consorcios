import { redirect } from 'next/navigation';

/** El "Configuración" del prototipo (rubros, categorías, proveedores) es Catálogos. */
export default function AdminConfiguracionPage() {
  redirect('/admin/catalogos');
}
