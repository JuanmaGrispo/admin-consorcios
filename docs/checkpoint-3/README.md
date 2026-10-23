# 3er checkpoint del TPO (27/10)

Fuente versionada de los tres documentos que se presentan junto con la demo en vivo. Se sube un PDF por documento al Teams de la cátedra, con los enlaces a Jira y a Figma.

| Documento | Qué pide la cátedra | Archivo |
|---|---|---|
| BRD | Objetivos medibles, alcance que incluye y excluye, stakeholders y al menos 5 BR priorizados con MoSCoW | [brd.md](brd.md) |
| Documentación funcional | HU con criterios Gherkin, reglas de negocio y RNF, prototipo en Figma y matriz BR, HU y CP. Las 21 HU cubren todos los módulos y la matriz traza los 117 casos de prueba | [documentacion-funcional.md](documentacion-funcional.md) |
| Manual de usuario | Al menos un tutorial y guías de las tareas principales por rol, capturas reales y errores frecuentes | [manual-usuario.md](manual-usuario.md) |

## Generar los PDF

```
python docs/checkpoint-3/generar_pdf.py
```

Sólo usa Python y Chrome, sin dependencias. Los PDF quedan en `docs/checkpoint-3/pdf/`, que no se versiona: se regeneran desde el Markdown.

## Antes de entregar

- **Capturas reales.** El manual referencia estas imágenes en `capturas/`. Mientras falten, el PDF muestra un recuadro "Captura pendiente". Se sacan de la app real, no del prototipo.

  | Archivo | Pantalla |
  |---|---|
  | 01-ingreso.png | Pantalla de ingreso |
  | 02-vecino-inicio.png | Inicio del vecino, con la tarjeta de expensas |
  | 03-vecino-pago-aprobado.png | Resultado de un pago aprobado, con el número de recibo |
  | 04-vecino-expensas.png | Mis expensas |
  | 05-vecino-nuevo-reclamo.png | Formulario de nuevo reclamo |
  | 06-vecino-reservas.png | Reservas del vecino |
  | 07-vecino-votar.png | Asambleas y votaciones, con una votación abierta |
  | 08-admin-gastos.png | Liquidación en borrador con sus gastos |
  | 09-admin-previsualizacion.png | Previsualización de boletas |
  | 10-admin-cobranzas.png | Cobranzas |
  | 11-admin-reclamo.png | Detalle de un reclamo en la bandeja del administrador |
  | 12-admin-panel.png | Panel general del administrador |

- **Enlace de Figma.** Completar en la sección 5 de la documentación funcional.
- **Aprobaciones del BRD.** Completar la tabla de firmas de la sección 10.
