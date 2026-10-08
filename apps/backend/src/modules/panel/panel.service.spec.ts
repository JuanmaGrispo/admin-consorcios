import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EstadoLiquidacion, RolUsuario } from '../../database/entities';
import type { AsambleasService } from '../asambleas/asambleas.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { CobranzaDeLiquidacion } from '../expensas/expensas.repository';
import type { ExpensasService } from '../expensas/expensas.service';
import type { ReclamosService } from '../reclamos/reclamos.service';
import type { ReservasService } from '../reservas/reservas.service';
import type { VotacionesService } from '../votaciones/votaciones.service';
import { PanelService } from './panel.service';

const admin: UsuarioActual = { id: 'a1', email: 'a@x', rol: RolUsuario.ADMINISTRADOR, consorcioIds: ['c1', 'c2'] };

const liquidacion = (
  consorcioId: string,
  periodo: string,
  datos: Partial<CobranzaDeLiquidacion> = {},
): CobranzaDeLiquidacion => ({
  consorcioId,
  periodo,
  estado: EstadoLiquidacion.EMITIDA,
  fechaVencimiento: `${periodo}-10`,
  emitido: 1000,
  cobrado: 1000,
  vencido: 0,
  unidadesVencidas: 0,
  ...datos,
});

function crearPanel(liquidaciones: CobranzaDeLiquidacion[]) {
  const pedidos: { desde?: string; hasta?: string }[] = [];
  const service = new PanelService(
    {
      findAll: async () => [
        { id: 'c1', nombre: 'Rivadavia 4820', calle: 'Av. Rivadavia', numero: '4820', barrio: 'Almagro', cantidadUnidades: 48 },
        { id: 'c2', nombre: 'Thames 1490', calle: 'Thames', numero: '1490', barrio: 'Palermo', cantidadUnidades: 32 },
      ],
    } as unknown as ConsorciosService,
    {
      ultimoPeriodoEmitido: async () => '2026-08',
      cobranzasPorLiquidacion: async (_u: unknown, desde: string, hasta: string) => {
        pedidos.push({ desde, hasta });
        return liquidaciones;
      },
      deudaAntigua: async () => [{ consorcioId: 'c1', unidades: 7, saldo: 2_184_900 }],
    } as unknown as ExpensasService,
    {
      resumen: async () => ({ abiertos: 12 }),
      sinAsignar: async () => [
        {
          id: 'r1', codigo: 'RC-2026-0184', consorcioId: 'c1', createdAt: new Date('2026-09-01'),
          unidad: { etiqueta: '6º B' }, categoria: { nombre: 'Ascensor' },
        },
      ],
    } as unknown as ReclamosService,
    { listar: async (_u: unknown, q: { estado: string }) => ({ total: q.estado === 'APROBADA' ? 4 : 1 }) } as unknown as ReservasService,
    { listar: async () => [{ id: 'v1' }, { id: 'v2' }] } as unknown as VotacionesService,
    {
      listar: async () => [
        { id: 'as1', consorcioId: 'c1', fechaHora: new Date(Date.now() + 3 * 86_400_000), quorumPorcentaje: 54.3, quorumRequerido: 60 },
        // Lejana: todavía no apura.
        { id: 'as2', consorcioId: 'c2', fechaHora: new Date(Date.now() + 60 * 86_400_000), quorumPorcentaje: 10, quorumRequerido: 60 },
      ],
    } as unknown as AsambleasService,
  );
  return { service, pedidos };
}

describe('PanelService', () => {
  it('sin período, toma el último emitido y pide los seis meses que terminan ahí', async () => {
    const { service, pedidos } = crearPanel([]);
    const panel = await service.delAdministrador(admin);
    assert.equal(panel.periodo, '2026-08');
    assert.deepEqual(pedidos, [{ desde: '2026-03', hasta: '2026-08' }]);
    assert.deepEqual(panel.serie.map((s) => s.periodo), ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
  });

  it('suma la cobranza del período, la compara con el anterior y arma cada consorcio', async () => {
    const { service } = crearPanel([
      liquidacion('c1', '2026-07', { emitido: 900, cobrado: 900 }),
      liquidacion('c1', '2026-08', { emitido: 1000, cobrado: 700, vencido: 250, unidadesVencidas: 3 }),
      // Thames tiene agosto en borrador: no cuenta como emitido.
      liquidacion('c2', '2026-08', { estado: EstadoLiquidacion.BORRADOR, emitido: 500 }),
    ]);
    const panel = await service.delAdministrador(admin);

    assert.equal(panel.consorcios, 2);
    assert.equal(panel.unidades, 80);
    assert.equal(panel.cobranza.emitido, 1000);
    assert.equal(panel.cobranza.pendiente, 300);
    assert.equal(panel.cobranza.morosidad, 25);
    assert.equal(panel.cobranza.porcentajeCobrado, 70);
    assert.deepEqual(panel.cobranza.anterior, { periodo: '2026-07', emitido: 900, cobrado: 900, morosidad: 0 });

    const [rivadavia, thames] = panel.porConsorcio;
    assert.equal(rivadavia.estado, 'MOROSIDAD_ALTA');
    assert.equal(thames.estado, 'SIN_EMITIR');
    assert.equal(thames.emitido, 0);
  });

  it('junta lo que requiere atención', async () => {
    const { service } = crearPanel([liquidacion('c1', '2026-08')]);
    const panel = await service.delAdministrador(admin);
    const tipos = panel.atencion.map((a) => a.tipo);
    assert.deepEqual(tipos, ['DEUDA_ANTIGUA', 'LIQUIDACION_SIN_EMITIR', 'QUORUM_BAJO', 'RECLAMO_SIN_ASIGNAR']);
    const sinEmitir = panel.atencion[1];
    assert.equal(sinEmitir.tipo === 'LIQUIDACION_SIN_EMITIR' && sinEmitir.consorcio, 'Thames 1490');
  });

  it('la actividad de hoy', async () => {
    const { service } = crearPanel([]);
    const { actividadHoy } = await service.delAdministrador(admin);
    assert.deepEqual(actividadHoy, { reclamosAbiertos: 12, reservas: 5, reservasPendientes: 1, votacionesActivas: 2 });
  });
});
