import { HttpException, HttpStatus } from '@nestjs/common';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { LimitadorLogin, MAX_FALLOS_CUENTA, MAX_FALLOS_IP } from './limitador-login';

const MINUTO = 60_000;

function bloqueado(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    assert.ok(e instanceof HttpException);
    assert.equal(e.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}

describe('LimitadorLogin', () => {
  let ahora: number;
  let limitador: LimitadorLogin;

  beforeEach(() => {
    ahora = 0;
    limitador = new LimitadorLogin(() => ahora);
  });

  const fallar = (veces: number, email = 'v@x', ip?: string) => {
    for (let i = 0; i < veces; i++) limitador.registrarFallo(email, ip);
  };

  it('con 4 fallos todavía deja intentar', () => {
    fallar(MAX_FALLOS_CUENTA - 1);
    assert.equal(bloqueado(() => limitador.exigirHabilitado('v@x')), false);
  });

  it('al 5.º fallo bloquea la cuenta 15 minutos', () => {
    fallar(MAX_FALLOS_CUENTA);
    assert.equal(bloqueado(() => limitador.exigirHabilitado('v@x')), true);
    ahora += 14 * MINUTO;
    assert.equal(bloqueado(() => limitador.exigirHabilitado('v@x')), true);
    ahora += MINUTO;
    assert.equal(bloqueado(() => limitador.exigirHabilitado('v@x')), false);
  });

  it('el mensaje dice cuánto falta', () => {
    fallar(MAX_FALLOS_CUENTA);
    ahora += 14 * MINUTO;
    assert.throws(() => limitador.exigirHabilitado('v@x'), /1 minuto\./);
  });

  it('los fallos de más de 15 minutos no cuentan', () => {
    fallar(MAX_FALLOS_CUENTA - 1);
    ahora += 15 * MINUTO;
    fallar(1);
    assert.equal(bloqueado(() => limitador.exigirHabilitado('v@x')), false);
  });

  it('el email se compara sin mayúsculas ni espacios', () => {
    fallar(MAX_FALLOS_CUENTA, ' V@X ');
    assert.equal(bloqueado(() => limitador.exigirHabilitado('v@x')), true);
  });

  it('bloquear una cuenta no afecta a otra', () => {
    fallar(MAX_FALLOS_CUENTA);
    assert.equal(bloqueado(() => limitador.exigirHabilitado('otro@x')), false);
  });

  it('un login correcto perdona los fallos de la cuenta', () => {
    fallar(MAX_FALLOS_CUENTA - 1);
    limitador.registrarExito('v@x');
    fallar(1);
    assert.equal(bloqueado(() => limitador.exigirHabilitado('v@x')), false);
  });

  it('muchas cuentas distintas desde una IP bloquean esa IP', () => {
    for (let i = 0; i < MAX_FALLOS_IP; i++) limitador.registrarFallo(`c${i}@x`, '1.2.3.4');
    assert.equal(bloqueado(() => limitador.exigirHabilitado('nueva@x', '1.2.3.4')), true);
    assert.equal(bloqueado(() => limitador.exigirHabilitado('nueva@x', '5.6.7.8')), false);
  });
});
