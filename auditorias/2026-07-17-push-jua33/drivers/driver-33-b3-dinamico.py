#!/usr/bin/env python3
# Driver 33 — JUA-33 B-3 cobertura dinámica (condición #2 del auditor): P-1 caducada,
# recuperación de lease, 3er fallo terminal, idempotencia. Usa helpers QA internos
# (gateados por env QA_HELPERS=1, inertes en prod). Limpia al final.
# Uso: ADMIN_PASS=.. CARLOS_PASS=.. python3 driver-33-b3-dinamico.py <reporte.txt>
import subprocess, json, sys, os, time, secrets
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-b3-dinamico.txt")
AP, CP = os.environ.get("ADMIN_PASS"), os.environ.get("CARLOS_PASS")
SOFIA = "j570t8dpsvdjayqytts4psjbbd8a9q75"; SEG = "jn73ncnmefjay53tv9f8q4e8bn8a9150"

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-200:])
    s = o.stdout.strip(); return json.loads(s) if s else None

resultados, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); resultados.append(l)
    if not c: fallos.append(m)
def notifs(): return run("notificaciones:qaListarNotifs", {})
def una(): return notifs()[0]

if not AP or not CP: print("faltan ADMIN_PASS/CARLOS_PASS"); sys.exit(2)
TA = run("auth:iniciarSesion", {"email": "marta@demo.mx", "password": AP})["token"]
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]
try:
    run("notificaciones:qaPurgarNotifs", {})
    # Encolar 1: reciclar Sofía (activo conserva ultimaInteraccion vieja) + recordatorio al pasado
    run("clientes:cambiarEstado", {"token": TC, "clienteId": SOFIA, "estado": "activo"})
    run("seguimientos:reprogramar", {"token": TC, "seguimientoId": SEG, "fecha": int(time.time()*1000)-5*86400000})
    run("clientes:sincronizarInactividad", {"token": TC})
    ns = notifs(); ok(len(ns) == 1 and ns[0]["estado"] == "pendiente", f"setup: 1 notif pendiente encolada ({len(ns)})")
    nid = ns[0]["id"]

    # P-1: registrarResultado con SOLO caducadas (404/410) → resultado "suscripcion_caducada", NO "entregada".
    # (Se prueba la lógica corregida directamente: un endpoint real no produce 404 de forma fiable.)
    run("notificaciones:qaAjustarNotif", {"id": nid, "estado": "enviando", "intentos": 1})
    run("notificaciones:registrarResultado", {"id": nid, "intentos": 1, "enviadas": 0, "caducadas": 1, "fallidas": 0})
    n = una()
    ok(n["estado"] == "enviada" and n["resultado"] == "suscripcion_caducada",
       f"P-1: todo caducado (404/410) → 'suscripcion_caducada', NO 'entregada' ({n['estado']}/{n['resultado']})")
    # complemento: entrega real → "entregada"; sin dispositivos → "sin_dispositivos"
    run("notificaciones:qaAjustarNotif", {"id": nid, "estado": "enviando", "intentos": 1})
    run("notificaciones:registrarResultado", {"id": nid, "intentos": 1, "enviadas": 1, "caducadas": 0, "fallidas": 0})
    ok(una()["resultado"] == "entregada", "complemento: enviadas>0 → 'entregada'")
    run("notificaciones:qaAjustarNotif", {"id": nid, "estado": "enviando", "intentos": 1})
    run("notificaciones:registrarResultado", {"id": nid, "intentos": 1, "enviadas": 0, "caducadas": 0, "fallidas": 0})
    ok(una()["resultado"] == "sin_dispositivos", "complemento: sin suscripciones → 'sin_dispositivos'")

    # Recuperación de lease: enviando con lease vencido + proximoIntento futuro → reclamarLote la devuelve a pendiente
    run("notificaciones:qaAjustarNotif", {"id": nid, "estado": "enviando", "leaseHasta": 0, "proximoIntento": int(time.time()*1000)+3600000})
    run("notificaciones:reclamarLote", {})
    ok(una()["estado"] == "pendiente", "recuperación: enviando con lease vencido → vuelve a pendiente")

    # 3er fallo terminal: enviando intentos=3 + registrarResultado con fallo → descartada (fallo_persistente)
    run("notificaciones:qaAjustarNotif", {"id": nid, "estado": "enviando", "intentos": 3, "leaseHasta": int(time.time()*1000)+300000})
    run("notificaciones:registrarResultado", {"id": nid, "intentos": 3, "enviadas": 0, "caducadas": 0, "fallidas": 1})
    n = una(); ok(n["estado"] == "descartada" and n["resultado"] == "fallo_persistente",
                  f"3er fallo: intentos=MAX + fallo → descartada/fallo_persistente ({n['estado']}/{n['resultado']})")

    # Idempotencia: enviando intentos=2 + registrarResultado con intento VIEJO (1) → no-op
    run("notificaciones:qaAjustarNotif", {"id": nid, "estado": "enviando", "intentos": 2})
    run("notificaciones:registrarResultado", {"id": nid, "intentos": 1, "enviadas": 0, "caducadas": 0, "fallidas": 1})
    n = una(); ok(n["estado"] == "enviando" and n["intentos"] == 2,
                  f"idempotencia: resultado de un intento viejo → no-op (sigue enviando, intentos=2): {n['estado']}/{n['intentos']}")
except Exception as e:
    ok(False, f"excepción: {str(e)[:200]}")
finally:
    # Limpieza de residuos QA: purgar notifs + restaurar recordatorio de Sofía
    try: print("purga final:", run("notificaciones:qaPurgarNotifs", {}))
    except Exception: pass
    try: run("seguimientos:reprogramar", {"token": TC, "seguimientoId": SEG, "fecha": 1784350182771})
    except Exception: pass
    for t in (TA, TC):
        try: run("auth:cerrarSesion", {"token": t})
        except Exception: pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-33 B-3 cobertura dinámica (JUA-33, obs. P-1 + condición #2)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "helpers QA internos gateados por env (inertes en prod); residuos purgados; sin secretos.", "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
