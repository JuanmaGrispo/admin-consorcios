import { EntityManager } from 'typeorm';
import { readFileSync } from 'node:fs';
import dataSource from '../database/data-source';
import {
  CategoriaReclamo,
  Consorcio,
  EstadoReclamo,
  NaturalezaGasto,
  PrioridadReclamo,
  Proveedor,
  Reclamo,
  ReclamoEvento,
  RolUsuario,
  RubroGasto,
  TipoEventoReclamo,
  TipoUnidad,
  Unidad,
  UnidadUsuario,
  Usuario,
  VinculoUnidad,
  Amenity,
  Reserva,
  Liquidacion,
  Gasto,
  Boleta,
  BoletaDetalle,
  Pago,
  Asamblea,
  Asistencia,
  PuntoOrdenDia,
  Votacion,
  OpcionVoto,
  Voto,
  Novedad,
  EstadoReserva,
  EstadoLiquidacion,
  EstadoBoleta,
  EstadoPago,
  ConceptoPago,
  MedioPago,
  CriterioProrrateo,
  EstadoAsamblea,
  EstadoAsistencia,
  EstadoVotacion,
  TipoPuntoOrden,
} from '../database/entities';
import { hashearPassword } from '../modules/auth/password';

/**
 * Datos completos de demo. Sin --aplicar se valida la carga y se revierte
 * la transacción. --personas archivo.json agrega un edificio por integrante.
 *
 *   pnpm back db:seed-demo
 *
 * Es idempotente: busca por la clave natural de cada fila (el email del
 * usuario, el nombre del consorcio) y sólo inserta lo que falta, así que
 * correrlo dos veces no duplica nada. --aplicar escribe en la base compartida:
 * avisar al grupo antes de usarlo. No publica eventos ni envía correos.
 *
 * La password de todos es `Domus.2026`.
 */

const PASSWORD = 'Domus.2026';
const CONSORCIO = 'Av. Rivadavia 4820';

interface PersonaDemo {
  clave: string;
  nombre: string;
  apellido: string;
  email: string;
}

function leerPersonas(): PersonaDemo[] {
  const indice = process.argv.indexOf('--personas');
  if (indice === -1) return [];
  const archivo = process.argv[indice + 1];
  if (!archivo) throw new Error('Falta el archivo JSON después de --personas');
  const filas: unknown = JSON.parse(readFileSync(archivo, 'utf8'));
  if (!Array.isArray(filas) || filas.length === 0) throw new Error('Se espera una lista de personas');
  const claves = new Set<string>();
  const emails = new Set<string>();
  for (const fila of filas) {
    if (!fila || typeof fila !== 'object') throw new Error('Persona de demo inválida');
    const p = fila as PersonaDemo;
    if (typeof p.clave !== 'string' || !/^[a-z0-9-]{1,7}$/.test(p.clave) ||
        typeof p.nombre !== 'string' || !p.nombre.trim() ||
        typeof p.apellido !== 'string' || !p.apellido.trim() ||
        typeof p.email !== 'string' || !/^[a-z0-9.+-]+@domus\.test$/.test(p.email) ||
        claves.has(p.clave) || emails.has(p.email) ||
        ['admin@domus.test', 'vecino@domus.test', 'vecina2@domus.test', 'vecino3@domus.test'].includes(p.email)) {
      throw new Error('Cada persona necesita clave única, nombre, apellido y email único @domus.test');
    }
    claves.add(p.clave);
    emails.add(p.email);
  }
  return filas as PersonaDemo[];
}

/** Devuelve la fila existente o la crea. La clave es lo que la hace idempotente. */
async function obtenerOCrear<T extends object>(
  m: EntityManager,
  entidad: new () => T,
  clave: Partial<T>,
  datos: Partial<T>,
): Promise<T> {
  const repo = m.getRepository(entidad);
  const existente = await repo.findOne({ where: clave as never });
  if (existente) return existente;
  const creada = repo.create({ ...clave, ...datos } as never) as T;
  return (await repo.save(creada as never)) as T;
}

