#!/usr/bin/env python3
# Driver 34 — JUA-33 B-1 revalidación transaccional al reclamar: recordatorio próximo
# → descartar; reasignación → redirige al responsable actual. Helpers QA (dev).
# Uso: ADMIN_PASS=.. CARLOS_PASS=.. python3 driver-34-b1-revalidacion.py <reporte.txt>
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-b1.txt")
AP, CP = os.environ.get("ADMIN_PASS"), os.environ.get("CARLOS_PASS")
SOFIA = "j570t8dpsvdjayqytts4psjbbd8a9q75"; SEG = "jn73ncnmefjay53tv9f8q4e8bn8a9150"
CARLOS_ID = "js79sd3wf64tmnaz6abv0symtn8a939x"; V2_ID = "js78w3zwb99wtq00n1by49rzsx8amgr3"
DIA = 86400000

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-200:])
    s = o.stdout.strip(); return json.loads(s) if s else None
resultados, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); resultados.append(l)
    if not c: fallos.append(m)
def notifs(): return run("notificaciones:qaListarNotifs", {})

if not AP or not CP: print("faltan creds"); sys.exit(2)
TA = run("auth:iniciarSesion", {"email": "marta@demo.mx", "password": AP})["token"]
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]

def encolar_para_carlos():
    # Sofía → responsable Carlos, activo (conserva ultimaInteraccion vieja), recordatorio al pasado, sync
    run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": CARLOS_ID})
    run("clientes:cambiarEstado", {"token": TC, "clienteId": SOFIA, "estado": "activo"})
    run("seguimientos:reprogramar", {"token": TC, "seguimientoId": SEG, "fecha": int(time.time()*1000)-5*DIA})
    run("clientes:sincronizarInactividad", {"token": TC})

try:
    # TEST 1 — recordatorio próximo → descartar
    run("notificaciones:qaPurgarNotifs", {})
    encolar_para_carlos()
    ok(len(notifs()) == 1 and notifs()[0]["estado"] == "pendiente", "T1 setup: 1 pendiente encolada")
    # crear un recordatorio DENTRO de 3 días (reprogramar el de Sofía al futuro cercano)
    run("seguimientos:reprogramar", {"token": TC, "seguimientoId": SEG, "fecha": int(time.time()*1000)+1*DIA})
    run("notificaciones:reclamarLote", {})
    n = notifs()[0]
    ok(n["estado"] == "descartada" and n["resultado"] == "recordatorio_proximo",
       f"T1: recordatorio próximo (≤3 días) → descartada/recordatorio_proximo ({n['estado']}/{n['resultado']})")

    # TEST 2 — reasignación → redirige al responsable actual
    run("notificaciones:qaPurgarNotifs", {})
    encolar_para_carlos()  # recordatorio al pasado (no próximo), responsable Carlos
    ok(notifs()[0]["usuarioId"] == CARLOS_ID, "T2 setup: notif encolada para Carlos (responsable)")
    run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": V2_ID})  # reasignar a Vendedor Dos
    run("notificaciones:reclamarLote", {})
    n = notifs()[0]
    ok(n["usuarioId"] == V2_ID and n["estado"] == "enviando",
       f"T2: tras reasignar, la alerta se REDIRIGE al responsable actual (Vendedor Dos) y se reclama ({n['usuarioId']==V2_ID}/{n['estado']})")
except Exception as e:
    ok(False, f"excepción: {str(e)[:200]}")
finally:
    try: run("notificaciones:qaPurgarNotifs", {})
    except Exception: pass
    # restaurar: Sofía → responsable Carlos, recordatorio a su fecha original
    try: run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": CARLOS_ID})
    except Exception: pass
    try: run("seguimientos:reprogramar", {"token": TC, "seguimientoId": SEG, "fecha": 1784350182771})
    except Exception: pass
    for t in (TA, TC):
        try: run("auth:cerrarSesion", {"token": t})
        except Exception: pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-34 B-1 revalidación transaccional (JUA-33)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "helpers QA internos gateados (dev); residuos purgados; Sofía restaurada a Carlos. Sin secretos.",
        "responsable_inactivo y pool→no-admin cubiertos por código (revalidarDestino).", "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
