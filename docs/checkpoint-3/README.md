# 3er checkpoint del TPO (27/10)

Fuente versionada de los tres documentos que se presentan junto con la demo en vivo. Se sube un PDF por documento al Teams de la cátedra.

| Documento | Qué pide la cátedra | Archivo |
|---|---|---|
| BRD | Objetivos medibles, alcance que incluye y excluye, stakeholders y al menos 5 BR priorizados con MoSCoW | [brd.md](brd.md) |
| Documentación funcional | HU con criterios Gherkin, reglas de negocio y RNF, prototipo y matriz BR, HU y CP. Las 21 HU cubren todos los módulos y la matriz traza los 117 casos de prueba | [documentacion-funcional.md](documentacion-funcional.md) |
| Manual de usuario | Al menos un tutorial y guías de las tareas principales por rol, capturas reales y errores frecuentes | [manual-usuario.md](manual-usuario.md) |

## Generar los PDF

```
python docs/checkpoint-3/generar_pdf.py
```

Sólo usa Python y Chrome, sin dependencias. Los PDF quedan en `docs/checkpoint-3/pdf/`, que no se versiona: se regeneran desde el Markdown.

## Capturas

El manual usa las capturas de `capturas/`, sacadas de la app real con las cuentas de demo: las del vecino en tamaño de celular y las del administrador en escritorio.