/**
 * Tres reclamos en distintos estados, con su línea de tiempo, para que la
 * bandeja del administrador tenga algo que mostrar. Reproducen los casos del
 * prototipo.
 */
async function sembrarReclamos(m: EntityManager, consorcioId: string, prefijo = '') {
  const unidades = await m.getRepository(Unidad).find({ where: { consorcioId } });
  const porEtiqueta = new Map(unidades.map((u) => [u.etiqueta, u]));
  const vinculos = await m.getRepository(UnidadUsuario).find({
    where: unidades.map((u) => ({ unidadId: u.id })),
  });
  const autorDe = new Map(vinculos.map((v) => [v.unidadId, v.usuarioId]));

  const categorias = await m.getRepository(CategoriaReclamo).find();
  const categoriaPorNombre = new Map(categorias.map((c) => [c.nombre, c.id]));

  const proveedor = await m
    .getRepository(Proveedor)
    .findOne({ where: { consorcioId, razonSocial: 'Gasparini Servicios' } });

  const casos = [
    {
      codigo: 'RC-2026-0001',
      unidad: '3º B',
      categoria: 'Plomeria',
      descripcion: 'Pérdida de agua en el baño, filtra al 2º B',
      prioridad: PrioridadReclamo.ALTA,
      estado: EstadoReclamo.EN_CURSO,
      conProveedor: true,
    },
    {
      codigo: 'RC-2026-0002',
      unidad: '6º B',
      categoria: 'Ascensor',
      descripcion: 'Ascensor principal se traba entre 4º y 5º',
      prioridad: PrioridadReclamo.ALTA,
      estado: EstadoReclamo.NUEVO,
      conProveedor: false,
    },
    {
      codigo: 'RC-2026-0003',
      unidad: '2º A',
      categoria: 'Limpieza',
      descripcion: 'Bolsas sin retirar en el pasillo de entrada',
      prioridad: PrioridadReclamo.BAJA,
      estado: EstadoReclamo.RESUELTO,
      conProveedor: false,
    },
  ];

  for (const caso of casos) {
    const unidad = porEtiqueta.get(caso.unidad);
    const autorId = unidad ? autorDe.get(unidad.id) : undefined;
    const categoriaId = categoriaPorNombre.get(caso.categoria);
    if (!unidad || !autorId || !categoriaId) continue;

    const repo = m.getRepository(Reclamo);
    const codigo = prefijo ? `RC-DEMO-${prefijo}-${caso.codigo.slice(-4)}` : caso.codigo;
    if (await repo.findOne({ where: { codigo } })) continue;

    const reclamo = await repo.save(
      repo.create({
        codigo,
        consorcioId,
        unidadId: unidad.id,
        creadoPorId: autorId,
        categoriaId,
        descripcion: caso.descripcion,
        prioridad: caso.prioridad,
        estado: caso.estado,
        proveedorId: caso.conProveedor ? (proveedor?.id ?? null) : null,
        // La base exige que cerrado_at acompañe al estado RESUELTO.
        cerradoAt: caso.estado === EstadoReclamo.RESUELTO ? new Date() : null,
      }),
    );

    const eventos = m.getRepository(ReclamoEvento);
    await eventos.save(
      eventos.create({
        reclamoId: reclamo.id,
        autorId,
        tipo: TipoEventoReclamo.CREACION,
        estadoNuevo: EstadoReclamo.NUEVO,
        visibleParaVecino: true,
      }),
    );

    if (caso.estado !== EstadoReclamo.NUEVO) {
      await eventos.save(
        eventos.create({
          reclamoId: reclamo.id,
          autorId,
          tipo: TipoEventoReclamo.CAMBIO_ESTADO,
          estadoAnterior: EstadoReclamo.NUEVO,
          estadoNuevo: caso.estado,
          visibleParaVecino: true,
        }),
      );
    }
  }
}

