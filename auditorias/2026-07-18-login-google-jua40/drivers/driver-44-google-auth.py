#!/usr/bin/env python3
# Driver 44 — JUA-40: núcleo del OAuth de Google con el modelo de NONCE CONSUMIDO (sin
# emisión pública). Prueba las internas (login/vínculo por googleSub + anti-replay) con
# `sub` SIMULADO (la verificación del ID token es de la action, se prueba en vivo).
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-jua40.txt")
CARLOS = "js79sd3wf64tmnaz6abv0symtn8a939x"; MARTA = "js75cv777hf0tj8khrcx0rwx9x8a8jhb"
CP = os.environ.get("CARLOS_PASS")  # opcional: habilita la prueba de desvincular (sesión real)
TS = int(time.time()); SUB_A = f"qa-sub-{TS}-A"; SUB_B = f"qa-sub-{TS}-B"
FUT = int(time.time() * 1000) + 3600_000  # expiraEn de un token válido (1 h)

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-300:])
    s = o.stdout.strip(); return json.loads(s) if s else None
res, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); res.append(l)
    if not c: fallos.append(m)
def N(i): return f"qa-n-{TS}-{i}"
def clog(nonce, sub): return run("google:consumirNonceLoginGoogle", {"nonce": nonce, "sub": sub, "expiraEn": FUT})
def cvin(nonce, uid, sub): return run("google:consumirNonceVincular", {"nonce": nonce, "usuarioId": uid, "sub": sub, "expiraEn": FUT})

# estado limpio
for uid in (CARLOS, MARTA):
    run("google:qaLimpiarGoogle", {"usuarioId": uid})
run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS, "estado": "activo"})
extra = []
try:
    # T1 — vincular (la action ya validó la sesión) fija googleSub
    ok(cvin(N(1), CARLOS, SUB_A)["ok"] is True, "T1: vincular fija googleSub")

    # T2 — el mismo sub no puede vincularse a otro usuario
    ok(cvin(N(2), MARTA, SUB_A)["ok"] is False, "T2: rechaza vincular un sub que ya es de otro")

    # T3 — login por googleSub → sesión del usuario correcto
    r = clog(N(3), SUB_A)
    s = run("auth:sesionActual", {"token": r["token"]}) if r.get("token") else None
    if r.get("token"): extra.append(r["token"])
    ok(r["ok"] is True and s and s["usuario"]["_id"] == CARLOS, "T3: login por googleSub → sesión del usuario vinculado")

    # T4 — login con sub sin vínculo → rechazado
    ok(clog(N(4), "qa-sub-inexistente")["ok"] is False, "T4: login con sub sin vínculo → rechazado")

    # T5 — login con usuario inactivo → rechazado
    run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS, "estado": "inactivo"})
    ok(clog(N(5), SUB_A)["ok"] is False, "T5: login con usuario inactivo → rechazado")
    run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS, "estado": "activo"})

    # T6 — replay: un nonce solo sirve una vez
    n = N(6); r1 = clog(n, SUB_A); r2 = clog(n, SUB_A)
    if r1.get("token"): extra.append(r1["token"])
    ok(r1["ok"] is True and r2["ok"] is False, "T6: replay del mismo nonce → rechazado")

    # T7 — nonce consumido por login no vale para vincular (cross-operación por la tabla de consumidos)
    n = N(7); r1 = clog(n, SUB_A)
    if r1.get("token"): extra.append(r1["token"])
    ok(r1["ok"] is True and cvin(n, CARLOS, SUB_A)["ok"] is False, "T7: un nonce consumido por login no sirve para vincular")

    # T8 — la purga elimina nonces consumidos ya expirados
    n = N(8); clog(n, SUB_A); run("google:qaExpirarNonce", {"nonce": n})
    ok(run("google:purgarNoncesExpirados", {})["purgados"] >= 1, "T8: la purga elimina nonces consumidos expirados")

    # T9 — sin ruta de emisión pública de nonces (el DoS de emisión anónima ya no existe)
    faltan = subprocess.run(["npx", "convex", "run", "google:emitirNonceLogin", "{}"], cwd=REPO, capture_output=True, text=True)
    ok(faltan.returncode != 0, "T9: no existe una mutación pública de emisión de nonce (emitirNonceLogin)")

    # T10 — desvincular (obs. OBS-2): con sesión válida (y contraseña) quita el googleSub
    if CP:
        TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]; extra.append(TC)
        cvin(N(10), CARLOS, SUB_A)  # asegura vínculo
        antes = run("google:estadoVinculo", {"token": TC})["vinculado"]
        run("google:desvincularGoogle", {"token": TC})
        despues = run("google:estadoVinculo", {"token": TC})["vinculado"]
        ok(antes is True and despues is False, "T10: desvincular (con contraseña) quita el vínculo")
    else:
        ok(True, "T10: desvincular — omitido (sin CARLOS_PASS)")
except Exception as e:
    ok(False, f"excepción: {str(e)[:300]}")
finally:
    for uid in (CARLOS, MARTA):
        try: run("google:qaLimpiarGoogle", {"usuarioId": uid})
        except Exception: pass
    try: run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS, "estado": "activo"})
    except Exception: pass
    for t in extra:
        try: run("auth:cerrarSesion", {"token": t})
        except Exception: pass

n_pass = sum(1 for r in res if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-44 JUA-40 OAuth Google — modelo de nonce consumido (anti-replay sin emisión pública)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "sub simulados de dev; vínculos limpiados; sin tokens/sub/email reales.", "", *res,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
