import * as fs from 'fs';
import * as path from 'path';
import dataSource from './data-source';

/**
 * Genera las entidades TypeORM leyendo el esquema real de la base.
 *
 * La base es la fuente de verdad: las entidades no se escriben a mano, se
 * regeneran con `pnpm back db:generate-entities`. Si el esquema cambia, se
 * corre de nuevo y el diff muestra exactamente qué se movió.
 *
 * `pnpm back db:verify` corre esto mismo en seco y falla si lo que hay en disco
 * no coincide con la base.
 */

const OUT_DIR = path.join(__dirname, 'entities');

// ── Tipos de lo que devuelve la introspección ────────────────────────────────

interface Col {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface Constraint {
  table_name: string;
  constraint_name: string;
  constraint_type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE';
  columnas: string;
  ref_tabla: string | null;
  on_delete: string | null;
}

interface EnumDef {
  nombre: string;
  valores: string;
}

// ── Nombres ──────────────────────────────────────────────────────────────────

const pascal = (s: string) =>
  s
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

const camel = (s: string) => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

/** Plural del español: vocal → +s, consonante → +es. */
const plural = (s: string) => (/[aeiou]$/i.test(s) ? `${s}s` : `${s}es`);

/** `administrador_id` → `administrador`, para nombrar la relación. */
const sinSufijoId = (col: string) => col.replace(/_id$/, '');

// ── Mapeo de tipos ───────────────────────────────────────────────────────────

/** udt_name de Postgres → tipo de TypeScript. */
function tipoTs(col: Col, enums: Set<string>): string {
  if (enums.has(col.udt_name)) return pascal(col.udt_name);
  switch (col.udt_name) {
    case 'uuid':
    case 'varchar':
    case 'text':
    case 'bpchar':
      return 'string';
    case 'bool':
      return 'boolean';
    case 'int2':
    case 'int4':
    case 'int8':
    case 'numeric':
    case 'float4':
    case 'float8':
      return 'number';
    case 'timestamptz':
    case 'timestamp':
      return 'Date';
    // `date` y `time` se dejan como string: pasarlos a Date inventaría una hora
    // y una zona horaria que la base no guarda.
    case 'date':
    case 'time':
    case 'timetz':
      return 'string';
    case 'jsonb':
    case 'json':
      return 'Record<string, unknown>';
    default:
      return 'string';
  }
}

/** udt_name → el `type` que espera el decorador @Column. */
function tipoColumna(col: Col): string {
  const map: Record<string, string> = {
    varchar: 'varchar',
    bpchar: 'char',
    text: 'text',
    bool: 'boolean',
    int2: 'smallint',
    int4: 'int',
    int8: 'bigint',
    numeric: 'numeric',
    float4: 'real',
    float8: 'double precision',
    timestamptz: 'timestamptz',
    timestamp: 'timestamp',
    date: 'date',
    time: 'time',
    timetz: 'time with time zone',
    jsonb: 'jsonb',
    json: 'json',
    uuid: 'uuid',
  };
  return map[col.udt_name] ?? col.udt_name;
}

/**
 * El default de la base, escrito como lo espera un decorador de TypeORM. Se
 * copia para que la entidad documente el esquema; como `synchronize` está
 * apagado, TypeORM nunca lo aplica contra la base.
 */
function defaultDeColumna(col: Col): string | null {
  const d = col.column_default;
  if (d === null || d.startsWith('nextval(')) return null;

  // 'BORRADOR'::estado_asamblea  →  'BORRADOR'
  const literal = d.match(/^'(.*)'::[\w ."]+$/);
  if (literal) return `'${literal[1].replace(/'/g, "\\'")}'`;

  if (/^-?\d+(\.\d+)?$/.test(d)) return d;
  if (d === 'true' || d === 'false') return d;

  // now(), gen_random_uuid(), CURRENT_DATE… van como función.
  return `() => '${d.replace(/'/g, "\\'")}'`;
}

// ── Generación ───────────────────────────────────────────────────────────────

function generarEnums(enums: EnumDef[]): string {
  const bloques = enums.map((e) => {
    const valores = e.valores
      .split(', ')
      .map((v) => `  ${v} = '${v}',`)
      .join('\n');
    return `export enum ${pascal(e.nombre)} {\n${valores}\n}`;
  });

  return [
    '// GENERADO por `pnpm back db:generate-entities` — no editar a mano.',
    '// Los valores salen de los tipos enum de Postgres.',
    '',
    bloques.join('\n\n'),
    '',
  ].join('\n');
}

function generarEntidad(
  tabla: string,
  cols: Col[],
  constraints: Constraint[],
  enums: Set<string>,
): string {
  const deLaTabla = constraints.filter((c) => c.table_name === tabla);
  const pk = deLaTabla.find((c) => c.constraint_type === 'PRIMARY KEY');
  const fks = deLaTabla.filter((c) => c.constraint_type === 'FOREIGN KEY');
  const uniques = deLaTabla.filter((c) => c.constraint_type === 'UNIQUE');
  const fksEntrantes = constraints.filter(
    (c) => c.constraint_type === 'FOREIGN KEY' && c.ref_tabla === tabla,
  );

  const fkPorColumna = new Map(fks.map((f) => [f.columnas, f]));
  const typeorm = new Set<string>(['Column', 'Entity']);
  const importsEnums = new Set<string>();
  const importsEntidades = new Map<string, string>();
  let usaTransformer = false;
  const cuerpo: string[] = [];
  /** Nombres de propiedad ya usados, para no pisarlos con el lado inverso. */
  const usados = new Set<string>();

  for (const col of cols) {
    const fk = fkPorColumna.get(col.column_name);
    // En una FK la relación se queda con el nombre natural (`creadoPor`,
    // `administrador`) y la columna cruda lleva el sufijo `Id`. Sin esto,
    // `creado_por` — que no termina en `_id` — chocaría con su propia relación.
    const relProp = fk ? camel(sinSufijoId(col.column_name)) : '';
    const prop = fk ? `${relProp}Id` : camel(col.column_name);
    const ts = tipoTs(col, enums);
    const nullable = col.is_nullable === 'YES';
    usados.add(prop);
    if (relProp) usados.add(relProp);

    if (enums.has(col.udt_name)) importsEnums.add(pascal(col.udt_name));

    // ── Clave primaria ──
    if (pk?.columnas === col.column_name) {
      if (col.column_default?.includes('gen_random_uuid')) {
        typeorm.add('PrimaryGeneratedColumn');
        cuerpo.push(`  @PrimaryGeneratedColumn('uuid')\n  ${prop}: ${ts};`);
      } else {
        typeorm.add('PrimaryColumn');
        cuerpo.push(
          `  @PrimaryColumn({ type: '${tipoColumna(col)}', name: '${col.column_name}' })\n  ${prop}: ${ts};`,
        );
      }
      continue;
    }

    // ── Columna común ──
    // created_at/updated_at van como columnas normales y no con
    // @CreateDateColumn: sólo 18 de las 30 tablas tienen updated_at, así que se
    // refleja lo que cada tabla tiene en vez de imponer un patrón.
    const opciones: string[] = [];
    if (enums.has(col.udt_name)) {
      opciones.push(`type: 'enum'`);
      opciones.push(`enum: ${pascal(col.udt_name)}`);
      opciones.push(`enumName: '${col.udt_name}'`);
    } else {
      opciones.push(`type: '${tipoColumna(col)}'`);
    }
    opciones.push(`name: '${col.column_name}'`);
    if (col.udt_name === 'varchar' && col.character_maximum_length) {
      opciones.push(`length: ${col.character_maximum_length}`);
    }
    if (col.udt_name === 'numeric' && col.numeric_precision) {
      opciones.push(`precision: ${col.numeric_precision}`);
      opciones.push(`scale: ${col.numeric_scale ?? 0}`);
      opciones.push('transformer: numericTransformer');
      usaTransformer = true;
    }
    if (nullable) opciones.push('nullable: true');
    const def = defaultDeColumna(col);
    if (def) opciones.push(`default: ${def}`);

    cuerpo.push(
      `  @Column({ ${opciones.join(', ')} })\n  ${prop}: ${ts}${nullable ? ' | null' : ''};`,
    );

    // ── Si la columna es FK, la relación va sobre esa misma columna ──
    if (fk?.ref_tabla) {
      typeorm.add('ManyToOne');
      typeorm.add('JoinColumn');
      const destino = pascal(fk.ref_tabla);
      importsEntidades.set(destino, fk.ref_tabla);

      const relOpts: string[] = [];
      if (nullable) relOpts.push('nullable: true');
      if (fk.on_delete && fk.on_delete !== 'NO ACTION') {
        relOpts.push(`onDelete: '${fk.on_delete}'`);
      }
      const args = relOpts.length ? `, undefined, { ${relOpts.join(', ')} }` : '';

      cuerpo.push(
        `  @ManyToOne(() => ${destino}${args})\n` +
          `  @JoinColumn({ name: '${col.column_name}' })\n` +
          `  ${relProp}${nullable ? '?' : ''}: ${destino}${nullable ? ' | null' : ''};`,
      );
    }
  }

  // ── Lado inverso: una colección por cada FK que apunta a esta tabla ──
  for (const fk of fksEntrantes) {
    typeorm.add('OneToMany');
    const origen = pascal(fk.table_name);
    importsEntidades.set(origen, fk.table_name);

    let nombre = camel(plural(fk.table_name));
    // Dos FKs de la misma tabla a esta: se desambigua con el nombre de columna.
    if (usados.has(nombre)) {
      nombre = camel(`${plural(fk.table_name)}_por_${sinSufijoId(fk.columnas)}`);
    }
    usados.add(nombre);

    cuerpo.push(
      `  @OneToMany(() => ${origen}, (row) => row.${camel(sinSufijoId(fk.columnas))})\n` +
        `  ${nombre}?: ${origen}[];`,
    );
  }

  // ── Índices únicos ──
  const indices = uniques.map(
    (u) =>
      `@Index('${u.constraint_name}', [${u.columnas
        .split(',')
        .map((c) => `'${camel(c)}'`)
        .join(', ')}], { unique: true })`,
  );
  if (indices.length) typeorm.add('Index');

  // ── Armado del archivo ──
  const lineas: string[] = [
    '// GENERADO por `pnpm back db:generate-entities` — no editar a mano.',
    `// Refleja la tabla \`${tabla}\` de la base.`,
    '',
    `import { ${[...typeorm].sort().join(', ')} } from 'typeorm';`,
  ];
  if (importsEnums.size) {
    lineas.push(`import { ${[...importsEnums].sort().join(', ')} } from './enums';`);
  }
  if (usaTransformer) {
    lineas.push(`import { numericTransformer } from '../transformers';`);
  }
  for (const [clase, archivo] of [...importsEntidades].sort()) {
    if (archivo === tabla) continue;
    lineas.push(`import { ${clase} } from './${archivo}.entity';`);
  }

  lineas.push('');
  if (indices.length) lineas.push(...indices);
  lineas.push(`@Entity('${tabla}')`);
  lineas.push(`export class ${pascal(tabla)} {`);
  lineas.push(cuerpo.join('\n\n'));
  lineas.push('}');
  lineas.push('');

  return lineas.join('\n');
}

// ── Introspección ────────────────────────────────────────────────────────────

const SQL_ENUMS = `
  SELECT t.typname AS nombre,
         string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public'
   GROUP BY t.typname
   ORDER BY t.typname`;

const SQL_COLS = `
  SELECT c.table_name, c.column_name, c.udt_name, c.is_nullable, c.column_default,
         c.character_maximum_length, c.numeric_precision, c.numeric_scale
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
   WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     -- Infraestructura de TypeORM, no dominio: no le generamos entity.
     AND c.table_name <> 'migrations'
   ORDER BY c.table_name, c.ordinal_position`;

const SQL_CONSTRAINTS = `
  SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
         string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columnas,
         max(ccu.table_name::text) AS ref_tabla,
         max(rc.delete_rule::text) AS on_delete
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND tc.constraint_type = 'FOREIGN KEY'
    LEFT JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
   WHERE tc.table_schema = 'public'
     AND tc.constraint_type IN ('PRIMARY KEY','FOREIGN KEY','UNIQUE')
   GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
   ORDER BY tc.table_name, tc.constraint_name`;

async function main() {
  const soloChequear = process.argv.includes('--check');

  await dataSource.initialize();
  const enumDefs: EnumDef[] = await dataSource.query(SQL_ENUMS);
  const cols: Col[] = await dataSource.query(SQL_COLS);
  const constraints: Constraint[] = await dataSource.query(SQL_CONSTRAINTS);
  await dataSource.destroy();

  const nombresEnum = new Set(enumDefs.map((e) => e.nombre));
  const porTabla = new Map<string, Col[]>();
  for (const c of cols) {
    if (!porTabla.has(c.table_name)) porTabla.set(c.table_name, []);
    porTabla.get(c.table_name)!.push(c);
  }

  const archivos = new Map<string, string>();
  archivos.set('enums.ts', generarEnums(enumDefs));
  for (const [tabla, columnas] of [...porTabla].sort()) {
    archivos.set(
      `${tabla}.entity.ts`,
      generarEntidad(tabla, columnas, constraints, nombresEnum),
    );
  }

  // Barrel: un único punto de import para los módulos.
  archivos.set(
    'index.ts',
    [
      '// GENERADO por `pnpm back db:generate-entities` — no editar a mano.',
      '',
      `export * from './enums';`,
      ...[...porTabla.keys()].sort().map((t) => `export * from './${t}.entity';`),
      '',
    ].join('\n'),
  );

  if (soloChequear) {
    const desactualizados: string[] = [];
    for (const [nombre, contenido] of archivos) {
      const ruta = path.join(OUT_DIR, nombre);
      const actual = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : null;
      if (actual !== contenido) desactualizados.push(nombre);
    }
    const sobran = fs.existsSync(OUT_DIR)
      ? fs.readdirSync(OUT_DIR).filter((f) => !archivos.has(f))
      : [];

    if (desactualizados.length || sobran.length) {
      console.error('✖ Las entidades no coinciden con la base.');
      for (const d of desactualizados) console.error(`  desactualizado: ${d}`);
      for (const s of sobran) console.error(`  ya no existe en la base: ${s}`);
      console.error('  Correr: pnpm back db:generate-entities');
      process.exit(1);
    }
    console.log(`✔ Las ${porTabla.size} entidades coinciden con la base.`);
    return;
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [nombre, contenido] of archivos) {
    fs.writeFileSync(path.join(OUT_DIR, nombre), contenido);
  }
  console.log(
    `✔ ${porTabla.size} entidades y ${enumDefs.length} enums generados en src/database/entities/`,
  );
}

void main();
