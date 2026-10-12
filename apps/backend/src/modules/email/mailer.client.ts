import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/**
 * Una sola conexión SMTP reutilizada. Con una conexión (y un login) por mail,
 * Gmail corta con `454 Too many login attempts` a mitad de un envío a todo el
 * consorcio.
 */
export function opcionesSmtp(valor: (nombre: string) => string | undefined): SMTPPool.Options {
  const puerto = Number(valor('SMTP_PORT') || 587);
  return {
    pool: true,
    maxConnections: 1,
    host: valor('SMTP_HOST'),
    port: puerto,
    secure: puerto === 465,
    auth: { user: valor('SMTP_USER'), pass: valor('SMTP_PASS') },
    connectionTimeout: 10_000,
  };
}

/** SMTP con NodeMailer. En desarrollo apunta a una cuenta de prueba: ver README → Mensajería. */
@Injectable()
export class MailerClient implements OnModuleDestroy {
  private transporte: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  get configurado(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  async enviar(correo: Correo): Promise<void> {
    await this.transportador().sendMail({
      from: this.config.get<string>('MAIL_FROM') || 'Domus <no-responder@domus.app>',
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    });
  }

  onModuleDestroy(): void {
    this.transporte?.close();
  }

  private transportador(): Transporter {
    this.transporte ??= createTransport(opcionesSmtp((nombre) => this.config.get<string>(nombre)));
    return this.transporte;
  }
}
