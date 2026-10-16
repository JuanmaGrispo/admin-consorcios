import { HttpStatus, UnauthorizedException, type HttpException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
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
