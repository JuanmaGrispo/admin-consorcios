import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvioNotificacion } from '../../database/entities';
import { EmailNotificador } from './email.consumer';
import { EmailRepository } from './email.repository';
import { EmailService } from './email.service';
import { MailerClient } from './mailer.client';

/** Sin controller: entra por la cola `q.email-notificador`, no por HTTP. */
@Module({
  imports: [TypeOrmModule.forFeature([EnvioNotificacion])],
  providers: [EmailNotificador, EmailService, EmailRepository, MailerClient],
})
export class EmailModule {}
