const { hash } = require('bcryptjs');

module.exports = async function fixtures(db, password) {
  const passwordHash = await hash(password, 12);
  const usuario = async (email, rol) => (await db.query(`INSERT INTO usuario(nombre,apellido,email,password_hash,rol)
    VALUES ('Prueba','Aceptación',$1,$2,$3) RETURNING id`, [email, passwordHash, rol])).rows[0].id;
  const superId = await usuario('super@example.test', 'SUPER_ADMIN');
  const adminId = await usuario('admin@example.test', 'ADMINISTRADOR');
  const ajenoId = await usuario('ajeno@example.test', 'VECINO');
  const consorcioId = (await db.query(`INSERT INTO consorcio(nombre,administrador_id) VALUES ('Aceptación',$1) RETURNING id`, [adminId])).rows[0].id;
  const categoriaId = (await db.query(`INSERT INTO categoria_reclamo(nombre,consorcio_id) VALUES ('Mantenimiento',$1) RETURNING id`, [consorcioId])).rows[0].id;
  const usuarios = [];
  for (let i = 0; i < 50; i++) usuarios.push({ id: await usuario(`carga${i}@example.test`, 'VECINO'), email: `carga${i}@example.test` });
  const unidades = (await db.query(`INSERT INTO unidad(consorcio_id,etiqueta,coeficiente)
    SELECT $1,'Unidad '||i,0.2 FROM generate_series(1,500) i RETURNING id`, [consorcioId])).rows;
  await db.query(`INSERT INTO unidad_usuario(unidad_id,usuario_id,vinculo,desde,es_titular)
    SELECT unidad,usuario,'PROPIETARIO',current_date-1,true FROM unnest($1::uuid[],$2::uuid[]) AS v(unidad,usuario)`,
    [unidades.map((u) => u.id), unidades.map((_, i) => usuarios[i % 50].id)]);
  const liquidaciones = (await db.query(`INSERT INTO liquidacion(consorcio_id,periodo,estado,fecha_vencimiento,creada_por)
    SELECT $1,(date_trunc('month',current_date) - i*interval '1 month')::date,'EMITIDA',current_date+10,$2
    FROM generate_series(0,5) i RETURNING id`, [consorcioId, adminId])).rows;
  for (const l of liquidaciones) await db.query(`INSERT INTO boleta(liquidacion_id,unidad_id,coeficiente_aplicado,importe_ordinarias,total)
    SELECT $1,id,coeficiente,100,100 FROM unidad WHERE consorcio_id=$2`, [l.id, consorcioId]);
  await db.query(`INSERT INTO boleta_detalle(boleta_id,concepto,monto)
    SELECT b.id,d.concepto,d.monto FROM boleta b CROSS JOIN
    (VALUES ('Mantenimiento',60),('Limpieza',30),('Electricidad',10)) AS d(concepto,monto)`);
  await db.query(`INSERT INTO reclamo(codigo,consorcio_id,unidad_id,creado_por,categoria_id,titulo,descripcion)
    SELECT 'BASE-'||row_number() OVER (),$1,id,$2,$3,'Reclamo de base','Descripción de prueba inicial'
    FROM unidad WHERE consorcio_id=$1`, [consorcioId, superId, categoriaId]);
  const boletas = (await db.query('SELECT id,unidad_id FROM boleta WHERE liquidacion_id=$1', [liquidaciones[0].id])).rows;
  for (let i = 0; i < usuarios.length; i++) {
    usuarios[i].unidadId = unidades[i].id;
    usuarios[i].boletaId = boletas.find((b) => b.unidad_id === unidades[i].id).id;
  }
  return { superId, adminId, ajenoId, consorcioId, categoriaId, unidadId: unidades[0].id, boletaId: usuarios[0].boletaId, usuarios };
};
