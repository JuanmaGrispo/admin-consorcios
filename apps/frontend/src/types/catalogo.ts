/**
 * Los catálogos que el administrador configura una vez y usan los demás
 * módulos: categorías de reclamo, proveedores y rubros de gasto. Los tres
 * pueden ser de un consorcio o compartidos (`consorcioId: null`); los
 * compartidos sólo los gestiona el superadmin.
 */

/** GET /categorias-reclamo */
export interface CategoriaReclamo {
  id: string;
  consorcioId: string | null;
  nombre: string;
  /** Nombre de un ícono de Material Symbols ("plumbing"). */
  icono: string | null;
  createdAt: string;
}

export interface CategoriaReclamoInput {
  consorcioId?: string;
  nombre: string;
  icono?: string;
}

/** GET /proveedores */
export interface Proveedor {
  id: string;
  consorcioId: string | null;
  razonSocial: string;
  /** "30-71234567-9". */
  cuit: string | null;
  rubro: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProveedorInput {
  consorcioId?: string;
  razonSocial: string;
  cuit?: string;
  rubro?: string;
  email?: string;
  telefono?: string;
}

export type NaturalezaGasto = 'ORDINARIO' | 'EXTRAORDINARIO' | 'FONDO_RESERVA';

export const NATURALEZAS_GASTO: { valor: NaturalezaGasto; etiqueta: string }[] = [
  { valor: 'ORDINARIO', etiqueta: 'Ordinario' },
  { valor: 'EXTRAORDINARIO', etiqueta: 'Extraordinario' },
  { valor: 'FONDO_RESERVA', etiqueta: 'Fondo de reserva' },
];

/** GET /rubros-gasto */
export interface RubroGasto {
  id: string;
  consorcioId: string | null;
  nombre: string;
  icono: string | null;
  /** La que toman por defecto los gastos de este rubro. */
  naturaleza: NaturalezaGasto;
  createdAt: string;
  updatedAt: string;
}

export interface RubroGastoInput {
  consorcioId?: string;
  nombre: string;
  icono?: string;
  naturaleza?: NaturalezaGasto;
}
