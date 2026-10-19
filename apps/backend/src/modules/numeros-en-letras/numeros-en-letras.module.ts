import { Module } from '@nestjs/common';
import { NumberConversionClient } from './number-conversion.client';
import { NumerosEnLetrasService } from './numeros-en-letras.service';

/**
 * Integración SOAP con NumberConversion: el importe en letras de boletas y
 * recibos. No tiene controller: lo usan expensas y pagos al armar sus PDF.
 */
@Module({
  providers: [NumberConversionClient, NumerosEnLetrasService],
  exports: [NumerosEnLetrasService],
})
export class NumerosEnLetrasModule {}
