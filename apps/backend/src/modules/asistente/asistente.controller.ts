import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RolUsuario } from '../../database/entities';
import type { UsuarioActual as Usuario } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { AsistenteService } from './asistente.service';
import { FeedbackDto } from './dto/feedback.dto';
import { HabilitadoDto } from './dto/habilitado.dto';
import { MetricasQuery } from './dto/metricas.query';
import { PreguntaDto } from './dto/pregunta.dto';

/**
 * El asistente de ayuda. Responde preguntas sobre cómo usar Domus con el
 * manual de usuario; nunca ejecuta nada por el usuario.
 */
@ApiTags('asistente')
@ApiBearerAuth()
@Controller('asistente')
export class AsistenteController {
  private readonly logger = new Logger(AsistenteController.name);

  constructor(private readonly asistente: AsistenteService) {}

  @Get('estado')
  @ApiOperation({ summary: 'Si el asistente está prendido: el front decide si muestra el botón de ayuda' })
  estado() {
    return this.asistente.estado();
  }

  @Post('preguntas')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.VECINO, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Hace una pregunta al asistente',
    description:
      'Responde con el manual de usuario y, si hace falta, con datos de lectura del propio usuario. ' +
      '`origen` dice quién respondió: `llm` (el modelo de OpenAI), `manual` (búsqueda en el manual, sin IA) o `rechazo`.',
  })
  @ApiResponse({ status: 429, description: 'Más de 10 preguntas por minuto o 100 por día' })
  @ApiResponse({ status: 503, description: 'El asistente está apagado' })
  preguntar(@UsuarioActual() usuario: Usuario, @Body() dto: PreguntaDto) {
    return this.asistente.preguntar(usuario, dto);
  }

  @Post('preguntas/stream')
  @Roles(RolUsuario.VECINO, RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'La misma pregunta, con la respuesta a medida que se escribe',
    description:
      'Server-Sent Events. `texto`: un pedazo nuevo de la respuesta, para mostrar mientras llega. ' +
      '`fin`: la respuesta completa y validada, igual a la de `POST /asistente/preguntas`; es la que vale. ' +
      '`error`: `{ status, message }` si algo falla después de empezar. Los errores de antes de empezar ' +
      '(400, 403, 429, 503) vuelven como un error HTTP común.',
  })
  @ApiProduces('text/event-stream')
  async preguntarEnVivo(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: PreguntaDto,
    @Res() res: Response,
  ): Promise<void> {
    const enviar = (evento: string, datos: unknown) => {
      if (!res.headersSent) {
        res.status(HttpStatus.OK);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        // Que un proxy (nginx) no junte los pedazos: la gracia es que lleguen de a uno.
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
      }
      res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
    };
    try {
      const respuesta = await this.asistente.preguntar(usuario, dto, (texto) => enviar('texto', { texto }));
      enviar('fin', respuesta);
    } catch (error) {
      // Antes del primer pedazo, el error sale como siempre (filtro global, código HTTP).
      if (!res.headersSent) throw error;
      const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      if (status >= 500) this.logger.error('Falló el stream del asistente', error instanceof Error ? error.stack : String(error));
      enviar('error', { status, message: status < 500 && error instanceof Error ? error.message : 'No se pudo responder.' });
    }
    res.end();
  }

  @Post('feedback')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RolUsuario.VECINO, RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Pulgar arriba o abajo sobre una respuesta propia' })
  @ApiResponse({ status: 404, description: 'La respuesta no existe o no es suya' })
  feedback(@UsuarioActual() usuario: Usuario, @Body() dto: FeedbackDto) {
    return this.asistente.feedback(usuario, dto);
  }

  @Put('habilitado')
  @Roles(RolUsuario.SUPER_ADMIN)
  @ApiOperation({ summary: 'Prende o apaga el asistente para toda la plataforma' })
  cambiarHabilitado(@UsuarioActual() usuario: Usuario, @Body() dto: HabilitadoDto) {
    return this.asistente.cambiarHabilitado(usuario, dto.habilitado);
  }

  @Get('metricas')
  @Roles(RolUsuario.SUPER_ADMIN)
  @ApiOperation({ summary: 'Uso, costo, latencia y feedback de los últimos días' })
  metricas(@Query() query: MetricasQuery) {
    return this.asistente.metricas(query.dias ?? 7);
  }
}
