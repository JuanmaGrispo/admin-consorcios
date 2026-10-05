import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PublicadorEventos } from '../../core/mensajeria/publicador-eventos';
import type { Notificador } from '../../core/notificaciones/notificador';
import {
  Asamblea,
  EstadoAsamblea,
  EstadoAsistencia,
  EstadoVotacion,
  FormaConteo,
  MayoriaRequerida,
  PadronVotacion,
  PuntoOrdenDia,
  ResultadoVotacion,
  RolUsuario,
  TipoPuntoOrden,
  VinculoUnidad,
  Votacion,
  Voto,
} from '../../database/entities';
import type { ArchivosService } from '../archivos/archivos.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { ExpensasService } from '../expensas/expensas.service';
import type { UnidadParaPadron } from './padron';
import type { VotacionesRepository } from './votaciones.repository';
import { VotacionesService } from './votaciones.service';

const admin: UsuarioActual = {
  id: 'a1',
  email: 'a@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c1'],
};
const adminAjeno: UsuarioActual = {
  id: 'a2',
  email: 'b@x',
  rol: RolUsuario.ADMINISTRADOR,
  consorcioIds: ['c2'],
};
const p1: UsuarioActual = { id: 'p1', email: 'p1@x', rol: RolUsuario.VECINO };
const inquilino: UsuarioActual = { id: 'i2', email: 'i2@x', rol: RolUsuario.VECINO };

const HORA = 3600 * 1000;
const enHoras = (h: number) => new Date(Date.now() + h * HORA);

const OPCIONES = [
  { id: 'si', etiqueta: 'A favor', orden: 1, esFija: true },
  { id: 'no', etiqueta: 'En contra', orden: 2, esFija: true },
  { id: 'abs', etiqueta: 'Abstención', orden: 3, esFija: false },
];

/** Independiente, abierta desde hace una hora y por una hora más. */
const votacion = (over: Partial<Votacion> = {}) =>
  ({
    id: 'vt1',
    consorcioId: 'c1',
    asambleaId: null,
    asamblea: null,
    puntoOrdenDiaId: null,
    titulo: 'Bomba de agua',
    padron: PadronVotacion.SOLO_PROPIETARIOS,
    formaConteo: FormaConteo.POR_COEFICIENTE,
    mayoria: MayoriaRequerida.SIMPLE_PRESENTES,
    desempate: 'RECHAZADA',
    permiteVotoAnticipado: false,
    mostrarParcial: false,
    bloqueaConDeuda: false,
    apertura: enHoras(-1),
    cierre: enHoras(1),
    estado: EstadoVotacion.ABIERTA,
    resultado: null,
    opcionVotos: OPCIONES,
    ...over,
  }) as unknown as Votacion;

const deAsamblea = (estadoAsamblea: EstadoAsamblea, over: Partial<Votacion> = {}) =>
  votacion({
    asambleaId: 'as1',
    asamblea: { id: 'as1', estado: estadoAsamblea, quorumRequerido: 60 } as Asamblea,
    puntoOrdenDiaId: 'pt1',
    ...over,
  });

const UNIDADES: UnidadParaPadron[] = [
  { unidadId: 'u1', etiqueta: '1A', coeficiente: 60, vinculos: [{ usuarioId: 'p1', vinculo: VinculoUnidad.PROPIETARIO }] },
  {
    unidadId: 'u2',
    etiqueta: '1B',
    coeficiente: 40,
    vinculos: [
      { usuarioId: 'p2', vinculo: VinculoUnidad.PROPIETARIO },
      { usuarioId: 'i2', vinculo: VinculoUnidad.INQUILINO },
    ],
  },
];

