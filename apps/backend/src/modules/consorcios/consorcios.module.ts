import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsorciosController } from './consorcios.controller';
import { ConsorciosRepository } from './consorcios.repository';
import { ConsorciosService } from './consorcios.service';
import { Consorcio } from './consorcios.entities';

@Module({
  imports: [TypeOrmModule.forFeature([Consorcio])],
  controllers: [ConsorciosController],
  providers: [ConsorciosService, ConsorciosRepository],
  exports: [ConsorciosService],
})
export class ConsorciosModule {}
