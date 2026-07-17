#!/usr/bin/env python3
# Driver 31 — JUA-33 remediación NO-GO A+B (B-1, B-2, B-3 + OBS-2). Servidor.
# Cuenta con push:misDispositivos (sin efectos). Crea y limpia un operativo QA.
# Uso: ADMIN_PASS=.. CARLOS_PASS=.. V2_PASS=.. python3 driver-31-push-remediacion.py <reporte.txt>
import subprocess, json, sys, os, time, secrets

REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-push-remediacion.txt")
AP, CP, VP = os.environ.get("ADMIN_PASS"), os.environ.get("CARLOS_PASS"), os.environ.get("V2_PASS")

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0:
        raise RuntimeError((o.stderr or o.stdout).strip())
    s = o.stdout.strip()
    return json.loads(s) if s else None

def lanza(fn, a, keyword):
    try:
        run(fn, a); return False
    except Exception as e:
        return keyword in str(e)

resultados, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m
    print(l, flush=True); resultados.append(l)
    if not c: fallos.append(m)

def n_disp(token):
    return run("push:misDispositivos", {"token": token})

if not AP or not CP or not VP:
    print("Faltan ADMIN_PASS / CARLOS_PASS / V2_PASS"); sys.exit(2)

TA = run("auth:iniciarSesion", {"email": "marta@demo.mx", "password": AP})["token"]
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]
TV = run("auth:iniciarSesion", {"email": "vendedor2.qa@test.mx", "password": VP})["token"]
KEYS = {"p256dh": "B" + "a" * 80, "auth": "b" * 22}
EP = f"https://push.example.com/reassoc-{secrets.token_hex(4)}"
EP_FAKE = f"https://push.example.com/fake-{secrets.token_hex(4)}"
qa_email = f"qa-push-{int(time.time())}@test.mx"
qa_id = None
try:
    # OBS-2: validación de entrada
    ok(lanza("push:guardarSubscription", {"token": TC, "endpoint": "http://no-https.example", **KEYS}, "Suscripción no válida"),
       "OBS-2: endpoint no-HTTPS → rechazado")
    ok(lanza("push:guardarSubscription", {"token": TC, "endpoint": "https://ok.example/x", "p256dh": "a" * 500, "auth": "b" * 22}, "Suscripción no válida"),
       "OBS-2: clave excesivamente larga → rechazada")

    # B-1: reasociación de endpoint al cambiar de cuenta en el mismo navegador
    baseC, baseV = n_disp(TC), n_disp(TV)
    run("push:guardarSubscription", {"token": TC, "endpoint": EP, **KEYS})
    ok(n_disp(TC) == baseC + 1, "B-1: Carlos suscribe el endpoint (sus dispositivos suben 1)")
    run("push:guardarSubscription", {"token": TV, "endpoint": EP, **KEYS})  # mismo endpoint, otra sesión
    ok(n_disp(TC) == baseC, "B-1: tras re-suscribir desde otra cuenta, el endpoint YA NO es de Carlos")
    ok(n_disp(TV) == baseV + 1, "B-1: el endpoint pasó al nuevo usuario (Vendedor Dos)")
    run("push:borrarSubscription", {"token": TC, "endpoint": EP})  # dueño anterior no puede
    ok(n_disp(TV) == baseV + 1, "B-1: el dueño anterior NO puede borrar el endpoint reasignado")
    run("push:borrarSubscription", {"token": TV, "endpoint": EP})  # nuevo dueño sí
    ok(n_disp(TV) == baseV, "B-1: el nuevo dueño sí lo borra")

    # B-3: enviarPrueba distingue fallo de 'sin dispositivos' (datos que consume la UI)
    run("push:guardarSubscription", {"token": TC, "endpoint": EP_FAKE, **KEYS})
    r = run("pushEnvio:enviarPrueba", {"token": TC})
    ok(r["total"] >= 1 and r["enviadas"] == 0 and (r["fallidas"] + r["caducadas"]) >= 1,
       f"B-3: con sub que falla → total>0 y 0 enviadas (UI mostrará fallo, no 'sin dispositivos'): {r}")
    try: run("push:borrarSubscription", {"token": TC, "endpoint": EP_FAKE})  # por si no fue 404/410
    except Exception: pass
    ok(n_disp(TC) == baseC, "B-3: limpieza — Carlos vuelve a su línea base de dispositivos")

    # Auth
    ok(lanza("pushEnvio:enviarPrueba", {"token": "malo"}, "No autorizado"), "Auth: enviarPrueba con token inválido → No autorizado")

    # B-2: al desactivar un usuario se borran sus suscripciones
    run("usuarios:invitar", {"token": TA, "email": qa_email, "nombre": "QA Push", "rol": "operativo"})
    inv = next(i for i in run("usuarios:listar", {"token": TA})["invitaciones"] if i["email"] == qa_email and i["estado"] == "pendiente")
    run("invitaciones:activar", {"token": inv["token"], "password": "QaPush123seguro"})
    TQ = run("auth:iniciarSesion", {"email": qa_email, "password": "QaPush123seguro"})["token"]
    qa_id = run("auth:sesionActual", {"token": TQ})["usuario"]["_id"]
    run("push:guardarSubscription", {"token": TQ, "endpoint": f"https://push.example.com/qa-{secrets.token_hex(3)}", **KEYS})
    ok(n_disp(TQ) == 1, "B-2: el operativo QA tiene 1 dispositivo antes de desactivar")
    run("usuarios:desactivar", {"token": TA, "usuarioId": qa_id})
    # El conteo de 0 subs del QA tras desactivar se verifica aparte (MCP runOneoffQuery),
    # porque su sesión ya no es válida para consultar `misDispositivos`.
    print(f"[b2] desactivado {qa_id}; verificar 0 subs por MCP.", flush=True)
except Exception as e:
    ok(False, f"excepción: {str(e)[:200]}")
finally:
    for t in (TA, TC, TV):
        try: run("auth:cerrarSesion", {"token": t})
        except Exception: pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-31 remediación push NO-GO A+B (JUA-33)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        f"B-2: verificar aparte que {qa_id} quedó con 0 pushSubscriptions (mcp runOneoffQuery).",
        "operativo QA creado y desactivado; sin tokens ni contraseñas.", "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}")
print(f"QA_ID={qa_id}")
sys.exit(1 if fallos else 0)
