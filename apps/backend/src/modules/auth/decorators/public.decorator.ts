import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Marca una ruta como abierta. El guard de JWT es global, así que sin esto
 * todo pide token: un endpoint nuevo nace protegido y hay que decidir
 * explícitamente abrirlo, en vez de al revés.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
