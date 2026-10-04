import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PublicadorEventos } from '../../core/mensajeria/publicador-eventos';
import {
  Asamblea,
  Asistencia,
  EstadoAsamblea,
  EstadoAsistencia,
  ModalidadAsamblea,
  RolUsuario,
} from '../../database/entities';
import type { ArchivosService } from '../archivos/archivos.service';
import type { UsuarioActual } from '../auth/auth.types';
import type { ConsorciosService } from '../consorcios/consorcios.service';
import type { AsambleasRepository } from './asambleas.repository';
import { AsambleasService } from './asambleas.service';

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
const vecino: UsuarioActual = { id: 'v1', email: 'v@x', rol: RolUsuario.VECINO };

const FUTURO = new Date(Date.now() + 7 * 24 * 3600 * 1000);

const asamblea = (over: Partial<Asamblea> = {}) =>
  ({
    id: 'as1',
    consorcioId: 'c1',
    titulo: 'Ordinaria',
    modalidad: ModalidadAsamblea.PRESENCIAL,
    lugar: 'SUM',
    linkVideollamada: null,
    fechaHora: FUTURO,
    quorumRequerido: 60,
    estado: EstadoAsamblea.BORRADOR,
    puntoOrdenDias: [{ id: 'p1', orden: 1, titulo: 'Acta' }],
    ...over,
  }) as Asamblea;

const asistencia = (unidadId: string, estado: EstadoAsistencia, coef: number) =>
  ({
    id: `s-${unidadId}`,
    unidadId,
    estado,
    coeficienteAplicado: coef,
    unidad: { id: unidadId, etiqueta: unidadId },
    apoderadoUnidad: null,
    confirmadaPor: null,
    confirmadaAt: null,
  }) as unknown as Asistencia;

/** Repository en memoria que anota las escrituras. */
function crearService(
  opts: {
    asamblea?: Asamblea | null;
    asistencias?: Asistencia[];
    unidadesActivas?: { id: string; coeficiente: number }[];
    unidadesDelVecino?: string[];
    consorciosDelVecino?: string[];
    votacionesAbiertas?: number;
  } = {},
) {
  const escrito = {
    creada: null as unknown,
    actualizada: [] as unknown[],
    convocada: null as unknown,
    asistencia: [] as unknown[],
    listarFiltro: null as unknown,
    proximasConsorcios: null as unknown,
    publicados: [] as unknown[][],
  };
  const asistencias = opts.asistencias ?? [];
  const repo = {
    listar: async (_q: unknown, filtro: unknown) => {
      escrito.listarFiltro = filtro;
      return [];
    },
    agregadosQuorum: async () => new Map(),
    findById: async () => (opts.asamblea === undefined ? asamblea() : opts.asamblea),
    crear: async (datos: unknown) => {
      escrito.creada = datos;
      return 'as1';
    },
    actualizar: async (_id: string, cambios: unknown) => {
      escrito.actualizada.push(cambios);
    },
    reemplazarOrdenDia: async () => undefined,
    eliminar: async () => undefined,
    unidadesActivas: async () =>
      opts.unidadesActivas ?? [
        { id: 'u1', coeficiente: 50 },
        { id: 'u2', coeficiente: 50 },
      ],
    convocar: async (_id: string, filas: unknown) => {
      escrito.convocada = filas;
    },
    asistencias: async () => asistencias,
    findAsistencia: async (_a: string, unidadId: string) =>
      asistencias.find((s) => s.unidadId === unidadId) ?? null,
    guardarAsistencia: async (_id: string, cambios: unknown) => {
      escrito.asistencia.push(cambios);
    },
    consorciosDelUsuario: async () => opts.consorciosDelVecino ?? ['c1'],
    unidadesDelUsuarioEnConsorcio: async () => opts.unidadesDelVecino ?? [],
    vecinosDelConsorcio: async () => ['v1'],
    votacionesAbiertas: async () => opts.votacionesAbiertas ?? 0,
    proximas: async (consorcioIds: string[]) => {
      escrito.proximasConsorcios = consorcioIds;
      return [asamblea({ estado: EstadoAsamblea.CONVOCADA })];
    },
  } as unknown as AsambleasRepository;
  const consorcios = { findOne: async () => ({ id: 'c1' }) } as unknown as ConsorciosService;
  const eventos = {
    publicar: (...args: unknown[]) => void escrito.publicados.push(args),
  } as unknown as PublicadorEventos;
  // Sólo son nuestras las URLs de actas que subió `archivos`.
  const archivos = {
    exigirPropia: (url: string) => {
      if (!url.startsWith('https://storage/actas/')) throw new BadRequestException('ajena');
    },
  } as unknown as ArchivosService;
  return { service: new AsambleasService(repo, consorcios, eventos, archivos), escrito };
}

