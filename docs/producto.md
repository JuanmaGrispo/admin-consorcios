# Domus — Visión del producto

> Alcance funcional e integraciones previstas, escrito antes de arrancar el
> código. Si algo de acá choca con [CLAUDE.md](../CLAUDE.md) o el
> [README](../README.md), mandan esos: describen cómo está hecho hoy.

## Qué es este proyecto

App web para administradores de consorcios que digitaliza la gestión completa de edificios. Reemplaza los grupos de WhatsApp, los papelitos del ascensor y las planillas de Excel con una plataforma donde el administrador gestiona múltiples edificios desde un solo panel y cada vecino tiene su portal personal.

## Funcionalidades principales

- **Expensas:** liquidación por unidad, generación de boleta, cobro online vía Mercado Pago, emisión de recibo, exportación a Excel.
- **Reclamos:** creación por vecino con seguimiento de estado, gestión por el administrador.
- **Reservas de amenities:** reserva de SUM y espacios comunes con control de disponibilidad.
- **Votaciones y asambleas:** creación de propuestas, sistema de votación con quórum, registro de asistencia.
- **Tablón de novedades:** muro de comunicados publicados por el administrador.
- **Usuarios y consorcios:** ABM de consorcios, unidades funcionales y usuarios con roles diferenciados (admin / vecino).
- **Notificaciones:** email vía NodeMailer (boletas, recibos, comunicados). WhatsApp planificado.

## Arquitectura — Capas

El sistema sigue una arquitectura en tres capas con una API REST intermedia:

```
┌─────────────────────────────────────────────────────┐
│  PRESENTACIÓN                                       │
│  Portal Admin  ·  Portal Vecino  ·  Notificaciones  │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  CONTROLLERS (API REST)                             │
│  ExpensasController    ReclamosController            │
│  ReservasController    VotacionesController          │
│  PagosController       NovedadesController           │
│  ConsorcioController   UsuarioController             │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  SERVICIOS (Capa de negocio)                        │
│  ExpensasService       ReclamosService               │
│  ReservasService       VotacionesService             │
│  PagosService          NovedadesService              │
│  ConsorcioService      UsuarioService                │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  REPOSITORIES (Capa de datos)                       │
│  ExpensasRepository    ReclamosRepository            │
│  ReservasRepository    VotacionesRepository          │
│  PagosRepository       NovedadRepository             │
│  ConsorcioRepository   UsuarioRepository             │
└─────────────────────────────────────────────────────┘
```

Todos los módulos comparten la misma base de datos (fuente de verdad única, latencia cero entre módulos).

## Integraciones externas

### Mercado Pago (API REST) — Camino crítico
- Crea preferencias de pago para expensas online.
- Recibe confirmación de pago vía **webhook asincrónico**.
- Debe garantizar **idempotencia** (el webhook puede llegar duplicado).
- Ante caída: timeout + reintentos, operación queda en estado pendiente hasta reconciliar.

### Servicio de email (NodeMailer) — No bloqueante
- Notifica boletas y recibos a cada vecino.
- Si el proveedor está caído, el pago se concreta igual; el mail se encola y se reintenta después.

### SOAP NumberConversion — Bajo riesgo, cosmético
- Convierte importes a letras en boletas/recibos.
- Fallback: generación local de letras o mostrar solo el valor numérico.

### Exportación a archivos
- Padrón de propietarios y liquidaciones exportables a Excel.
- Bajo acoplamiento con sistemas contables externos; no requiere tiempo real.

## Roles y portales

| Rol            | Qué ve / hace                                                                                    |
|----------------|--------------------------------------------------------------------------------------------------|
| Administrador  | Panel multi-edificio: liquidar expensas, ver cobranzas, gestionar reclamos, publicar novedades, crear votaciones, ver reservas del día. |
| Vecino         | Portal personal: estado de cuenta de expensas, pagar online, crear/seguir reclamos, reservar amenities, votar en asambleas.             |

## Flujos de proceso clave

### Liquidación y cobro de expensas
1. Admin liquida expensas del período.
2. Se genera boleta por unidad funcional.
3. Se notifica a cada vecino por email.
4. Vecino paga por Mercado Pago.
5. Webhook confirma el pago → se registra.
6. Se genera recibo.

Cada paso es un evento que dispara el siguiente. Diseñar con reintentos y manejo de fallos.

### Gestión de reclamos
Vecino crea reclamo → admin lo ve y gestiona → seguimiento de estados → resolución.

### Votación en asamblea
Admin crea asamblea → vecinos marcan asistencia → se publican propuestas → votación con control de quórum → resultados.

## Decisiones de diseño relevantes

- **Base de datos única compartida:** todos los módulos operan sobre el mismo esquema. Ventaja: consistencia inmediata. Riesgo: un cambio de esquema impacta a todos los módulos.
- **Integraciones procedurales con reintentos:** Mercado Pago y email manejan fallos con colas y reintentos sin frenar el flujo principal.
- **Dos portales, un sistema:** admin y vecino son vistas distintas sobre los mismos datos, no sistemas separados.

## Convenciones para contribuir

- Respetar la separación Controller → Service → Repository. La lógica de negocio vive en los Services, nunca en Controllers ni Repositories.
- Cada entidad de dominio (Expensa, Reclamo, Reserva, Votación, Novedad, Consorcio, Usuario) tiene su tripleta Controller/Service/Repository.
- Las integraciones externas (Mercado Pago, email, SOAP) se encapsulan en servicios dedicados, no se llaman directo desde los controllers.
- Los webhooks deben ser idempotentes.
- Las notificaciones son siempre no bloqueantes (encolar ante fallo).