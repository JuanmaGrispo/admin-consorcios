import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suma el rol SUPER_ADMIN (dueño del SaaS) al enum de la base. La jerarquía
 * —que el superadmin pasa cualquier chequeo de rol— vive en RolesGuard, no acá.
 *
 * Sin down(): Postgres no soporta quitar un valor de un enum, y una vez que
 * hay usuarios con ese rol tampoco tendría sentido.
 */
export class AgregarRolSuperAdmin1758150000000 implements MigrationInterface {
  name = 'AgregarRolSuperAdmin1758150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'",
    );
  }

  public async down(): Promise<void> {
    // Ver el comentario de la clase: no hay vuelta atrás para un valor de enum.
  }
}