function crearService(
  opts: {
    votacion?: Votacion | null;
    votos?: Partial<Voto>[];
    punto?: PuntoOrdenDia | null;
    puntoTieneVotacion?: boolean;
    conDeuda?: boolean;
    vencidas?: Votacion[];
    choque?: boolean;
    asistencias?: { estado: EstadoAsistencia; coeficienteAplicado: number }[];
  } = {},
) {
  const escrito = {
    creada: null as unknown,
    extras: null as unknown,
    actualizada: [] as unknown[],
    votos: [] as Partial<Voto>[],
    publicados: [] as unknown[][],
  };
  const votos = opts.votos ?? [];
  const repo = {
    listar: async () => [],
    findById: async () => (opts.votacion === undefined ? votacion() : opts.votacion),
    abiertasVencidas: async () => opts.vencidas ?? [],
    abiertas: async () => [],
    findPunto: async () => opts.punto ?? null,
    puntoTieneVotacion: async () => opts.puntoTieneVotacion ?? false,
    crear: async (datos: unknown, extras: unknown) => {
      escrito.creada = datos;
      escrito.extras = extras;
      return 'vt1';
    },
    actualizar: async (_id: string, cambios: unknown) => {
      escrito.actualizada.push(cambios);
    },
    reemplazarOpciones: async () => undefined,
    eliminar: async () => undefined,
    votosDe: async () => votos,
    findVoto: async (_v: string, unidadId: string) => votos.find((x) => x.unidadId === unidadId) ?? null,
    crearVoto: async (datos: Partial<Voto>) => {
      if (opts.choque) return null;
      escrito.votos.push(datos);
      return { id: 'vo1', ...datos };
    },
    unidadesParaPadron: async () => UNIDADES,
    asistenciasDe: async () => opts.asistencias ?? [],
    consorciosDelUsuario: async () => ['c1'],
    vecinosDelConsorcio: async () => ['p1', 'p2'],
  } as unknown as VotacionesRepository;

  const service = new VotacionesService(
    repo,
    { findOne: async () => ({ id: 'c1' }) } as unknown as ConsorciosService,
    { tieneDeudaVencida: async () => opts.conDeuda ?? false } as unknown as ExpensasService,
    {
      exigirPropia: (url: string) => {
        if (!url.startsWith('https://storage/votaciones/')) throw new BadRequestException('ajena');
      },
    } as unknown as ArchivosService,
    { enviar: async () => undefined } as unknown as Notificador,
    { publicar: (...args: unknown[]) => void escrito.publicados.push(args) } as unknown as PublicadorEventos,
  );
  return { service, escrito };
}

const independiente = (over = {}) => ({
  consorcioId: 'c1',
  titulo: 'Bomba de agua',
  apertura: enHoras(1).toISOString(),
  cierre: enHoras(48).toISOString(),
  ...over,
});

describe('VotacionesService — alta', () => {
  it('una independiente necesita apertura y cierre', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ apertura: undefined })),
      BadRequestException,
    );
  });

  it('el cierre tiene que ser posterior a la apertura', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ cierre: enHoras(0.5).toISOString() })),
      BadRequestException,
    );
  });

  it('el punto tiene que ser CON_VOTACION', async () => {
    const { service } = crearService({
      punto: {
        id: 'pt1',
        tipo: TipoPuntoOrden.INFORMATIVO,
        asambleaId: 'as1',
        asamblea: { consorcioId: 'c1', estado: EstadoAsamblea.CONVOCADA, fechaHora: enHoras(24) },
      } as unknown as PuntoOrdenDia,
    });
    await assert.rejects(
      service.crear(admin, { consorcioId: 'c1', titulo: 'X', puntoOrdenDiaId: 'pt1' }),
      BadRequestException,
    );
  });

  it('un punto no puede tener dos votaciones', async () => {
    const { service } = crearService({
      punto: {
        id: 'pt1',
        tipo: TipoPuntoOrden.CON_VOTACION,
        asambleaId: 'as1',
        asamblea: { consorcioId: 'c1', estado: EstadoAsamblea.CONVOCADA, fechaHora: enHoras(24) },
      } as unknown as PuntoOrdenDia,
      puntoTieneVotacion: true,
    });
    await assert.rejects(
      service.crear(admin, { consorcioId: 'c1', titulo: 'X', puntoOrdenDiaId: 'pt1' }),
      ConflictException,
    );
  });

  it('de asamblea toma la hora de la asamblea si no se indica', async () => {
    const fechaHora = enHoras(24);
    const { service, escrito } = crearService({
      punto: {
        id: 'pt1',
        tipo: TipoPuntoOrden.CON_VOTACION,
        asambleaId: 'as1',
        asamblea: { consorcioId: 'c1', estado: EstadoAsamblea.CONVOCADA, fechaHora },
      } as unknown as PuntoOrdenDia,
    });
    await service.crear(admin, { consorcioId: 'c1', titulo: 'X', puntoOrdenDiaId: 'pt1' });
    const creada = escrito.creada as Votacion;
    assert.equal(creada.asambleaId, 'as1');
    assert.equal(creada.apertura.getTime(), fechaHora.getTime());
    assert.equal(creada.cierre.getTime(), fechaHora.getTime() + 3 * HORA);
  });

  it('el adjunto tiene que venir de archivos', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ adjuntoUrl: 'https://otro.com/p.pdf' })),
      BadRequestException,
    );
  });

  it('las opciones extra no pueden repetir ni pisar las fijas', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, independiente({ opciones: ['a favor'] })),
      BadRequestException,
    );
    await assert.rejects(
      service.crear(admin, independiente({ opciones: ['Abstención', 'abstención'] })),
      BadRequestException,
    );
  });

  it('pasa las extras al repository', async () => {
    const { service, escrito } = crearService();
    await service.crear(admin, independiente({ opciones: ['Abstención'] }));
    assert.deepEqual(escrito.extras, ['Abstención']);
  });
});

