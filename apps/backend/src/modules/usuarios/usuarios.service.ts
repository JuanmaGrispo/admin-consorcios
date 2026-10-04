import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolUsuario, Usuario } from '../../database/entities';
import { ArchivosService } from '../archivos/archivos.service';
import { DestinoArchivo } from '../archivos/tipos-archivo';
import { consorciosGestionados, gestiona } from '../auth/alcance';
import type { UsuarioActual } from '../auth/auth.types';
import { coincidePassword, hashearPassword } from '../auth/password';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { NuevoVecinoDto } from './dto/nuevo-vecino.dto';
import { ListarUsuariosQuery } from './dto/listar-usuarios.query';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosRepository } from './usuarios.repository';

/** Un usuario como sale por la API: todo menos el hash. */
export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

/** Lo que ve un administrador de un vecino que todavía no vive en sus consorcios. */
export type UsuarioResumido = Pick<Usuario, 'id' | 'nombre' | 'apellido' | 'email' | 'rol'>;

const esSuperAdmin = (usuario: UsuarioActual) => usuario.rol === RolUsuario.SUPER_ADMIN;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly archivos: ArchivosService,
  ) {}

  /**
   * El superadmin ve todas las cuentas; el administrador, los vecinos que hoy
   * viven en sus consorcios.
   */
  async listar(
    usuario: UsuarioActual,
    query: ListarUsuariosQuery,
  ): Promise<(UsuarioPublico | UsuarioResumido)[]> {
    if (query.email) return this.buscarPorEmail(usuario, query.email);

    if (esSuperAdmin(usuario) && !query.consorcioId) {
      const filas = await this.usuarios.findAll(query.rol, query.buscar);
      return filas.map((u) => this.sinHash(u));
    }

    const consorcioIds = query.consorcioId
      ? gestiona(usuario, query.consorcioId) ? [query.consorcioId] : []
      : (consorciosGestionados(usuario) ?? []);
    const filas = await this.usuarios.listarVecinos(consorcioIds, query.buscar);
    return filas.map((u) => this.sinHash(u));
  }

  async findVisible(usuario: UsuarioActual, id: string): Promise<UsuarioPublico> {
    return this.sinHash(await this.exigirGestionable(usuario, id));
  }

  /** Para uso interno de otros services (p. ej. validar un administradorId). */
  findOne(id: string): Promise<Usuario | null> {
    return this.usuarios.findById(id);
  }

  async create(dto: CreateUsuarioDto): Promise<UsuarioPublico> {
    const creado = await this.usuarios.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: await this.exigirEmailLibre(dto.email),
      passwordHash: await hashearPassword(dto.password),
      rol: dto.rol ?? RolUsuario.ADMINISTRADOR,
    });
    return this.sinHash(creado);
  }

  /** Los datos de un vecino listo para guardar: lo inserta unidades junto con su vínculo. */
  async prepararVecino(dto: NuevoVecinoDto): Promise<Partial<Usuario>> {
    return {
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: await this.exigirEmailLibre(dto.email),
      passwordHash: await hashearPassword(dto.password),
      rol: RolUsuario.VECINO,
      dni: dto.dni ?? null,
      telefono: dto.telefono ?? null,
    };
  }

  async update(usuario: UsuarioActual, id: string, dto: UpdateUsuarioDto): Promise<UsuarioPublico> {
    const objetivo = await this.exigirGestionable(usuario, id);

    // Un vecino puede vivir en dos consorcios con administradores distintos:
    // darlo de baja lo dejaría afuera de los dos. El administrador termina el vínculo.
    if (dto.activo !== undefined && !esSuperAdmin(usuario)) {
      throw new ForbiddenException(
        'Dar de baja una cuenta es del superadmin: terminá el vínculo con la unidad',
      );
    }
    if (dto.activo === false && objetivo.id === usuario.id) {
      throw new BadRequestException('No podés dar de baja tu propia cuenta');
    }

    const cambios: Partial<Usuario> = { ...dto };
    if (dto.email && dto.email.trim().toLowerCase() !== objetivo.email) {
      cambios.email = await this.exigirEmailLibre(dto.email);
    } else {
      delete cambios.email;
    }

    return this.sinHash(await this.usuarios.update(objetivo, cambios));
  }

  /** Sin mailer todavía, es la salida para quien olvidó su contraseña. */
  async resetearPassword(usuario: UsuarioActual, id: string, password: string): Promise<void> {
    const objetivo = await this.exigirGestionable(usuario, id);
    await this.usuarios.update(objetivo, { passwordHash: await hashearPassword(password) });
  }

  // ── Perfil propio ──────────────────────────────────────────────────────────

  async perfil(usuarioId: string): Promise<UsuarioPublico> {
    return this.sinHash(await this.exigirPropio(usuarioId));
  }

  async actualizarPerfil(usuarioId: string, dto: ActualizarPerfilDto): Promise<UsuarioPublico> {
    const propio = await this.exigirPropio(usuarioId);
    if (dto.avatarUrl) this.archivos.exigirPropia(dto.avatarUrl, DestinoArchivo.AVATARES);
    return this.sinHash(await this.usuarios.update(propio, dto));
  }

  async cambiarPassword(usuarioId: string, dto: CambiarPasswordDto): Promise<void> {
    const propio = await this.exigirPropio(usuarioId);
    // 400 y no 401: un 401 haría que el front lo trate como sesión vencida.
    if (!(await coincidePassword(dto.actual, propio.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    await this.usuarios.update(propio, { passwordHash: await hashearPassword(dto.nueva) });
  }

  private async exigirPropio(usuarioId: string): Promise<Usuario> {
    const propio = await this.usuarios.findById(usuarioId);
    if (!propio) throw new NotFoundException('Tu cuenta no existe');
    return propio;
  }

  private async buscarPorEmail(
    usuario: UsuarioActual,
    email: string,
  ): Promise<(UsuarioPublico | UsuarioResumido)[]> {
    const encontrado = await this.usuarios.findByEmail(email);
    if (!encontrado) return [];
    if (esSuperAdmin(usuario)) return [this.sinHash(encontrado)];
    // Al administrador sólo le sirve para vincular a un vecino que ya existe.
    if (encontrado.rol !== RolUsuario.VECINO || !encontrado.activo) return [];
    const { id, nombre, apellido, rol } = encontrado;
    return [{ id, nombre, apellido, email: encontrado.email, rol }];
  }

  /**
   * El superadmin gestiona cualquier cuenta salvo otra de superadmin, que se
   * administra por consola. El administrador, sólo vecinos que viven en sus
   * consorcios; el resto responde como inexistente.
   */
  private async exigirGestionable(usuario: UsuarioActual, id: string): Promise<Usuario> {
    const objetivo = await this.usuarios.findById(id);
    if (!objetivo) throw new NotFoundException(`El usuario ${id} no existe`);

    if (esSuperAdmin(usuario)) {
      if (objetivo.rol === RolUsuario.SUPER_ADMIN && objetivo.id !== usuario.id) {
        throw new ForbiddenException('Las cuentas de superadmin se gestionan por consola');
      }
      return objetivo;
    }

    const visible =
      objetivo.rol === RolUsuario.VECINO &&
      (await this.usuarios.viveEn(objetivo.id, consorciosGestionados(usuario) ?? []));
    if (!visible) throw new NotFoundException(`El usuario ${id} no existe`);
    return objetivo;
  }

  private async exigirEmailLibre(email: string): Promise<string> {
    const normalizado = email.trim().toLowerCase();
    if (await this.usuarios.findByEmail(normalizado)) {
      throw new ConflictException(`Ya existe un usuario con el email ${normalizado}`);
    }
    return normalizado;
  }

  private sinHash(usuario: Usuario): UsuarioPublico {
    const { passwordHash: _hash, ...publico } = usuario;
    return publico;
  }
}
