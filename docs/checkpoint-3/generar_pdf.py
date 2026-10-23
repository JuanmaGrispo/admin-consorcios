"""Genera un PDF por documento del checkpoint, sin dependencias externas.

Convierte el Markdown de esta carpeta a HTML (sólo lo que usan estos
documentos: títulos, párrafos, listas, tablas, bloques de código, imágenes y
negritas) y lo imprime con Chrome en modo headless.

Uso:  python docs/checkpoint-3/generar_pdf.py
Los PDF quedan en docs/checkpoint-3/pdf/. Si Chrome no está en la ruta de
siempre, indicala con la variable de entorno CHROME.
"""

import html
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

CARPETA = Path(__file__).resolve().parent
SALIDA = CARPETA / 'pdf'
DOCUMENTOS = ['brd.md', 'documentacion-funcional.md', 'manual-usuario.md']
GHERKIN = ('Característica:', 'Escenario:', 'Dado', 'Cuando', 'Entonces', 'Y')

ESTILO = """
@page { size: A4; margin: 18mm 16mm; }
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #1b1917; line-height: 1.4; }
h1 { font-size: 20pt; margin: 0 0 8pt; }
h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 1px solid #e6e3dd; padding-bottom: 3pt; break-after: avoid; }
h3 { font-size: 12pt; margin: 14pt 0 4pt; break-after: avoid; }
p { margin: 0 0 6pt; }
ul, ol { margin: 0 0 6pt 18pt; padding: 0; }
li { margin: 0 0 3pt; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 10pt; break-inside: auto; }
tr { break-inside: avoid; }
th, td { border: 1px solid #c9c6bf; padding: 4pt 6pt; text-align: left; vertical-align: top; font-size: 9.5pt; }
th { background: #efefea; }
pre { background: #f6f5f2; border: 1px solid #e6e3dd; padding: 8pt; font-size: 9pt; white-space: pre-wrap; break-inside: avoid; }
code { font-family: Consolas, monospace; }
a { color: #2f5aa8; text-decoration: none; }
figure { margin: 6pt 0 10pt; break-inside: avoid; }
figure img { max-width: 100%; max-height: 120mm; border: 1px solid #e6e3dd; }
figcaption { font-size: 9pt; color: #7a746b; margin-top: 2pt; }
.pendiente { border: 1.5px dashed #c9c6bf; background: #fbfaf8; color: #7a746b; padding: 22pt 10pt; text-align: center; font-size: 9.5pt; }
"""