describe('VotacionesService — ciclo', () => {
  it('sólo se edita en borrador', async () => {
    const { service } = crearService();
    await assert.rejects(service.editar(admin, 'vt1', { titulo: 'Y' }), ConflictException);
  });

  it('no se publica una independiente con el cierre pasado', async () => {
    const { service } = crearService({
      votacion: votacion({ estado: EstadoVotacion.BORRADOR, apertura: enHoras(-3), cierre: enHoras(-1) }),
    });
    await assert.rejects(service.publicar(admin, 'vt1'), BadRequestException);
  });

  it('no se publica una de asamblea cerrada', async () => {
    const { service } = crearService({
      votacion: deAsamblea(EstadoAsamblea.CERRADA, { estado: EstadoVotacion.BORRADOR }),
    });
    await assert.rejects(service.publicar(admin, 'vt1'), ConflictException);
  });

  it('cerrar guarda el resultado del escrutinio', async () => {
    const { service, escrito } = crearService({
      votos: [{ unidadId: 'u1', opcionId: 'si', coeficienteAplicado: 60 }],
    });
    await service.cerrar(admin, 'vt1');
    assert.deepEqual(escrito.actualizada[0], {
      estado: EstadoVotacion.CERRADA,
      resultado: ResultadoVotacion.APROBADA,
    });
    const [tipo, consorcio, payload] = escrito.publicados[0] as [string, string, { resultado: string }];
    assert.equal(tipo, 'votacion.cerrada');
    assert.equal(consorcio, 'c1');
    assert.equal(payload.resultado, 'aprobada');
  });

  it('publicar una independiente anuncia votacion.nueva', async () => {
    const { service, escrito } = crearService({ votacion: votacion({ estado: EstadoVotacion.BORRADOR }) });
    await service.publicar(admin, 'vt1');
    assert.deepEqual(escrito.publicados[0], [
      'votacion.nueva',
      'c1',
      {
        votacion_id: 'vt1',
        titulo: 'Bomba de agua',
        fecha_cierre: (escrito.publicados[0] as [string, string, { fecha_cierre: string }])[2].fecha_cierre,
        mayoria_necesaria: MayoriaRequerida.SIMPLE_PRESENTES,
      },
    ]);
  });

  it('de asamblea sin quórum cierra SIN_QUORUM', async () => {
    const { service, escrito } = crearService({
      votacion: deAsamblea(EstadoAsamblea.EN_CURSO),
      votos: [{ unidadId: 'u1', opcionId: 'si', coeficienteAplicado: 60 }],
      asistencias: [
        { estado: EstadoAsistencia.ASISTE, coeficienteAplicado: 30 },
        { estado: EstadoAsistencia.NO_ASISTE, coeficienteAplicado: 70 },
      ],
    });
    await service.cerrar(admin, 'vt1');
    assert.equal((escrito.actualizada[0] as Votacion).resultado, ResultadoVotacion.SIN_QUORUM);
  });

  it('una independiente vencida se cierra sola al consultar', async () => {
    const { service, escrito } = crearService({
      vencidas: [votacion({ cierre: enHoras(-1) })],
    });
    await service.listar(admin, {});
    assert.equal((escrito.actualizada[0] as Votacion).estado, EstadoVotacion.CERRADA);
  });
});