async function sembrarConsorcio(m: EntityManager, hash: string, persona?: PersonaDemo) {
  // ── Administrador ──
  const admin = await obtenerOCrear(
    m,
    Usuario,
    { email: persona?.email ?? 'admin@domus.test' },
    {
      nombre: persona?.nombre ?? 'Mónica',
      apellido: persona?.apellido ?? 'Ferreyra',
      passwordHash: hash,
      rol: RolUsuario.ADMINISTRADOR,
      telefono: '11-5555-0001',
    },
  );
  if (admin.rol !== RolUsuario.ADMINISTRADOR) throw new Error('El email del administrador tiene otro rol');

  // ── Consorcio ──
  const consorcio = await obtenerOCrear(
    m,
    Consorcio,
    { nombre: persona ? `Demo ${persona.clave}` : CONSORCIO },
    {
      administradorId: admin.id,
      calle: 'Av. Rivadavia',
      numero: '4820',
      barrio: 'Almagro',
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      cp: 'C1424',
      cuit: persona ? null : '30-71234567-8',
      diaVencimiento: 10,
      tasaInteresMora: 2.5,
      porcentajeFondoReserva: 5,
    },
  );
  if (consorcio.administradorId !== admin.id) throw new Error('El edificio de demo pertenece a otro administrador');

  // ── Unidades y vecinos ──
  const vecinos: { unidad: string; coef: number; nombre: string; apellido: string; email: string }[] = [
    { unidad: '3º B', coef: 4.5, nombre: 'Osvaldo', apellido: 'Pereyra', email: 'vecino@domus.test' },
    { unidad: '6º B', coef: 5.1, nombre: 'Silvina', apellido: 'Ferrari', email: 'vecina2@domus.test' },
    { unidad: '2º A', coef: 4.2, nombre: 'Rubén', apellido: 'Sosa', email: 'vecino3@domus.test' },
  ];

  // Completa 12 pisos de 4 departamentos, conservando las tres unidades originales.
  const etiquetas = Array.from({ length: 12 }, (_, i) =>
    ['A', 'B', 'C', 'D'].map((letra) => `${i + 1}º ${letra}`)).flat();
  const existentes = await m.getRepository(Unidad).find({ where: { consorcioId: consorcio.id } });
  if (existentes.some((u) => !etiquetas.includes(u.etiqueta) || !u.activa)) {
    throw new Error('El consorcio de demo tiene unidades ajenas al seed o inactivas');
  }
  const conocidas = new Map(existentes.map((u) => [u.etiqueta, u.coeficiente]));
  for (const v of vecinos) if (!conocidas.has(v.unidad)) conocidas.set(v.unidad, v.coef);
  const faltantes = etiquetas.filter((e) => !conocidas.has(e));
  const disponible = Math.round((100 - [...conocidas.values()].reduce((a, b) => a + b, 0)) * 10000);
  if (disponible < 0 || (faltantes.length === 0 && disponible !== 0)) {
    throw new Error('Los coeficientes existentes no permiten completar el 100%');
  }
  faltantes.forEach((etiqueta, i) => conocidas.set(etiqueta,
    (Math.floor(disponible / faltantes.length) + (i < disponible % faltantes.length ? 1 : 0)) / 10000));
  for (const [i, etiqueta] of etiquetas.entries()) {
    const original = vecinos.find((v) => v.unidad === etiqueta);
    const v = {
      unidad: etiqueta,
      coef: conocidas.get(etiqueta)!,
      nombre: original?.nombre ?? `Vecino ${i + 1}`,
      apellido: original?.apellido ?? 'Demo',
      email: persona ? `vecino+${persona.clave}-${i + 1}@domus.test` :
        (original?.email ?? `vecino+general-${i + 1}@domus.test`),
    };
    const unidad = await obtenerOCrear(
      m,
      Unidad,
      { consorcioId: consorcio.id, etiqueta: v.unidad },
      { tipo: TipoUnidad.DEPARTAMENTO, coeficiente: v.coef },
    );
    const usuario = await obtenerOCrear(
      m,
      Usuario,
      { email: v.email },
      {
        nombre: v.nombre,
        apellido: v.apellido,
        passwordHash: hash,
        rol: RolUsuario.VECINO,
      },
    );

    if (usuario.rol !== RolUsuario.VECINO) throw new Error('Un email de vecino tiene otro rol');

    await obtenerOCrear(
      m,
      UnidadUsuario,
      { unidadId: unidad.id, usuarioId: usuario.id },
      { vinculo: VinculoUnidad.PROPIETARIO, esTitular: true },
    );
  }

  // ── Proveedores ──
  const proveedores = [
    { razonSocial: 'Gasparini Servicios', rubro: 'Plomería', email: 'contacto@gasparini.test' },
    { razonSocial: 'Nievas SRL', rubro: 'Ascensores', email: 'turnos@nievas.test' },
    { razonSocial: 'Electro Almagro', rubro: 'Electricidad', email: 'info@electroalmagro.test' },
  ];
  for (const p of proveedores) {
    await obtenerOCrear(
      m,
      Proveedor,
      { consorcioId: consorcio.id, razonSocial: p.razonSocial },
      { rubro: p.rubro, email: p.email },
    );
  }

  // Un rubro de gasto propio, por si hace falta para liquidación.
  await obtenerOCrear(
    m,
    RubroGasto,
    { consorcioId: consorcio.id, nombre: 'Mantenimiento' },
    { naturaleza: NaturalezaGasto.ORDINARIO, icono: 'build' },
  );

  await sembrarReclamos(m, consorcio.id, persona?.clave);
  await sembrarActividad(m, consorcio.id, admin.id);
  console.log(`  ${consorcio.nombre}: 48 departamentos · admin ${admin.email}`);
}

