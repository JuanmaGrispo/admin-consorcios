import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // getOrThrow: sin secreto la app no arranca. Un default acá sería un
        // secreto conocido en producción.
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // El cast es por el tipo de `expiresIn`, que jsonwebtoken declara como
        // un literal (`'1d' | '2h' | …`) y acá sale de una variable de entorno.
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d'),
        } as JwtSignOptions,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
