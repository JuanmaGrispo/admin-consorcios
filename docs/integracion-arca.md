# Domus — Verificación de CUIT contra ARCA (diseño)

> **Estado: diseño, no implementado.** Este documento describe cómo se
> integraría Domus con ARCA (ex AFIP) para verificar los CUIT que se cargan en
> el sistema. No hay código de esta integración en el repo: queda como
> referencia de dónde y cómo se conectaría. Hoy el CUIT de consorcios y
> proveedores sólo se valida por formato (`30-12345678-9`).

## 1. Qué problema resuelve

Domus guarda dos CUIT que después se imprimen o se usan para pagar:

- **Consorcio** (`consorcio.cuit`): sale en el encabezado de la boleta y el recibo.
- **Proveedor** (`proveedor.cuit`): el administrador lo carga para asignarle
  reclamos y pagarle gastos.

Un CUIT mal tipeado pasa la validación de formato y termina en un comprobante.
Verificarlo contra el padrón de ARCA confirma que existe, que está activo y
trae la razón social oficial para compararla con la cargada.

## 2. Servicios de ARCA que intervienen

Los dos son **SOAP**:

| Servicio | Para qué | Operación |
|---|---|---|
| **WSAA** (Autenticación y Autorización) | Obtener un ticket de acceso firmado | `loginCms`: recibe un TRA (XML firmado con el certificado) y devuelve `token` + `sign`, válidos 12 horas |
| **Padrón A13** (`ws_sr_padron_a13`) | Consultar los datos de un CUIT | `getPersona(token, sign, cuitRepresentada, idPersona)` |

Para usarlos hace falta un **certificado digital** emitido por ARCA y asociado
a un CUIT con clave fiscal, y habilitar el servicio en "Administrador de
Relaciones". En homologación (testing) se usa el mismo flujo contra los
endpoints de prueba.

**Por qué no se implementó:** el certificado tiene que estar a nombre de una
persona o empresa real con clave fiscal. Para un trabajo de facultad no
corresponde gestionarlo, y sin él no se puede hacer ninguna llamada, ni
siquiera en homologación.

## 3. Dónde viviría en el código

Siguiendo las reglas del repo (módulos planos, integraciones encapsuladas):

```
src/modules/arca/
├── arca.module.ts
├── wsaa.client.ts        loginCms: arma el TRA, lo firma (CMS/PKCS#7) y cachea token+sign hasta que vencen
├── padron.client.ts      getPersona: arma el sobre SOAP y lee la respuesta
└── arca.service.ts       verificarCuit(cuit) → resultado normalizado; lo usan proveedores y consorcios
```

Variables de entorno: `ARCA_CERT`, `ARCA_KEY` (rutas al certificado y la clave
privada), `ARCA_CUIT_REPRESENTADA` y `ARCA_ENTORNO` (`homologacion` |
`produccion`). Sin ellas, la verificación queda deshabilitada y el resto de la
app funciona igual, como pasa con Mercado Pago sin token.

## 4. Contrato

```ts
// arca.service.ts
type ResultadoCuit =
  | { estado: 'VERIFICADO'; razonSocial: string; activo: boolean; tipoPersona: 'FISICA' | 'JURIDICA' }
  | { estado: 'INEXISTENTE' }          // ARCA respondió que el CUIT no existe
  | { estado: 'NO_DISPONIBLE' };       // timeout, error de ARCA o integración sin configurar
```

`NO_DISPONIBLE` no es un rechazo: significa "no se pudo verificar ahora".

## 5. Sincrónico o asincrónico

**Asincrónico.** El alta de un proveedor o un consorcio no espera a ARCA:

1. El service guarda el registro como siempre y publica un evento en
   `domus.eventos` (el exchange de [mensajeria.md](mensajeria.md)):

   ```json
   {
     "evento_id": "uuid",
     "tipo_evento": "cuit.cargado",
     "consorcio_id": "uuid",
     "timestamp": "2026-10-19T12:00:00Z",
     "payload": { "entidad": "proveedor", "id": "uuid", "cuit": "30-71234567-9" }
   }
   ```

2. Un consumidor (`q.arca-verificador`, binding `cuit.cargado`) llama a
   `arca.service.verificarCuit` y guarda el resultado.
3. Si la razón social de ARCA no coincide con la cargada o el CUIT no existe,
   avisa al administrador por la bandeja de notificaciones.

Por qué no sincrónico: ARCA tiene caídas y ventanas de mantenimiento, y el
WSAA suma una llamada más cuando el ticket venció. Bloquear el alta por un
servicio externo contradice el criterio de `docs/producto.md`: las
integraciones no frenan el flujo principal.

## 6. Timeouts y reintentos

- Timeout de **5 segundos** por llamada (WSAA y padrón por separado).
- Ante `NO_DISPONIBLE`, el consumidor reintenta con espera creciente (1, 5 y
  30 minutos) y después deja el registro como "sin verificar", sin bloquear nada.
- El ticket del WSAA se cachea en memoria hasta 10 minutos antes de vencer:
  ARCA rechaza pedir un ticket nuevo mientras el anterior sigue vigente.
- Idempotente: verificar dos veces el mismo CUIT da el mismo resultado, así
  que un mensaje duplicado no hace daño.

## 7. Cambios de esquema que haría falta

Una migración que sume a `proveedor` y a `consorcio`:

- `cuit_verificado_at timestamptz null`
- `cuit_estado varchar(15) null` (`VERIFICADO` | `INEXISTENTE` | `SIN_VERIFICAR`)
- `razon_social_arca varchar(150) null`

En el front, un `Badge` "CUIT verificado" / "Revisar CUIT" en la tabla de
proveedores y en el formulario del consorcio.
