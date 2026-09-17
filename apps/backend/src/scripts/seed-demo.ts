import * as bcrypt from 'bcryptjs';
import { EntityManager } from 'typeorm';
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
} from '../database/entities';

/**
 * Datos mínimos para poder probar los flujos: un consorcio con unidades, un
 * administrador, vecinos vinculados y proveedores.
 *
 *   pnpm back db:seed-demo
 *
 * Es idempotente: busca por la clave natural de cada fila (el email del
 * usuario, el nombre del consorcio) y sólo inserta lo que falta, así que
 * correrlo dos veces no duplica nada. Escribe en la base compartida.
 *
 * La password de todos es `Domus.2026`.
 */

const PASSWORD = 'Domus.2026';
const CONSORCIO = 'Av. Rivadavia 4820';

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
async function sembrarReclamos(m: EntityManager, consorcioId: string) {
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
    if (await repo.findOne({ where: { codigo: caso.codigo } })) continue;

    const reclamo = await repo.save(
      repo.create({
        codigo: caso.codigo,
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

async function main() {
  await dataSource.initialize();
  const hash = await bcrypt.hash(PASSWORD, 10);

  await dataSource.transaction(async (m) => {
    // ── Administrador ──
    const admin = await obtenerOCrear(
      m,
      Usuario,
      { email: 'admin@domus.test' },
      {
        nombre: 'Mónica',
        apellido: 'Ferreyra',
        passwordHash: hash,
        rol: RolUsuario.ADMINISTRADOR,
        telefono: '11-5555-0001',
      },
    );

    // ── Consorcio ──
    const consorcio = await obtenerOCrear(
      m,
      Consorcio,
      { nombre: CONSORCIO },
      {
        administradorId: admin.id,
        calle: 'Av. Rivadavia',
        numero: '4820',
        barrio: 'Almagro',
        ciudad: 'CABA',
        provincia: 'Buenos Aires',
        cp: 'C1424',
        cuit: '30-71234567-8',
        diaVencimiento: 10,
        tasaInteresMora: 2.5,
        porcentajeFondoReserva: 5,
      },
    );

    // ── Unidades y vecinos ──
    const vecinos: { unidad: string; coef: number; nombre: string; apellido: string; email: string }[] = [
      { unidad: '3º B', coef: 4.5, nombre: 'Osvaldo', apellido: 'Pereyra', email: 'vecino@domus.test' },
      { unidad: '6º B', coef: 5.1, nombre: 'Silvina', apellido: 'Ferrari', email: 'vecina2@domus.test' },
      { unidad: '2º A', coef: 4.2, nombre: 'Rubén', apellido: 'Sosa', email: 'vecino3@domus.test' },
    ];

    for (const v of vecinos) {
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

    await sembrarReclamos(m, consorcio.id);
  });

  // ── Resumen ──
  console.log('✔ Datos de demo listos\n');
  for (const t of ['usuario', 'consorcio', 'unidad', 'unidad_usuario', 'proveedor', 'reclamo']) {
    const r = await dataSource.query(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`  ${t.padEnd(16)} ${r[0].n}`);
  }
  console.log(`\n  admin:  admin@domus.test  / ${PASSWORD}`);
  console.log(`  vecino: vecino@domus.test / ${PASSWORD}   (unidad 3º B)`);

  await dataSource.destroy();
}

void main();
