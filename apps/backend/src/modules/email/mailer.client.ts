import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/** SMTP con NodeMailer. En desarrollo apunta a Mailtrap: los mails no le llegan a nadie de verdad. */
@Injectable()
export class MailerClient {
  private transporte: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  get configurado(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  async enviar(correo: Correo): Promise<void> {
    await this.transportador().sendMail({
      from: this.config.get<string>('MAIL_FROM', 'Domus <no-responder@domus.app>'),
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    });
  }

  private transportador(): Transporter {
    if (!this.transporte) {
      const puerto = Number(this.config.get<string>('SMTP_PORT', '587'));
      this.transporte = createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: puerto,
        secure: puerto === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
        connectionTimeout: 10_000,
      });
    }
    return this.transporte;
  }
}
