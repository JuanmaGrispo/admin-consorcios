import * as bcrypt from 'bcryptjs';

/** Costo del hash. 10 rondas es el default de bcrypt y va bien acá. */
export const BCRYPT_ROUNDS = 10;

export const hashearPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
