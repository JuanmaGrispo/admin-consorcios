import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'admin_consorcios'),
        // Las entidades se registran solas vía TypeOrmModule.forFeature en cada módulo;
        // autoLoadEntities evita mantener una lista central que siempre queda vieja.
        autoLoadEntities: true,
        // synchronize solo en desarrollo. En producción el esquema se mueve con
        // migraciones (ver data-source.ts y los scripts migration:* del package.json).
        synchronize: config.get<string>('DB_SYNC') === 'true',
      }),
    }),
  ],
})
export class DatabaseModule {}