async function sembrarActividad(m: EntityManager, consorcioId: string, adminId: string) {
  const unidades = await m.getRepository(Unidad).find({ where: { consorcioId }, order: { etiqueta: 'ASC' } });
  const vinculos = await m.getRepository(UnidadUsuario).find({ where: unidades.map((u) => ({ unidadId: u.id })) });
  const autorDe = new Map(vinculos.filter((v) => v.esTitular && !v.hasta).map((v) => [v.unidadId, v.usuarioId]));
  const fecha = (dia: number, hora = 0) => new Date(`2026-10-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:00:00-03:00`);
  // Período fijo: volver a correr el seed otro mes no agrega liquidaciones nuevas.
  const existente = await m.getRepository(Liquidacion).findOne({ where: { consorcioId, periodo: '2026-09-01' } });
  if (existente && !await m.getRepository(Gasto).findOne({ where: {
    liquidacionId: existente.id, descripcion: 'Mantenimiento mensual de demo',
  } })) throw new Error('Ya existe una liquidación ajena al seed para septiembre de 2026');
  const liquidacion = await obtenerOCrear(m, Liquidacion, { consorcioId, periodo: '2026-09-01' }, {
    creadaPorId: adminId, estado: EstadoLiquidacion.EMITIDA, criterioProrrateo: CriterioProrrateo.PARTES_IGUALES,
    fechaVencimiento: '2026-10-05', fechaEmision: fecha(1), totalGastos: 2400000, totalEmitido: 2520000,
  });
  const rubro = await obtenerOCrear(m, RubroGasto, { consorcioId, nombre: 'Mantenimiento' }, { naturaleza: NaturalezaGasto.ORDINARIO });
  const gasto = await obtenerOCrear(m, Gasto, { liquidacionId: liquidacion.id, descripcion: 'Mantenimiento mensual de demo' }, {
    rubroId: rubro.id, monto: 2400000, naturaleza: NaturalezaGasto.ORDINARIO,
  });
  for (const [i, unidad] of unidades.entries()) {
    const boleta = await obtenerOCrear(m, Boleta, { liquidacionId: liquidacion.id, unidadId: unidad.id }, {
      coeficienteAplicado: unidad.coeficiente, importeOrdinarias: 50000, fondoReserva: 2500, total: 52500,
      estado: i % 3 === 0 ? EstadoBoleta.PAGADA : i % 3 === 1 ? EstadoBoleta.PARCIAL : EstadoBoleta.VENCIDA,
    });
    await obtenerOCrear(m, BoletaDetalle, { boletaId: boleta.id, concepto: 'Mantenimiento mensual de demo' }, { gastoId: gasto.id, monto: 50000 });
    await obtenerOCrear(m, BoletaDetalle, { boletaId: boleta.id, concepto: 'Fondo de reserva' }, { monto: 2500 });
    if (i % 3 !== 2) await obtenerOCrear(m, Pago, { boletaId: boleta.id, reciboNumero: 'DEMO-202609' }, {
      unidadId: unidad.id, registradoPorId: adminId, concepto: ConceptoPago.EXPENSA,
      monto: i % 3 === 0 ? 52500 : 20000, medio: MedioPago.TRANSFERENCIA,
      estado: EstadoPago.APROBADO, fechaPago: fecha(3),
    });
  }
  for (const [indice, nombre] of ['SUM', 'Parrilla'].entries()) {
    const amenity = await obtenerOCrear(m, Amenity, { consorcioId, nombre }, {
      cupoPersonas: nombre === 'SUM' ? 30 : 12, horaApertura: '08:00', horaCierre: '22:00',
      duracionMaximaHoras: 4, duracionFranjaMinutos: 120, requiereAprobacion: true,
      reglamento: 'Dejar el espacio limpio y respetar el horario de cierre.',
    });
    for (let i = 0; i < 3; i++) {
      const unidad = unidades[i];
      const solicitadaPorId = autorDe.get(unidad.id);
      if (!solicitadaPorId) throw new Error('Falta el titular de una unidad de demo');
      await obtenerOCrear(m, Reserva, { amenityId: amenity.id, motivo: `Reserva de demo ${i + 1}` }, {
        unidadId: unidad.id, solicitadaPorId, inicio: fecha(15 + i + indice * 3, 16), fin: fecha(15 + i + indice * 3, 18),
        estado: i === 0 ? EstadoReserva.PENDIENTE : EstadoReserva.APROBADA,
        resueltaPorId: i === 0 ? null : adminId, resueltaAt: i === 0 ? null : fecha(8),
      });
    }
  }
  const asamblea = await obtenerOCrear(m, Asamblea, { consorcioId, titulo: 'Asamblea ordinaria de demo' }, {
    creadaPorId: adminId, fechaHora: fecha(25, 19), lugar: 'SUM', estado: EstadoAsamblea.CONVOCADA,
  });
  for (const [i, unidad] of unidades.entries()) {
    const confirmadaPorId = autorDe.get(unidad.id);
    if (!confirmadaPorId) throw new Error('Falta el titular en el padrón de la asamblea');
    await obtenerOCrear(m, Asistencia, { asambleaId: asamblea.id, unidadId: unidad.id }, {
      coeficienteAplicado: unidad.coeficiente,
      estado: i < 24 ? EstadoAsistencia.ASISTE : EstadoAsistencia.SIN_RESPONDER,
      confirmadaPorId: i < 24 ? confirmadaPorId : null, confirmadaAt: i < 24 ? fecha(8) : null,
    });
  }
  const punto = await obtenerOCrear(m, PuntoOrdenDia, { asambleaId: asamblea.id, orden: 1 }, {
    titulo: 'Renovación de luminarias', tipo: TipoPuntoOrden.CON_VOTACION,
  });
  const votacion = await obtenerOCrear(m, Votacion, { puntoOrdenDiaId: punto.id }, {
    consorcioId, asambleaId: asamblea.id, titulo: punto.titulo, apertura: fecha(1), cierre: fecha(25, 20),
    permiteVotoAnticipado: true, mostrarParcial: true, estado: EstadoVotacion.ABIERTA,
  });
  for (const [i, etiqueta] of ['A favor', 'En contra', 'Abstención'].entries()) {
    const opcion = await obtenerOCrear(m, OpcionVoto, { votacionId: votacion.id, orden: i + 1 }, { etiqueta, esFija: i < 2 });
    const unidad = unidades[i + 3];
    const emitidoPorId = autorDe.get(unidad.id);
    if (!emitidoPorId) throw new Error('Falta el titular para el voto de demo');
    await obtenerOCrear(m, Voto, { votacionId: votacion.id, unidadId: unidad.id }, {
      opcionId: opcion.id, emitidoPorId, coeficienteAplicado: unidad.coeficiente, anticipado: true,
    });
  }
  for (const [titulo, cuerpo] of [
    ['Bienvenidos a Domus', 'Ya pueden consultar expensas, gestionar reclamos y reservar espacios comunes.'],
    ['Mantenimiento del ascensor', 'El servicio técnico realizará la revisión mensual el viernes de 9 a 12.'],
  ]) await obtenerOCrear(m, Novedad, { consorcioId, titulo }, { autorId: adminId, cuerpo, publicadaAt: fecha(1), fijada: titulo === 'Bienvenidos a Domus' });
}

