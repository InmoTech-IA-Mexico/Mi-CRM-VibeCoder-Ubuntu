#!/usr/bin/env python3
# Driver 42 — JUA-128: reclamarLote usa el índice por_estado_intento. Verifica que
# el rango (proximoIntento<=ahora) EXCLUYE los futuros e INCLUYE los pasados. Dev.
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-jua128.txt")
AP = os.environ.get("ADMIN_PASS")
SOFIA = "j570t8dpsvdjayqytts4psjbbd8a9q75"; SEG = "jn73ncnmefjay53tv9f8q4e8bn8a9150"; DIA = 86400000

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-300:])
    s = o.stdout.strip(); return json.loads(s) if s else None
res, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); res.append(l)
    if not c: fallos.append(m)
def notif_sofia():
    return next((n for n in run("notificaciones:qaListarNotifs", {}) if n["clienteId"] == SOFIA), None)
def reclama_sofia():
    return any(x["clienteId"] == SOFIA for x in (run("notificaciones:reclamarLote", {}) or []))

if not AP: print("falta ADMIN_PASS"); sys.exit(2)
TA = run("auth:iniciarSesion", {"email": "marta@demo.mx", "password": AP})["token"]
def cycle():
    run("notificaciones:qaPurgarNotifs", {})
    run("clientes:cambiarEstado", {"token": TA, "clienteId": SOFIA, "estado": "activo"})
    run("seguimientos:reprogramar", {"token": TA, "seguimientoId": SEG, "fecha": int(time.time()*1000) - 5*DIA})
    run("clientes:sincronizarInactividad", {"token": TA})

try:
    cycle()
    n = notif_sofia()
    ok(n is not None and n["estado"] == "pendiente", "setup: notif de Sofía encolada (pendiente)")
    nid = n["id"]; ahora = int(time.time()*1000)

    # T1 — proximoIntento FUTURO → el rango del índice lo EXCLUYE (no se reclama)
    run("notificaciones:qaAjustarNotif", {"id": nid, "proximoIntento": ahora + 3600_000})
    reclamado_futuro = reclama_sofia()
    ok(reclamado_futuro is False and notif_sofia()["estado"] == "pendiente",
       "T1: proximoIntento futuro → excluido del reclamo (sigue pendiente)")

    # T2 — proximoIntento PASADO → el rango lo INCLUYE (se reclama; hora 9-20)
    run("notificaciones:qaAjustarNotif", {"id": nid, "estado": "pendiente", "proximoIntento": ahora - 5000})
    reclamado_pasado = reclama_sofia()
    ok(reclamado_pasado is True and notif_sofia()["estado"] == "enviando",
       "T2: proximoIntento pasado → incluido en el reclamo (pasa a enviando)")
except Exception as e:
    ok(False, f"excepción: {str(e)[:300]}")
finally:
    try: run("seguimientos:reprogramar", {"token": TA, "seguimientoId": SEG, "fecha": 1784350182771})
    except Exception: pass
    try: run("clientes:cambiarEstado", {"token": TA, "clienteId": SOFIA, "estado": "activo"})
    except Exception: pass
    try: run("notificaciones:qaPurgarNotifs", {})
    except Exception: pass
    try: run("auth:cerrarSesion", {"token": TA})
    except Exception: pass

n_pass = sum(1 for r in res if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-42 JUA-128 índice por_estado_intento (rango proximoIntento)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "helpers QA (dev); datos restaurados; sin secretos.", "", *res,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
