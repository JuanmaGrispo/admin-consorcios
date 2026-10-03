import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Asamblea, EstadoAsamblea, EstadoReserva, Reserva, RolUsuario } from '../../database/entities';
import type { AsambleasService } from '../asambleas/asambleas.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { ExpensasService } from '../expensas/expensas.service';
import type { ReclamosService } from '../reclamos/reclamos.service';
import type { ListarReservasQuery } from '../reservas/dto/listar-reservas.query';
import type { ReservasService } from '../reservas/reservas.service';
import type { UnidadesService } from '../unidades/unidades.service';
import type { UsuariosService } from '../usuarios/usuarios.service';
import { InicioService } from './inicio.service';

const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const enDias = (dias: number) => new Date(Date.now() + dias * 24 * 3600 * 1000);

function crearService(opts: { asambleas?: Asamblea[]; reservas?: Reserva[] } = {}) {
  const pedidas: ListarReservasQuery[] = [];
  const service = new InicioService(
    { findOne: async () => ({ nombre: 'Julieta', apellido: 'Sosa', avatarUrl: null }) } as unknown as UsuariosService,
    // Sin unidades: estos tests miran sólo los eventos.
    { unidadesDelVecino: async () => [] } as unknown as UnidadesService,
    {} as ExpensasService,
    {} as ReclamosService,
    { proximasDelVecino: async () => opts.asambleas ?? [] } as unknown as AsambleasService,
    {
      listar: async (_u: UsuarioActual, query: ListarReservasQuery) => {
        pedidas.push(query);
        return { items: opts.reservas ?? [], total: 0, pagina: 1, paginas: 1 };
      },
    } as unknown as ReservasService,
  );
  return { service, pedidas };
}

describe('InicioService — próximos eventos', () => {
  it('junta asambleas y reservas, de la más cercana a la más lejana', async () => {
    const { service } = crearService({
      asambleas: [
        {
          id: 'as1',
          titulo: 'Asamblea ordinaria',
          fechaHora: enDias(5),
          lugar: 'SUM',
          estado: EstadoAsamblea.CONVOCADA,
          consorcioId: 'c1',
        } as Asamblea,
      ],
      reservas: [
        {
          id: 'r1',
          inicio: enDias(2),
          fin: enDias(2),
          unidadId: 'u1',
          amenityId: 'am1',
          amenity: { nombre: 'SUM' },
        } as unknown as Reserva,
      ],
    });

    const { proximosEventos } = await service.paraElVecino(vecino);

    assert.deepEqual(
      proximosEventos.map((e) => [e.tipo, e.id, e.titulo]),
      [
        ['RESERVA', 'r1', 'SUM'],
        ['ASAMBLEA', 'as1', 'Asamblea ordinaria'],
      ],
    );
  });

  it('pide sólo reservas aprobadas que todavía no empezaron, con fecha tope', async () => {
    const { service, pedidas } = crearService();
    await service.paraElVecino(vecino);

    assert.equal(pedidas.length, 1);
    assert.equal(pedidas[0].estado, EstadoReserva.APROBADA);
    assert.equal(pedidas[0].situacion, 'proximas');
    assert.match(pedidas[0].hasta ?? '', /^\d{4}-\d{2}-\d{2}$/);
  });

  it('sin eventos viaja una lista vacía, porque ahora sí se sabe que no hay', async () => {
    const { service } = crearService();
    const { proximosEventos } = await service.paraElVecino(vecino);
    assert.deepEqual(proximosEventos, []);
  });
});
