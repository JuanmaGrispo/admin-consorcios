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
 * El servicio contestó un `soap:Fault`. `negocio` es un `soap:Client` (el
 * pedido no es válido para el servicio); `tecnico`, un `soap:Server` o
 * cualquier otro código (falló el servicio). En los dos casos las letras se
 * escriben localmente: el Fault queda en el log y nunca llega al usuario.
 */
export class NumberConversionFault extends NumberConversionError {
  constructor(
    readonly tipo: 'negocio' | 'tecnico',
    readonly codigo: string,
    readonly detalle: string,
  ) {
    super(`Fault ${tipo === 'negocio' ? 'de negocio' : 'técnico'} (${codigo}): ${detalle}`);
  }
}

/** Lee un `soap:Fault` de la respuesta, si lo hay. Es SOAP 1.1, como el servicio. */
export function leerFault(xml: string): NumberConversionFault | null {
  if (!/<(?:\w+:)?Fault[\s>]/.test(xml)) return null;
  const codigo = /<faultcode>\s*([^<]*?)\s*<\/faultcode>/.exec(xml)?.[1] ?? 'desconocido';
  const detalle = (/<faultstring>([^<]*)<\/faultstring>/.exec(xml)?.[1] ?? '').trim().slice(0, 200);
  const tipo = /(^|:)Client$/.test(codigo) ? 'negocio' : 'tecnico';
  return new NumberConversionFault(tipo, codigo, detalle);
}

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
    // SOAP 1.1 manda el Fault con HTTP 500, pero algunos servicios lo mandan con 200.
    const fault = leerFault(xml);
    if (fault) throw fault;
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