const crearDto = (over = {}) => ({
  consorcioId: 'c1',
  titulo: 'Ordinaria',
  fechaHora: FUTURO.toISOString(),
  lugar: 'SUM',
  ...over,
});

describe('AsambleasService — crear y editar', () => {
  it('crea en borrador con quórum 60 por defecto', async () => {
    const { service, escrito } = crearService();
    await service.crear(admin, crearDto());
    assert.equal((escrito.creada as Asamblea).quorumRequerido, 60);
    assert.equal((escrito.creada as Asamblea).creadaPorId, 'a1');
  });

  it('presencial sin lugar es 400', async () => {
    const { service } = crearService();
    await assert.rejects(service.crear(admin, crearDto({ lugar: undefined })), BadRequestException);
  });

  it('digital sin link es 400', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, crearDto({ modalidad: ModalidadAsamblea.DIGITAL })),
      BadRequestException,
    );
  });

  it('híbrida exige lugar y link', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, crearDto({ modalidad: ModalidadAsamblea.HIBRIDA })),
      BadRequestException,
    );
  });

  it('fecha pasada es 400', async () => {
    const { service } = crearService();
    await assert.rejects(
      service.crear(admin, crearDto({ fechaHora: '2020-01-01T19:00:00Z' })),
      BadRequestException,
    );
  });

  it('no se edita una asamblea convocada', async () => {
    const { service } = crearService({ asamblea: asamblea({ estado: EstadoAsamblea.CONVOCADA }) });
    await assert.rejects(service.editar(admin, 'as1', { titulo: 'Otro' }), ConflictException);
  });

  it('no se elimina una asamblea convocada', async () => {
    const { service } = crearService({ asamblea: asamblea({ estado: EstadoAsamblea.CONVOCADA }) });
    await assert.rejects(service.eliminar(admin, 'as1'), ConflictException);
  });

  it('inexistente es 404', async () => {
    const { service } = crearService({ asamblea: null });
    await assert.rejects(service.findOne(admin, 'as1'), NotFoundException);
  });
});

describe('AsambleasService — administrador de otro consorcio', () => {
  it('lista sólo las de sus consorcios', async () => {
    const { service, escrito } = crearService();
    await service.listar(adminAjeno, {});
    assert.deepEqual(escrito.listarFiltro, { consorcioIds: ['c2'], ocultarBorradores: false });
  });

  it('una asamblea ajena le da 404 y no la gestiona', async () => {
    const { service } = crearService();
    await assert.rejects(service.findOne(adminAjeno, 'as1'), NotFoundException);
    await assert.rejects(service.convocar(adminAjeno, 'as1'), NotFoundException);
    await assert.rejects(service.listarAsistencias(adminAjeno, 'as1'), NotFoundException);
  });

  it('no convoca en un consorcio ajeno', async () => {
    const { service } = crearService();
    await assert.rejects(service.crear(adminAjeno, crearDto()), NotFoundException);
  });
});