def en_linea(texto: str) -> str:
    t = html.escape(texto, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    return t


def imagen(alt: str, ruta: str) -> str:
    archivo = (CARPETA / ruta).resolve()
    if archivo.exists():
        cuerpo = f'<img src="{archivo.as_uri()}" alt="{html.escape(alt)}">'
    else:
        cuerpo = f'<div class="pendiente">Captura pendiente: {html.escape(alt)}<br>{html.escape(ruta)}</div>'
    return f'<figure>{cuerpo}<figcaption>{html.escape(alt)}</figcaption></figure>'


def item_con_imagenes(lineas: list[str]) -> str:
    partes = []
    for linea in lineas:
        m = re.match(r'\s*!\[([^\]]*)\]\(([^)]+)\)\s*$', linea)
        partes.append(imagen(*m.groups()) if m else en_linea(linea.strip()))
    return ' '.join(partes)


def celda(contenido: str) -> str:
    # Un código como "BR 01" o "RNF 10" no se parte en dos renglones.
    estilo = ' style="white-space:nowrap"' if re.fullmatch(r'[A-Z]{2,3} \d\d', contenido) else ''
    return f'<td{estilo}>{en_linea(contenido)}</td>'


def tabla(filas: list[str]) -> str:
    celdas = [[c.strip() for c in f.strip().strip('|').split('|')] for f in filas]
    encabezado, cuerpo = celdas[0], celdas[2:]
    h = '<table><thead><tr>' + ''.join(f'<th>{en_linea(c)}</th>' for c in encabezado) + '</tr></thead><tbody>'
    h += ''.join('<tr>' + ''.join(celda(c) for c in fila) + '</tr>' for fila in cuerpo)
    return h + '</tbody></table>'


def codigo(lineas: list[str]) -> str:
    salida = []
    for linea in lineas:
        sangria = len(linea) - len(linea.lstrip())
        resto = linea.lstrip()
        clave = next((k for k in GHERKIN if resto == k or resto.startswith(k + ' ')), None)
        texto = f'<strong>{html.escape(clave)}</strong>{html.escape(resto[len(clave):])}' if clave else html.escape(resto)
        salida.append(' ' * sangria + texto)
    return '<pre><code>' + '\n'.join(salida) + '</code></pre>'


def a_html(md: str) -> str:
    lineas = md.splitlines()
    partes: list[str] = []
    i = 0
    while i < len(lineas):
        linea = lineas[i]
        if not linea.strip():
            i += 1
        elif linea.startswith('```'):
            j = i + 1
            while not lineas[j].startswith('```'):
                j += 1
            partes.append(codigo(lineas[i + 1:j]))
            i = j + 1
        elif m := re.match(r'(#{1,4})\s+(.*)', linea):
            nivel = len(m.group(1))
            partes.append(f'<h{nivel}>{en_linea(m.group(2))}</h{nivel}>')
            i += 1
        elif linea.startswith('|'):
            j = i
            while j < len(lineas) and lineas[j].startswith('|'):
                j += 1
            partes.append(tabla(lineas[i:j]))
            i = j
        elif re.match(r'(-|\d+\.)\s', linea):
            ordenada = bool(re.match(r'\d+\.', linea))
            items: list[list[str]] = []
            while i < len(lineas) and (re.match(r'(-|\d+\.)\s', lineas[i]) or lineas[i].startswith('   ')):
                if re.match(r'(-|\d+\.)\s', lineas[i]):
                    items.append([re.sub(r'^(-|\d+\.)\s+', '', lineas[i])])
                else:
                    items[-1].append(lineas[i])
                i += 1
            etiqueta = 'ol' if ordenada else 'ul'
            partes.append(f'<{etiqueta}>' + ''.join(f'<li>{item_con_imagenes(it)}</li>' for it in items) + f'</{etiqueta}>')
        elif m := re.match(r'!\[([^\]]*)\]\(([^)]+)\)\s*$', linea):
            partes.append(imagen(*m.groups()))
            i += 1
        else:
            parrafo = []
            while i < len(lineas) and lineas[i].strip() and not re.match(r'(#|\||```|-\s|\d+\.\s|!\[)', lineas[i]):
                parrafo.append(en_linea(lineas[i].strip()))
                i += 1
            partes.append('<p>' + '<br>'.join(parrafo) + '</p>')
    return '\n'.join(partes)


def chrome() -> str:
    candidatos = [
        os.environ.get('CHROME', ''),
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        shutil.which('google-chrome') or '',
        shutil.which('chromium') or '',
    ]
    for c in candidatos:
        if c and Path(c).exists():
            return c
    sys.exit('No encontré Chrome: indicá la ruta con la variable de entorno CHROME.')


def main() -> None:
    SALIDA.mkdir(exist_ok=True)
    navegador = chrome()
    for nombre in DOCUMENTOS:
        md = (CARPETA / nombre).read_text(encoding='utf-8')
        titulo = md.splitlines()[0].lstrip('# ').strip()
        pagina = SALIDA / (Path(nombre).stem + '.html')
        pagina.write_text(
            f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{html.escape(titulo)}</title>'
            f'<style>{ESTILO}</style></head><body>{a_html(md)}</body></html>',
            encoding='utf-8',
        )
        pdf = SALIDA / (Path(nombre).stem + '.pdf')
        subprocess.run(
            [navegador, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
             f'--print-to-pdf={pdf}', pagina.as_uri()],
            check=True, capture_output=True,
        )
        pagina.unlink()
        print(f'{pdf.relative_to(CARPETA)}')


if __name__ == '__main__':
    main()