async function main() {
  const personas = leerPersonas();
  const aplicar = process.argv.includes('--aplicar');
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  try {
    await runner.connect();
    await runner.startTransaction();
    // Evita dos seeds concurrentes sobre las mismas claves naturales.
    await runner.query('SELECT pg_advisory_xact_lock(48202026)');
    const hash = await hashearPassword(PASSWORD);
    await sembrarConsorcio(runner.manager, hash);
    for (const persona of personas) await sembrarConsorcio(runner.manager, hash, persona);
    if (process.argv.includes('--verificar')) {
      const contar = () => runner.query(`
        SELECT json_build_object(
          'usuarios', (SELECT count(*) FROM usuario),
          'consorcios', (SELECT count(*) FROM consorcio),
          'unidades', (SELECT count(*) FROM unidad),
          'vinculos', (SELECT count(*) FROM unidad_usuario),
          'proveedores', (SELECT count(*) FROM proveedor),
          'rubros', (SELECT count(*) FROM rubro_gasto),
          'reclamos', (SELECT count(*) FROM reclamo),
          'eventos', (SELECT count(*) FROM reclamo_evento),
          'liquidaciones', (SELECT count(*) FROM liquidacion),
          'gastos', (SELECT count(*) FROM gasto),
          'boletas', (SELECT count(*) FROM boleta),
          'detalles', (SELECT count(*) FROM boleta_detalle),
          'pagos', (SELECT count(*) FROM pago),
          'amenities', (SELECT count(*) FROM amenity),
          'reservas', (SELECT count(*) FROM reserva),
          'asambleas', (SELECT count(*) FROM asamblea),
          'asistencias', (SELECT count(*) FROM asistencia),
          'puntos', (SELECT count(*) FROM punto_orden_dia),
          'votaciones', (SELECT count(*) FROM votacion),
          'opciones', (SELECT count(*) FROM opcion_voto),
          'votos', (SELECT count(*) FROM voto),
          'novedades', (SELECT count(*) FROM novedad)
        ) AS cantidades`);
      const antes = JSON.stringify(await contar());
      await sembrarConsorcio(runner.manager, hash);
      for (const persona of personas) await sembrarConsorcio(runner.manager, hash, persona);
      if (antes !== JSON.stringify(await contar())) throw new Error('El segundo seed duplicó filas');
      console.log('✔ Idempotencia verificada: la segunda carga no agregó filas');
    }
    if (aplicar) await runner.commitTransaction();
    else await runner.rollbackTransaction();
    console.log(aplicar ? '✔ Datos de demo guardados' : '✔ Simulación validada; todos los cambios fueron revertidos. Usar --aplicar después de avisar al grupo.');
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    await dataSource.destroy();
  }

  // ── Resumen ──
  console.log(`\n  admin:  admin@domus.test  / ${PASSWORD}`);
  console.log(`  vecino: vecino@domus.test / ${PASSWORD}   (unidad 3º B)`);

}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo cargar la demo');
  process.exitCode = 1;
});
