"""Verifica la sesión a través de ZAP y conserva solo evidencia sin secretos."""
import json
import os
from collections import Counter
from pathlib import Path

API = "http://host.docker.internal:4400/api/"


def comprobar(zap, fase):
    mensajes = zap.core.send_request(
        "GET " + API + "auth/me HTTP/1.1\r\nHost: host.docker.internal:4400\r\n\r\n",
        followredirects=False,
    )
    mensaje = mensajes[-1]
    estado = int(mensaje["responseHeader"].split(" ")[1])
    usuario = json.loads(mensaje["responseBody"])
    valido = estado == 200 and usuario.get("rol") == "SUPER_ADMIN"
    prueba = {"fase": fase, "estado": estado, "rol": usuario.get("rol"), "valido": valido}
    destino = Path("/zap/wrk") / (os.environ["ZAP_SCAN_NAME"] + "-sesion-" + fase + ".json")
    destino.write_text(json.dumps(prueba), encoding="utf-8")
    if not valido:
        raise RuntimeError("ZAP no conserva la sesión autenticada")


def zap_started(zap, target):
    comprobar(zap, "antes")


def zap_active_scan(zap, target, policy):
    cuerpo = os.environ["ZAP_RECLAMO_JSON"]
    peticion = (
        "POST " + API + "reclamos HTTP/1.1\r\nHost: host.docker.internal:4400\r\n"
        "Content-Type: application/json\r\nContent-Length: " + str(len(cuerpo.encode("utf-8"))) + "\r\n\r\n" + cuerpo
    )
    mensajes = zap.core.send_request(peticion, followredirects=False)
    estado = int(mensajes[-1]["responseHeader"].split(" ")[1])
    destino = Path("/zap/wrk/activo-api-control-post.json")
    destino.write_text(json.dumps({"estado": estado, "valido": estado == 201}), encoding="utf-8")
    if estado != 201:
        raise RuntimeError("ZAP no pudo crear el reclamo de control antes del ataque activo")
    return zap, target, policy


def zap_pre_shutdown(zap):
    comprobar(zap, "despues")
    mensajes = zap.core.messages(baseurl=API, start=0, count=10000)
    estados = Counter()
    sin_respuesta = 0
    exitos = set()
    for mensaje in mensajes:
        linea = mensaje.get("requestHeader", "").split("\r\n")[0].split(" ")
        respuesta = mensaje.get("responseHeader", "").split(" ")
        if len(linea) < 2 or len(respuesta) < 2:
            continue
        estado = respuesta[1].strip()
        if not (len(estado) == 3 and estado.isdigit()):
            sin_respuesta += 1
            continue
        estados[estado] += 1
        # No conserva query strings, cuerpos, cookies ni valores de ataques.
        ruta = linea[1].split("?")[0]
        if estado.startswith("2") and ruta.rstrip("/") != API.rstrip("/") + "/auth/me":
            exitos.add(linea[0] + " " + ruta)
    resultado = {"muestraMaxima": 10000, "respuestasPorEstado": dict(estados), "sinRespuestaHTTP": sin_respuesta, "operacionesCon2xx": sorted(exitos)}
    destino = Path("/zap/wrk") / (os.environ["ZAP_SCAN_NAME"] + "-trafico.json")
    destino.write_text(json.dumps(resultado, indent=2), encoding="utf-8")
