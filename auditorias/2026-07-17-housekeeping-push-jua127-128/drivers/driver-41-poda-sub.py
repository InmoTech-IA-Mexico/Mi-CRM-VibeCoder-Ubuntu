#!/usr/bin/env python3
# Driver 41 — JUA-127: clasificación del fallo de envío por CÓDIGO (push.procesarFalloEnvio,
# lo que llama el emisor). 404/410→caducada(borra); sin código→red (poda al 3º); otra
# respuesta HTTP (429/5xx/401/403)→http (NO poda, reinicia racha). + reinicios. Dev.
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-jua127.txt")
CP = os.environ.get("CARLOS_PASS")
CARLOS = "js79sd3wf64tmnaz6abv0symtn8a939x"; TS = int(time.time())
P256 = "BQAfakeP256dhKey_-QAJUA127test"; AUTH = "fakeAuthKey_-JUA127"

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-300:])
    s = o.stdout.strip(); return json.loads(s) if s else None
res, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); res.append(l)
    if not c: fallos.append(m)

endpoints = []
def mk():
    ep = f"https://fcm.googleapis.com/fcm/send/qa-jua127-{TS}-{len(endpoints)}"
    sid = run("push:guardarSubscription", {"token": TC, "endpoint": ep, "p256dh": P256, "auth": AUTH})
    endpoints.append(ep); return sid, ep
def proc(sid, code=None, p256=P256):
    a = {"id": sid, "usuarioId": CARLOS, "p256dh": p256}
    if code is not None: a["statusCode"] = code
    return run("push:procesarFalloEnvio", a)["resultado"]
def fde(sid):
    s = next((x for x in run("push:subsDeUsuario", {"usuarioId": CARLOS}) if x["id"] == sid), None)
    return s["fallosRed"] if s else None  # None = borrada

if not CP: print("falta CARLOS_PASS"); sys.exit(2)
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]
try:
    # T1 — 404 → caducada (borra); 410 idem
    s, _ = mk(); ok(proc(s, 404) == "caducada" and fde(s) is None, "T1: 404 → caducada (borra la sub)")
    s, _ = mk(); ok(proc(s, 410) == "caducada" and fde(s) is None, "T1b: 410 → caducada (borra la sub)")

    # T2 — sin código (red) → cuenta y poda al 3º
    s, _ = mk()
    r1, f1 = proc(s), fde(s); r2, f2 = proc(s), fde(s)
    r3 = proc(s)
    ok(r1 == "red" and f1 == 1 and r2 == "red" and f2 == 2 and r3 == "podada" and fde(s) is None,
       "T2: sin código HTTP → red (1,2) y poda al 3º")

    # T3 — otras respuestas HTTP NO podan ni incrementan (429/500/503/401/403)
    s, _ = mk()
    http_ok = all(proc(s, c) == "http" for c in (429, 500, 503, 401, 403)) and fde(s) == 0
    ok(http_ok, "T3: 429/5xx/401/403 → http (no poda, no incrementa) — evita poda por config VAPID")

    # T4 — una respuesta HTTP REINICIA la racha de fallos de red ("consecutivos" literal)
    s, _ = mk()
    proc(s); proc(s)             # red → f=2
    proc(s, 500)                 # http → reinicia
    a1 = fde(s) == 0
    proc(s); b = fde(s)          # red → f=1 (no 3)
    ok(a1 and b == 1, "T4: una respuesta HTTP reinicia la racha de red (no se acumula a través de un 5xx)")

    # T5 — éxito reinicia el contador (resetFalloRed, lo llama el emisor al entregar)
    s, _ = mk(); proc(s); proc(s)
    run("push:resetFalloRed", {"id": s, "usuarioId": CARLOS, "p256dh": P256})
    ok(fde(s) == 0, "T5: un envío con éxito reinicia el contador de red")

    # T6 — guard: p256dh distinto no actúa
    s, _ = mk()
    ok(proc(s, code=None, p256="OTRA_clave") == "http" and fde(s) == 0, "T6: p256dh no coincidente → no actúa (no incrementa ni borra)")

    # T7 — OBS-1: re-suscribir el mismo endpoint reinicia fallosRed
    s, ep = mk(); proc(s); proc(s)
    s2 = run("push:guardarSubscription", {"token": TC, "endpoint": ep, "p256dh": P256, "auth": AUTH})
    ok(s2 == s and fde(s) == 0, "T7 (OBS-1): re-suscribir el mismo endpoint reinicia fallosRed a 0")
except Exception as e:
    ok(False, f"excepción: {str(e)[:300]}")
finally:
    for ep in endpoints:
        try: run("push:borrarSubscription", {"token": TC, "endpoint": ep})
        except Exception: pass
    try: run("auth:cerrarSesion", {"token": TC})
    except Exception: pass

n_pass = sum(1 for r in res if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-41 JUA-127 clasificación del fallo de envío por código (procesarFalloEnvio)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "subs fake de dev, limpiadas; sin secretos.", "", *res,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
