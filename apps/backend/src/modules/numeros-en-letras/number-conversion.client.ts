import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** El servicio público de DataAccess. Se puede cambiar por .env si alguna vez se muda. */
const URL_POR_DEFECTO = 'https://www.dataaccess.com/webservicesserver/NumberConversion.wso';
const NAMESPACE = 'http://www.dataaccess.com/webservicesserver/';

/**
 * Es cosmético: un PDF no puede quedar esperando a un servicio externo. Si no
 * contesta en este tiempo, las letras se escriben localmente.
 */
const TIMEOUT_MS = 3_000;

/** La respuesta del servicio no se pudo usar: no contestó, contestó un error o algo que no se entiende. */
export class NumberConversionError extends Error {}

/**
 * Única puerta al servicio SOAP NumberConversion. Se arma el sobre a mano
 * porque es una sola operación con un solo parámetro: un cliente SOAP con
 * WSDL sería una dependencia entera para esto.
 */
@Injectable()
export class NumberConversionClient {
  constructor(private readonly config: ConfigService) {}

  /** `NumberToWords`: 145320 → "one hundred and forty five thousand three hundred and twenty". */
  async numeroEnPalabras(numero: number): Promise<string> {
    const sobre =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      `<soap:Body><NumberToWords xmlns="${NAMESPACE}"><ubiNum>${numero}</ubiNum></NumberToWords></soap:Body>` +
      '</soap:Envelope>';

    let respuesta: Response;
    try {
      respuesta = await fetch(this.url(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: sobre,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new NumberConversionError(`No respondió: ${(error as Error).message}`);
    }

    const xml = await respuesta.text();
    if (!respuesta.ok) {
      throw new NumberConversionError(`Respondió ${respuesta.status}`);
    }
    const resultado = /<(?:\w+:)?NumberToWordsResult>([^<]*)<\/(?:\w+:)?NumberToWordsResult>/.exec(xml)?.[1];
    if (resultado === undefined) {
      throw new NumberConversionError('La respuesta no trae NumberToWordsResult');
    }
    return resultado.trim();
  }

  private url(): string {
    return this.config.get<string>('NUMBER_CONVERSION_URL')?.trim() || URL_POR_DEFECTO;
  }
}
