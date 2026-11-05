# Verificación dinámica con OWASP ZAP

## Reproducción local

Con Docker Desktop activo y dependencias instaladas (este spider no necesita
Chromium):

```powershell
docker pull ghcr.io/zaproxy/zaproxy:stable
pnpm back test:seguridad:zap
```

El comando prepara PostgreSQL y RabbitMQ descartables con el runner de
aceptación, restaura el esquema sin datos y genera fixtures y credenciales
efímeras. Compila el backend Docker con Node.js 22 y el frontend Next en modo
`production`. Mercado Pago, Storage y SMTP utilizan simuladores locales.
El esquema de Supabase compartido y la contraseña demo no se modifican.

Los puertos locales 3300, 4400, 55432, 55672 y 55673 deben estar disponibles.
No ejecutar simultáneamente este comando y los otros runners de aceptación:
comparten el proyecto Docker `domus-aceptacion`. Al terminar se eliminan
únicamente los contenedores, red y datos de ese entorno. El frontend se
detiene y los contenedores ajenos continúan activos.

La imagen oficial se resuelve a su digest y ese digest se usa en ambos
escaneos. Se conserva en el resumen junto con la versión de ZAP y el commit
base, indicando que había cambios locales sin commit.

## Alcance

1. **Baseline web autenticado:** spider tradicional de un minuto sobre el
   formulario de consorcio y sus enlaces, seguido de análisis pasivo. No
   ejecuta JavaScript ni equivale a recorrer todos los flujos de la SPA.
2. **Activo de API autenticado:** el exportador obtiene OpenAPI desde la app
   descartable sin habilitar Swagger en producción. Selecciona 12 lecturas y
   `POST /api/reclamos`, con UUID de los fixtures. El listado exacto queda en
   `openapi-alcance.json` y en el resumen. Las operaciones de administración de
   cuentas y otros métodos de escritura quedan fuera de ese alcance.

Se utiliza la cookie de una sesión real de `SUPER_ADMIN`, inyectada mediante
las variables de autenticación que admite ZAP y restringida al host local.
Los hooks verifican `GET /api/auth/me` **a través de ZAP** antes y después de
cada escaneo. El activo exige además un `POST /api/reclamos` de control con
respuesta 201 antes de comenzar los ataques y su presencia en el historial.
Estas verificaciones fallan si no se acredita la sesión; no basta con tener
un token ni con obtener respuestas 401/403.

La cookie se pasa por variables efímeras del contenedor y se omite de los
reportes y logs exportados. No se guardan sesiones de ZAP. Las muestras de
tráfico conservan códigos de respuesta y métodos/rutas exitosos, sin headers,
cuerpos ni query strings. Se distinguen las solicitudes sin respuesta HTTP
de los códigos que realmente devolvió el servidor.

El activo usa la política API de ZAP, dos threads, máximo de diez minutos por
escaneo y un minuto por regla. Esta política no reemplaza pruebas específicas
de XSS en navegador, autorización entre roles, carga ni una revisión manual.
El destino es HTTP local: TLS, certificados y el comportamiento del navegador
con cookies Secure sobre HTTPS requieren otro entorno.

## Evidencias y resultados

Los reportes completos HTML/JSON, logs, pruebas de sesión y resumen quedan en
`apps/backend/acceptance/resultados/zap/`, ignorado por git. El estado del
runner queda en `resultados/zap-entorno.json`, separado de `integral.json`
para conservar la evidencia anterior de integración.

El código de salida de los scripts oficiales se conserva por escaneo:
0 sin advertencias según su configuración, 1 con FAIL, 2 con WARN y 3 con
fallo de ejecución. El runner permite terminar y conservar reportes con
0/1/2 si los controles de autenticación son válidos. **Su código 0 significa
que pudo ejecutar y guardar los escaneos, no que la aplicación haya aprobado
un Quality Gate de seguridad.**

La corrida inicial no acreditó un alta válida por POST en el historial. Se
agregó ese control y se repitió la prueba completa. Los resultados finales
del **05/11/2026** con ZAP **2.17.0** son:

| Escaneo | Duración del contenedor | Código ZAP | Resultado observado |
|---|---:|---:|---|
| Baseline web | 50 s | 2 | 3 alertas medias, 3 bajas y 4 informativas |
| Activo API | 92 s | 0 | 3 informativas; sin alertas de riesgo bajo, medio o alto en el alcance analizado |

Los controles de sesión a través de ZAP devolvieron 200 con `SUPER_ADMIN`
antes y después de ambos escaneos. El control de escritura devolvió 201.
En el historial API del activo hubo 453 respuestas 200, una 201, 3621 de
validación 400 y 27 de recurso/ruta inexistente 404. También hubo cinco
solicitudes sin respuesta HTTP, que se conservan como tales; no se presentan
como respuestas exitosas. No se observaron 401, 403 ni 500 en esa muestra.
La ausencia de alertas de riesgo en ese alcance no acredita todos los
endpoints ni todos los payloads, roles o flujos de la aplicación.

La [evidencia resumida versionada](evidencias/zap-2026-11-05.json) conserva
los resultados, pruebas de sesión/POST y hashes SHA-256 de reportes y fuentes.
Los reportes completos deben conservarse aparte si se necesita un expediente
de auditoría: su carpeta local está ignorada por git.

### Hallazgos abiertos de la web

| ID ZAP | Alerta | Riesgo | Estado |
|---|---|---|---|
| 10055 | CSP: Wildcard Directive (`img-src ... https:`) | Medio | Pendiente de restringir orígenes sin romper imágenes legítimas |
| 10055 | CSP: script-src unsafe-inline | Medio | Pendiente de diseñar y verificar nonces u otra política compatible con Next |
| 10055 | CSP: style-src unsafe-inline | Medio | Pendiente de revisar estilos e integración con los componentes |
| 90004 | Cross-Origin-Embedder-Policy ausente | Bajo | Pendiente de evaluar compatibilidad con recursos externos |
| 90004 | Cross-Origin-Opener-Policy ausente | Bajo | Pendiente de evaluar compatibilidad con ventanas de pagos |
| 90004 | Cross-Origin-Resource-Policy ausente | Bajo | Pendiente de definir la política por recurso |

Las alertas son observaciones del escáner, no pruebas de explotación. No se
suprimieron reglas para obtener un reporte sin advertencias. Este punto queda
**ejecutado con hallazgos abiertos**; la remediación y su nueva verificación
requieren un paso posterior. No está agregado al CI ni se marca como
acreditación de los 85 criterios. DEF-09 (contraseña demo) se omite por decisión
del usuario y no se considera resuelto.

## Referencias

La corrección posterior de las tres alertas CSP, sus controles de navegador y
la comparación con una nueva corrida están en
[`seguridad-csp.md`](seguridad-csp.md). La tabla anterior conserva el resultado
original como antecedente; las tres alertas bajas de aislamiento siguen abiertas.

- [Baseline oficial](https://www.zaproxy.org/docs/docker/baseline-scan/).
- [Escaneo de API y códigos de salida](https://www.zaproxy.org/docs/docker/api-scan/).
- [Autenticación mediante headers](https://www.zaproxy.org/docs/desktop/start/features/authentication/).
- [Hooks de escaneo](https://www.zaproxy.org/docs/docker/scan-hooks/).