describe('AsambleasService — ciclo de vida', () => {
  it('convocar copia el coeficiente de cada unidad activa', async () => {
    const { service, escrito } = crearService({
      unidadesActivas: [
        { id: 'u1', coeficiente: 12.5 },
        { id: 'u2', coeficiente: 87.5 },
      ],
    });
    await service.convocar(admin, 'as1');
    assert.deepEqual(escrito.convocada, [
      { unidadId: 'u1', coeficienteAplicado: 12.5 },
      { unidadId: 'u2', coeficienteAplicado: 87.5 },
    ]);
    const [tipo, consorcio, payload] = escrito.publicados[0] as [string, string, { asamblea_id: string }];
    assert.equal(tipo, 'asamblea.creada');
    assert.equal(consorcio, 'c1');
    assert.equal(payload.asamblea_id, 'as1');
  });

  it('convocar sin orden del día es 400', async () => {
    const { service } = crearService({ asamblea: asamblea({ puntoOrdenDias: [] }) });
    await assert.rejects(service.convocar(admin, 'as1'), BadRequestException);
  });

  it('convocar sin unidades activas es 400', async () => {
    const { service } = crearService({ unidadesActivas: [] });
    await assert.rejects(service.convocar(admin, 'as1'), BadRequestException);
  });

  it('iniciar sólo desde convocada', async () => {
    const { service } = crearService();
    await assert.rejects(service.iniciar(admin, 'as1'), ConflictException);
  });

  it('cerrar con quórum alcanzado queda CERRADA', async () => {
    const { service, escrito } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }),
      asistencias: [
        asistencia('u1', EstadoAsistencia.ASISTE, 70),
        asistencia('u2', EstadoAsistencia.NO_ASISTE, 30),
      ],
    });
    await service.cerrar(admin, 'as1');
    assert.deepEqual(escrito.actualizada, [{ estado: EstadoAsamblea.CERRADA }]);
  });

  it('no se cierra con votaciones abiertas', async () => {
    const { service, escrito } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }),
      votacionesAbiertas: 1,
    });
    await assert.rejects(service.cerrar(admin, 'as1'), /votaciones/);
    assert.deepEqual(escrito.actualizada, []);
  });

  it('cerrar sin quórum queda CERRADA_SIN_QUORUM', async () => {
    const { service, escrito } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }),
      asistencias: [
        asistencia('u1', EstadoAsistencia.ASISTE, 30),
        asistencia('u2', EstadoAsistencia.SIN_RESPONDER, 70),
      ],
    });
    await service.cerrar(admin, 'as1');
    assert.deepEqual(escrito.actualizada, [{ estado: EstadoAsamblea.CERRADA_SIN_QUORUM }]);
  });

  it('el acta sólo se carga en una asamblea cerrada', async () => {
    const { service } = crearService({ asamblea: asamblea({ estado: EstadoAsamblea.EN_CURSO }) });
    await assert.rejects(
      service.cargarActa(admin, 'as1', { actaUrl: 'https://storage/actas/a1/x.pdf' }),
      ConflictException,
    );
  });

  it('el acta tiene que ser un archivo subido a actas', async () => {
    const { service, escrito } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.CERRADA }),
    });
    await assert.rejects(
      service.cargarActa(admin, 'as1', { actaUrl: 'https://x.com/acta.pdf' }),
      BadRequestException,
    );
    assert.deepEqual(escrito.actualizada, []);
  });

  it('guarda un acta subida a actas', async () => {
    const { service, escrito } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.CERRADA }),
    });
    await service.cargarActa(admin, 'as1', { actaUrl: 'https://storage/actas/a1/x.pdf' });
    assert.deepEqual(escrito.actualizada, [{ actaUrl: 'https://storage/actas/a1/x.pdf' }]);
  });
});

