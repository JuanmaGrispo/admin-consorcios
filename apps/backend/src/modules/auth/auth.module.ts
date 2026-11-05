import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consorcio, Usuario } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { opcionesJwt } from './jwt.opciones';
import { JwtStrategy } from './jwt.strategy';
import { LimitadorLogin } from './limitador-login';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Consorcio]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => opcionesJwt(config),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    { provide: LimitadorLogin, useValue: new LimitadorLogin() },
  ],
  exports: [AuthService],
})
export class AuthModule {}
