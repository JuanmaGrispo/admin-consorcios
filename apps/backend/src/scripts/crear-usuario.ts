import * as bcrypt from 'bcryptjs';
import dataSource from '../database/data-source';
import { RolUsuario, Usuario } from '../database/entities';

/**
 * Crea un usuario con la contraseña hasheada:
 *
 *   pnpm back usuario:crear <email> <password> [ADMINISTRADOR|VECINO] [nombre] [apellido]
 *
 * No hay endpoint de registro: el primer administrador tiene que entrar por
 * algún lado, y dejar esa puerta abierta en la API sería un agujero. Los altas
 * siguientes son una decisión del negocio, no de cualquiera con acceso a /auth.
 */

const BCRYPT_ROUNDS = 10;

function salir(mensaje: string): never {
  console.error(`✖ ${mensaje}`);
  console.error(
    '  Uso: pnpm back usuario:crear <email> <password> [ADMINISTRADOR|VECINO] [nombre] [apellido]',
  );
  process.exit(1);
}

async function main() {
  const [email, password, rolArg, nombre, apellido] = process.argv.slice(2);

  if (!email || !password) salir('Faltan email y/o password.');
  if (!email.includes('@')) salir(`"${email}" no parece un email.`);
  if (password.length < 8) salir('La password tiene que tener al menos 8 caracteres.');

  const rol = (rolArg ?? RolUsuario.ADMINISTRADOR) as RolUsuario;
  if (!Object.values(RolUsuario).includes(rol)) {
    salir(`Rol inválido: "${rolArg}". Valores: ${Object.values(RolUsuario).join(', ')}`);
  }

  await dataSource.initialize();
  const repo = dataSource.getRepository(Usuario);

  // El email se guarda en minúsculas, igual que como lo busca el login.
  const normalizado = email.trim().toLowerCase();

  const existente = await repo.findOne({ where: { email: normalizado } });
  if (existente) {
    console.error(`✖ Ya existe un usuario con el email ${normalizado}.`);
    await dataSource.destroy();
    process.exit(1);
  }

  const usuario = await repo.save(
    repo.create({
      email: normalizado,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      nombre: nombre ?? 'Admin',
      apellido: apellido ?? 'Consorcios',
      rol,
    }),
  );

  console.log('✔ Usuario creado');
  console.log(`  id:    ${usuario.id}`);
  console.log(`  email: ${usuario.email}`);
  console.log(`  rol:   ${usuario.rol}`);

  await dataSource.destroy();
}

void main();