describe('VotacionesService — voto del vecino', () => {
  it('vota por su unidad con el peso del coeficiente', async () => {
    const { service, escrito } = crearService();
    await service.votar(p1, 'vt1', { opcionId: 'si' });
    assert.deepEqual(escrito.votos[0], {
      votacionId: 'vt1',
      unidadId: 'u1',
      opcionId: 'si',
      emitidoPorId: 'p1',
      coeficienteAplicado: 60,
      anticipado: false,
    });
  });

  it('el administrador no vota desde la app', async () => {
    const { service } = crearService();
    await assert.rejects(service.votar(admin, 'vt1', { opcionId: 'si' }), ForbiddenException);
  });

  it('con padrón de propietarios, el inquilino no vota', async () => {
    const { service } = crearService();
    await assert.rejects(service.votar(inquilino, 'vt1', { opcionId: 'si' }), ForbiddenException);
  });

  it('una opción de otra votación es 400', async () => {
    const { service } = crearService();
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'otra' }), BadRequestException);
  });

  it('con deuda vencida y bloqueo, no vota', async () => {
    const { service } = crearService({ votacion: votacion({ bloqueaConDeuda: true }), conDeuda: true });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ForbiddenException);
  });

  it('antes de la apertura es 409', async () => {
    const { service } = crearService({ votacion: votacion({ apertura: enHoras(1), cierre: enHoras(2) }) });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ConflictException);
  });

  it('si la administración ya cargó su voto, 409 y lo dice', async () => {
    const { service } = crearService({
      votos: [
        {
          unidadId: 'u1',
          opcionId: 'no',
          coeficienteAplicado: 60,
          createdAt: new Date(),
          emitidoPor: { id: 'a1', rol: RolUsuario.ADMINISTRADOR } as Voto['emitidoPor'],
        },
      ],
    });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), /administración/);
  });

  it('si dos votos llegan a la vez, el segundo es 409', async () => {
    const { service } = crearService({ choque: true });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ConflictException);
  });

  it('de asamblea convocada sin voto anticipado, todavía no se vota', async () => {
    const { service } = crearService({ votacion: deAsamblea(EstadoAsamblea.CONVOCADA) });
    await assert.rejects(service.votar(p1, 'vt1', { opcionId: 'si' }), ConflictException);
  });

  it('con voto anticipado, vota antes y queda marcado', async () => {
    const { service, escrito } = crearService({
      votacion: deAsamblea(EstadoAsamblea.CONVOCADA, { permiteVotoAnticipado: true }),
    });
    await service.votar(p1, 'vt1', { opcionId: 'si' });
    assert.equal(escrito.votos[0].anticipado, true);
  });
});

describe('VotacionesService — voto presencial', () => {
  it('lo carga el admin con la asamblea en curso', async () => {
    const { service, escrito } = crearService({ votacion: deAsamblea(EstadoAsamblea.EN_CURSO) });
    await service.votarPresencial(admin, 'vt1', 'u2', { opcionId: 'no' });
    assert.equal(escrito.votos[0].emitidoPorId, 'a1');
    assert.equal(escrito.votos[0].coeficienteAplicado, 40);
  });

  it('una independiente no tiene voto presencial', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.votarPresencial(admin, 'vt1', 'u2', { opcionId: 'no' }),
      BadRequestException,
    );
  });

  it('una unidad fuera del padrón es 400', async () => {
    const { service } = crearService({ votacion: deAsamblea(EstadoAsamblea.EN_CURSO) });
    await assert.rejects(
      service.votarPresencial(admin, 'vt1', 'u9', { opcionId: 'no' }),
      BadRequestException,
    );
  });

  it('si el vecino ya votó desde la app, 409', async () => {
    const { service } = crearService({
      votacion: deAsamblea(EstadoAsamblea.EN_CURSO),
      votos: [
        {
          unidadId: 'u2',
          opcionId: 'si',
          coeficienteAplicado: 40,
          createdAt: new Date(),
          emitidoPor: { id: 'p2', rol: RolUsuario.VECINO } as Voto['emitidoPor'],
        },
      ],
    });
    await assert.rejects(
      service.votarPresencial(admin, 'vt1', 'u2', { opcionId: 'no' }),
      /desde la app/,
    );
  });
});

describe('VotacionesService — visibilidad', () => {
  it('al administrador de otro consorcio, la votación le da 404 y no la gestiona', async () => {
    const { service } = crearService();
    await assert.rejects(service.findOne(adminAjeno, 'vt1'), NotFoundException);
    await assert.rejects(service.cerrar(adminAjeno, 'vt1'), NotFoundException);
    await assert.rejects(service.padronConVotos(adminAjeno, 'vt1'), NotFoundException);
  });

  it('el vecino no ve borradores', async () => {
    const { service } = crearService({ votacion: votacion({ estado: EstadoVotacion.BORRADOR }) });
    await assert.rejects(service.findOne(p1, 'vt1'), NotFoundException);
  });

  it('sin mostrar parcial, el vecino no ve el conteo mientras está abierta', async () => {
    const { service } = crearService();
    const detalle = await service.findOne(p1, 'vt1');
    assert.equal(detalle.escrutinio, null);
  });

  it('cerrada, el vecino ve el conteo', async () => {
    const { service } = crearService({ votacion: votacion({ estado: EstadoVotacion.CERRADA }) });
    const detalle = await service.findOne(p1, 'vt1');
    assert.notEqual(detalle.escrutinio, null);
  });

  it('el vecino ve cuánto pesa su voto', async () => {
    const { service } = crearService();
    const detalle = (await service.findOne(p1, 'vt1')) as { misUnidades: { pesoPorcentaje: number }[] };
    assert.equal(detalle.misUnidades[0].pesoPorcentaje, 60);
  });
});
