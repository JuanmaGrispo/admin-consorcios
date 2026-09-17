import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildConnectionOptions } from './database.options';
import * as entities from './entities';

/**
 * Las entidades salen del barrel generado (`entities/index.ts`), no de
 * `autoLoadEntities`: el esquema completo tiene que estar registrado siempre,
 * aunque todavía no exista un módulo de negocio para cada tabla. Si sólo se
 * cargaran las del `forFeature` de cada módulo, una relación hacia una tabla
 * sin módulo rompería el arranque.
 *
 * Como el barrel se regenera desde la base, sumar una tabla allá la registra
 * acá sin tocar este archivo.
 */
// El barrel exporta clases y enums mezclados; las entidades son las clases.
const ENTIDADES = Object.values(entities).filter(
  (exportado) => typeof exportado === 'function',
) as Function[];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Host/puerto/credenciales salen de database.options para que la app y la
        // CLI de migraciones no puedan quedar apuntando a bases distintas.
        ...buildConnectionOptions((key) => config.get<string>(key)),
        entities: ENTIDADES,
        // Siempre false: el esquema lo manda la base, no el código. Las entidades
        // se regeneran con `pnpm back db:generate-entities`.
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
