import { HttpStatus, UnauthorizedException, type HttpException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as bcrypt from 'bcryptjs';
import { RolUsuario } from '../../database/entities';
import type { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.types';
import { huellaPassword } from './huella-sesion';
import { LimitadorLogin, MAX_FALLOS_CUENTA } from './limitador-login';

describe('AuthService — límite de intentos', () => {
  it('después de 5 fallos responde 429 sin consultar la cuenta, exista o no', async () => {
    let consultas = 0;
    const repo = {
      findByEmail: async () => {
        consultas++;
        return null;
      },
    } as unknown as AuthRepository;
    const service = new AuthService(repo, {} as JwtService, new LimitadorLogin());
    const dto = { email: 'nadie@x', password: 'mala' };

    for (let i = 0; i < MAX_FALLOS_CUENTA; i++) {
      await assert.rejects(service.login(dto, '1.2.3.4'), UnauthorizedException);
    }
    await assert.rejects(
      service.login(dto, '1.2.3.4'),
      (e: HttpException) => e.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
    );
    assert.equal(consultas, MAX_FALLOS_CUENTA);
  });
});

describe('AuthService — sesiones después de cambiar la contraseña (AUT10)', () => {
  const crear = async () => {
    const usuario = {
      id: 'u1', email: 'vecino@x', nombre: 'Ana', apellido: 'Paz', rol: RolUsuario.VECINO, activo: true,
      passwordHash: await bcrypt.hash('clave-vieja', 4),
    };
    const repo = {
      findByEmail: async () => ({ ...usuario }),
      findParaSesion: async () => ({ ...usuario }),
      consorciosAdministrados: async () => [],
    } as unknown as AuthRepository;
    // El "token" es el payload en JSON: alcanza para ver qué se firma.
    const jwt = { signAsync: async (p: JwtPayload) => JSON.stringify(p) } as unknown as JwtService;
    const service = new AuthService(repo, jwt, new LimitadorLogin());
    const payloadDe = (token: string) => JSON.parse(token) as JwtPayload;
    return { usuario, service, payloadDe };
  };

  it('el token lleva la huella de la contraseña y no el hash', async () => {
    const { usuario, service, payloadDe } = await crear();
    const { accessToken } = await service.login({ email: 'vecino@x', password: 'clave-vieja' });
    const payload = payloadDe(accessToken);
    assert.equal(payload.pwd, huellaPassword(usuario.passwordHash));
    assert.ok(!accessToken.includes(usuario.passwordHash));
    assert.equal((await service.validarPayload(payload)).id, 'u1');
  });

  it('una sesión abierta antes del cambio responde 401', async () => {
    const { usuario, service, payloadDe } = await crear();
    const { accessToken } = await service.login({ email: 'vecino@x', password: 'clave-vieja' });
    usuario.passwordHash = await bcrypt.hash('clave-nueva', 4);
    await assert.rejects(service.validarPayload(payloadDe(accessToken)), UnauthorizedException);
  });

  it('un token sin huella (o con otra) responde 401', async () => {
    const { usuario, service } = await crear();
    const base = { sub: usuario.id, email: usuario.email, rol: usuario.rol };
    await assert.rejects(service.validarPayload(base as JwtPayload), UnauthorizedException);
    await assert.rejects(service.validarPayload({ ...base, pwd: 'A'.repeat(22) }), UnauthorizedException);
  });

  it('renovarSesion da un token que vale con la contraseña nueva', async () => {
    const { usuario, service, payloadDe } = await crear();
    usuario.passwordHash = await bcrypt.hash('clave-nueva', 4);
    const token = await service.renovarSesion('u1');
    assert.equal((await service.validarPayload(payloadDe(token))).id, 'u1');
  });
});
