#!/usr/bin/env python3
# Driver 35 — JUA-33 B-2: el encolado respeta la PREFERENCIA de cada usuario.
# Uso: ADMIN_PASS=.. CARLOS_PASS=.. python3 driver-35-b2-preferencias.py <reporte.txt>
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-b2.txt")
AP, CP = os.environ.get("ADMIN_PASS"), os.environ.get("CARLOS_PASS")
SOFIA = "j570t8dpsvdjayqytts4psjbbd8a9q75"; SEG = "jn73ncnmefjay53tv9f8q4e8bn8a9150"
CARLOS_ID = "js79sd3wf64tmnaz6abv0symtn8a939x"; MARTA_ID = "js75cv777hf0tj8khrcx0rwx9x8a8jhb"; DIA = 86400000

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-200:])
    s = o.stdout.strip(); return json.loads(s) if s else None
resultados, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); resultados.append(l)
    if not c: fallos.append(m)

if not AP or not CP: print("faltan creds"); sys.exit(2)
TA = run("auth:iniciarSesion", {"email": "marta@demo.mx", "password": AP})["token"]
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]

def destinatarios_sofia():
    return sorted({n["usuarioId"] for n in run("notificaciones:qaListarNotifs", {}) if n["clienteId"] == SOFIA})

def cycle():
    # admin puede sobre cualquier cliente; conserva ultimaInteraccion vieja de Sofía
    run("notificaciones:qaPurgarNotifs", {})
    run("clientes:cambiarEstado", {"token": TA, "clienteId": SOFIA, "estado": "activo"})
    run("seguimientos:reprogramar", {"token": TA, "seguimientoId": SEG, "fecha": int(time.time()*1000)-5*DIA})
    run("clientes:sincronizarInactividad", {"token": TA})

try:
    # T1 — defaults: operativo "cartera" (recibe), admin "ninguna" (no recibe)
    run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": CARLOS_ID})
    run("push:guardarPreferenciaFrio", {"token": TC, "pref": "cartera"})
    run("push:guardarPreferenciaFrio", {"token": TA, "pref": "ninguna"})
    cycle()
    d = destinatarios_sofia()
    ok(d == [CARLOS_ID], f"T1 defaults: solo el operativo (cartera); admin 'ninguna' no recibe ({len(d)})")

    # T2 — operativo "ninguna" → sin alerta
    run("push:guardarPreferenciaFrio", {"token": TC, "pref": "ninguna"})
    cycle()
    ok(destinatarios_sofia() == [], "T2: operativo 'ninguna' → no se encola para él")

    # T3 — admin "negocio" → recibe además del responsable
    run("push:guardarPreferenciaFrio", {"token": TC, "pref": "cartera"})
    run("push:guardarPreferenciaFrio", {"token": TA, "pref": "negocio"})
    cycle()
    d = destinatarios_sofia()
    ok(CARLOS_ID in d and MARTA_ID in d, f"T3: admin 'negocio' recibe además del responsable ({len(d)})")

    # T4 — admin "pool" + cliente en el pool → recibe; responsable no aplica
    run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": None})
    run("push:guardarPreferenciaFrio", {"token": TA, "pref": "pool"})
    cycle()
    d = destinatarios_sofia()
    ok(d == [MARTA_ID], f"T4: cliente en pool + admin 'pool' → solo el admin ({d==[MARTA_ID]})")

    # T4b — admin "pool" pero cliente CON responsable → admin no recibe
    run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": CARLOS_ID})
    cycle()
    ok(MARTA_ID not in destinatarios_sofia(), "T4b: admin 'pool' NO recibe si el cliente tiene responsable")
except Exception as e:
    ok(False, f"excepción: {str(e)[:200]}")
finally:
    # restaurar defaults + Sofía a Carlos + recordatorio + purgar
    try: run("push:guardarPreferenciaFrio", {"token": TC, "pref": "cartera"})
    except Exception: pass
    try: run("push:guardarPreferenciaFrio", {"token": TA, "pref": "ninguna"})
    except Exception: pass
    try: run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": CARLOS_ID})
    except Exception: pass
    try: run("seguimientos:reprogramar", {"token": TA, "seguimientoId": SEG, "fecha": 1784350182771})
    except Exception: pass
    try: run("notificaciones:qaPurgarNotifs", {})
    except Exception: pass
    for t in (TA, TC):
        try: run("auth:cerrarSesion", {"token": t})
        except Exception: pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-35 B-2 preferencias de alerta de cliente frío (JUA-33)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "helpers QA (dev); prefs y datos restaurados; sin secretos.", "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
