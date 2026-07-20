#!/usr/bin/env python3
# Driver 46 — JUA-39: backend del registro público (verificar-antes-de-crear). Ejercita, contra
# dev (QA_HELPERS=1), las mutaciones de `registro` + integración con la cola de correo:
#   B-1 (solicitar NO crea negocio/usuario), anti-enumeración, throttle por email, supersesión,
#   fusible global, confirmar (crea negocio+admin+sesión, aislado), token usado/expirado,
#   email ocupado durante la espera, y purga.
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-jua39.txt")
TS = int(time.time())
PW = "PruebaJUA39!"
AHORA_MS = TS * 1000

def run(fn, a=None):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a or {})], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0:
        raise RuntimeError((o.stderr or o.stdout).strip()[-400:])
    s = o.stdout.strip()
    return json.loads(s) if s else None

def run_falla(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    return o.returncode != 0  # True si lanzó (esperado en casos negativos)

res, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m
    print(l, flush=True); res.append(l)
    if not c: fallos.append(m)

def solicitar(email, negocio="Mi Inmobiliaria", nombre="Ana Ruiz", zona="America/Mexico_City"):
    return run("registro:crearPendiente", {"nombreNegocio": negocio, "nombreAdmin": nombre, "email": email, "password": PW, "zonaHoraria": zona})

def pendientes():
    return run("registro:qaListarPendientes")

def por_email(email):
    return [p for p in pendientes() if p["email"] == email]

def negocios_con_email(email):
    return [n for n in run("negocios:listarNegocios") if n["emailAdmin"] == email]

def eventos_registro(pid):
    return [e for e in run("emailCola:qaListarEmails") if e.get("registroPendienteId") == pid]

negocios_qa = []
try:
    run("registro:qaPurgarPendientes"); run("emailCola:qaPurgarEmails")

    # T1 — B-1: solicitar crea un PENDIENTE + evento de correo, pero NO negocio ni usuario.
    E1 = f"jua39-t1-{TS}@ejemplo.mx"
    negs_antes = len(run("negocios:listarNegocios"))
    r1 = solicitar(E1)
    p1 = por_email(E1)
    negs_despues = len(run("negocios:listarNegocios"))
    ev1 = eventos_registro(p1[0]["id"]) if p1 else []
    ok(r1 == {"ok": True} and len(p1) == 1 and negs_despues == negs_antes and len(negocios_con_email(E1)) == 0,
       "T1 (B-1): solicitar → pendiente, SIN crear negocio/usuario")
    ok(len(ev1) == 1 and ev1[0]["tipo"] == "verificacion_registro" and ev1[0]["estado"] == "pendiente",
       "T1b: se encoló el email de verificación (tipo verificacion_registro)")

    # T2 — anti-enumeración: email que YA tiene cuenta → respuesta genérica, SIN crear pendiente.
    r2 = solicitar("marta@demo.mx")
    ok(r2 == {"ok": True} and len(por_email("marta@demo.mx")) == 0, "T2 (OBS-1): email existente → ok genérico, sin pendiente")

    # T3 — throttle por email: segunda solicitud del mismo email en la ventana → no crea otra.
    E3 = f"jua39-t3-{TS}@ejemplo.mx"
    solicitar(E3); solicitar(E3)
    ok(len(por_email(E3)) == 1, "T3: throttle por email → una sola solicitud reciente crea un pendiente")

    # T4 — supersesión: fuera de la ventana, una nueva solicitud borra el pendiente anterior del
    #      mismo email y descarta su correo (una transacción). Queda 1 pendiente (nuevo).
    viejo = por_email(E3)[0]; ev_viejo = eventos_registro(viejo["id"])[0]["id"]
    run("registro:qaAjustarPendiente", {"id": viejo["id"], "creadoEn": AHORA_MS - 10 * 60 * 1000})  # fuera de ventana
    solicitar(E3)
    quedan = por_email(E3)
    ev_viejo_estado = next((e for e in run("emailCola:qaListarEmails") if e["id"] == ev_viejo), None)
    ok(len(quedan) == 1 and quedan[0]["id"] != viejo["id"] and ev_viejo_estado and ev_viejo_estado["estado"] == "descartado" and ev_viejo_estado["resultado"] == "reemplazado",
       "T4 (precisión 3): supersesión por email en una transacción (viejo borrado + correo reemplazado)")

    # T5 — fusible global: con la cuota llena en la ventana, una nueva solicitud → rate_limited.
    run("registro:qaPurgarPendientes")
    run("registro:qaSembrarPendientes", {"n": 61, "creadoEn": AHORA_MS})  # > CUOTA (60)
    r5 = solicitar(f"jua39-t5-{TS}@ejemplo.mx")
    ok(r5.get("ok") is False and r5.get("motivo") == "rate_limited", "T5 (B-3): fusible global → rate_limited")
    run("registro:qaPurgarPendientes"); run("emailCola:qaPurgarEmails")

    # T6 — confirmar: crea negocio + admin + sesión; el pendiente se borra; sesión del nuevo negocio.
    E6 = f"jua39-t6-{TS}@ejemplo.mx"
    solicitar(E6, negocio="Negocio T6", nombre="Bea T6")
    pid6 = por_email(E6)[0]["id"]
    tok6 = run("registro:qaTokenDePendiente", {"id": pid6})["token"]
    conf = run("registro:confirmar", {"token": tok6})
    neg6 = negocios_con_email(E6)
    if neg6: negocios_qa.append(neg6[0]["negocioId"])
    ses = run("auth:sesionActual", {"token": conf["token"]}) if conf.get("token") else None
    u = ses and ses.get("usuario")
    ok(len(neg6) == 1 and neg6[0]["estado"] == "activo" and neg6[0]["admin"] == "activo" and len(por_email(E6)) == 0,
       "T6: confirmar → negocio activo + admin activo; pendiente borrado")
    ok(u and u.get("email") == E6 and u.get("rol") == "admin", "T6b: la sesión creada es del nuevo admin (aislada en su negocio)")

    # T7 — token de un solo uso: reconfirmar el mismo token → falla (ya consumido).
    ok(run_falla("registro:confirmar", {"token": tok6}), "T7: token ya usado → confirmar falla")

    # T8 — email ocupado durante la espera: solicitar, luego ocupar el email, luego confirmar → falla.
    E8 = f"jua39-t8-{TS}@ejemplo.mx"
    solicitar(E8, negocio="Negocio T8")
    pid8 = por_email(E8)[0]["id"]; tok8 = run("registro:qaTokenDePendiente", {"id": pid8})["token"]
    alta = run("negocios:crearNegocio", {"nombre": "Ocupa T8", "emailAdmin": E8}); negocios_qa.append(alta["negocioId"])
    fallo8 = run_falla("registro:confirmar", {"token": tok8})
    ok(fallo8 and len(negocios_con_email(E8)) == 1, "T8 (precisión 4): email ocupado en la espera → confirmar falla, sin crear 2.º negocio")

    # T9 — purga: un pendiente vencido se elimina por rango (cron).
    E9 = f"jua39-t9-{TS}@ejemplo.mx"
    solicitar(E9)
    pid9 = por_email(E9)[0]["id"]
    run("registro:qaAjustarPendiente", {"id": pid9, "expiraEn": AHORA_MS - 1000})  # vencido
    purga = run("registro:purgarPendientes")
    ok(purga["borrados"] >= 1 and len(por_email(E9)) == 0, "T9 (B-3): purga por rango elimina los vencidos")

except Exception as e:
    ok(False, f"excepción: {str(e)[:400]}")
finally:
    for nid in negocios_qa:
        try: run("negocios:qaBorrarNegocio", {"negocioId": nid})
        except Exception: pass
    try: run("registro:qaPurgarPendientes")
    except Exception: pass
    try: run("emailCola:qaPurgarEmails")
    except Exception: pass

n_pass = sum(1 for r in res if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-46 JUA-39 — backend del registro público (verificar-antes-de-crear)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        "entorno: dev, QA_HELPERS=1. Sin Turnstile/Route Handler (se prueba la lógica de dominio).",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "sin passwordHash/token en la salida; negocios QA borrados; pendientes/eventos purgados.", "", *res,
    ]) + "\n")
print(f"\nReporte en {REPORTE}")
sys.exit(1 if fallos else 0)
