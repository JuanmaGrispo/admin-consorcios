/** Lo que devuelven los listados paginados del backend (reclamos, boletas, reservas…). */
export interface Paginado<T> {
  items: T[];
  total: number;
  pagina: number;
  paginas: number;
}