describe('AsambleasService — asistencia del vecino', () => {
  const convocada = asamblea({ estado: EstadoAsamblea.CONVOCADA });
  const padron = () => [
    asistencia('u1', EstadoAsistencia.SIN_RESPONDER, 50),
    asistencia('u2', EstadoAsistencia.SIN_RESPONDER, 50),
  ];

  it('infiere la unidad si tiene una sola', async () => {
    const { service, escrito } = crearService({
      asamblea: convocada,
      asistencias: padron(),
      unidadesDelVecino: ['u1'],
    });
    await service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE });
    assert.equal((escrito.asistencia[0] as Asistencia).estado, EstadoAsistencia.ASISTE);
    assert.equal((escrito.asistencia[0] as Asistencia).confirmadaPorId, 'v1');
  });

  it('con varias unidades y sin indicar es 400', async () => {
    const { service } = crearService({
      asamblea: convocada,
      asistencias: padron(),
      unidadesDelVecino: ['u1', 'u2'],
    });
    await assert.rejects(
      service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE }),
      BadRequestException,
    );
  });

  it('una unidad ajena es 403', async () => {
    const { service } = crearService({
      asamblea: convocada,
      asistencias: padron(),
      unidadesDelVecino: ['u1'],
    });
    await assert.rejects(
      service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE, unidadId: 'u2' }),
      ForbiddenException,
    );
  });

  it('no puede responder en una asamblea cerrada', async () => {
    const { service } = crearService({
      asamblea: asamblea({ estado: EstadoAsamblea.CERRADA }),
      asistencias: padron(),
      unidadesDelVecino: ['u1'],
    });
    await assert.rejects(
      service.confirmarAsistencia(vecino, 'as1', { estado: EstadoAsistencia.ASISTE }),
      ConflictException,
    );
  });

  it('no ve borradores: 404', async () => {
    const { service } = crearService({ unidadesDelVecino: ['u1'] });
    await assert.rejects(service.findOne(vecino, 'as1'), NotFoundException);
  });

  it('no ve asambleas de otros consorcios: 404', async () => {
    const { service } = crearService({ asamblea: convocada, consorciosDelVecino: ['otro'] });
    await assert.rejects(service.findOne(vecino, 'as1'), NotFoundException);
  });

  it('en el detalle ve sólo su propia asistencia, no las últimas confirmaciones', async () => {
    const { service } = crearService({
      asamblea: convocada,
      asistencias: padron(),
      unidadesDelVecino: ['u1'],
    });
    const detalle = (await service.findOne(vecino, 'as1')) as Record<string, unknown>;
    assert.equal(detalle.ultimasConfirmaciones, undefined);
    assert.deepEqual(
      (detalle.miAsistencia as { unidadId: string }[]).map((a) => a.unidadId),
      ['u1'],
    );
  });

  it('el listado del vecino filtra por sus consorcios y oculta borradores', async () => {
    const { service, escrito } = crearService({ consorciosDelVecino: ['c1'] });
    await service.listar(vecino, {});
    assert.deepEqual(escrito.listarFiltro, { consorcioIds: ['c1'], ocultarBorradores: true });
  });
});

describe('AsambleasService — asistencia registrada por el admin', () => {
  const enCurso = asamblea({ estado: EstadoAsamblea.EN_CURSO });
  const padron = () => [
    asistencia('u1', EstadoAsistencia.SIN_RESPONDER, 50),
    asistencia('u2', EstadoAsistencia.ASISTE, 50),
  ];

  it('poder sin apoderado es 400', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u1', { estado: EstadoAsistencia.CON_PODER }),
      BadRequestException,
    );
  });

  it('una unidad no puede ser su propia apoderada', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u1', {
        estado: EstadoAsistencia.CON_PODER,
        apoderadoUnidadId: 'u1',
      }),
      BadRequestException,
    );
  });

  it('el apoderado tiene que estar en el padrón de la asamblea', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u1', {
        estado: EstadoAsistencia.CON_PODER,
        apoderadoUnidadId: 'u9',
      }),
      BadRequestException,
    );
  });

  it('registra un poder válido', async () => {
    const { service, escrito } = crearService({ asamblea: enCurso, asistencias: padron() });
    await service.registrarAsistencia(admin, 'as1', 'u1', {
      estado: EstadoAsistencia.CON_PODER,
      apoderadoUnidadId: 'u2',
    });
    assert.equal((escrito.asistencia[0] as Asistencia).apoderadoUnidadId, 'u2');
  });

  it('fuera del padrón es 404', async () => {
    const { service } = crearService({ asamblea: enCurso, asistencias: padron() });
    await assert.rejects(
      service.registrarAsistencia(admin, 'as1', 'u9', { estado: EstadoAsistencia.ASISTE }),
      NotFoundException,
    );
  });

  it('al pasar a otro estado limpia el apoderado', async () => {
    const { service, escrito } = crearService({ asamblea: enCurso, asistencias: padron() });
    await service.registrarAsistencia(admin, 'as1', 'u1', {
      estado: EstadoAsistencia.ASISTE,
      apoderadoUnidadId: 'u2',
    });
    assert.equal((escrito.asistencia[0] as Asistencia).apoderadoUnidadId, null);
  });
});

describe('AsambleasService — próximas del vecino', () => {
  it('busca en los consorcios donde vive', async () => {
    const { service, escrito } = crearService({ consorciosDelVecino: ['c1', 'c2'] });
    const proximas = await service.proximasDelVecino(vecino);
    assert.deepEqual(escrito.proximasConsorcios, ['c1', 'c2']);
    assert.equal(proximas.length, 1);
  });

  it('sin consorcios no consulta y devuelve vacío', async () => {
    const { service, escrito } = crearService({ consorciosDelVecino: [] });
    assert.deepEqual(await service.proximasDelVecino(vecino), []);
    assert.equal(escrito.proximasConsorcios, null);
  });
});
