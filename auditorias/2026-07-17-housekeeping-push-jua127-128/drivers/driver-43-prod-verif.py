#!/usr/bin/env python3
# Verificación en vivo en PROD (JUA-127): un error HTTP (500) NO poda ni incrementa;
# 3 errores sin código SÍ podan. Sub QA revocable sobre Carlos; sin exponer endpoints.
import subprocess, json, sys, os, time
REPO = "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM"
CP = os.environ.get("CARLOS_PROD_PASS")
TS = int(time.time())
ENDPOINT = f"https://fcm.googleapis.com/fcm/send/qa-verif-{TS}"  # no se imprime
P256 = "BQAverifP256_-JUA127prod"; AUTH = "verifAuth_-JUA127"

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a), "--prod"], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-300:])
    s = o.stdout.strip(); return json.loads(s) if s else None
res, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); res.append(l)
    if not c: fallos.append(m)

if not CP: print("falta CARLOS_PROD_PASS"); sys.exit(2)
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]
CARLOS = run("auth:sesionActual", {"token": TC})["usuario"]["_id"]
def fde(sid):
    s = next((x for x in run("push:subsDeUsuario", {"usuarioId": CARLOS}) if x["id"] == sid), None)
    return s["fallosRed"] if s else None
def proc(sid, code=None):
    a = {"id": sid, "usuarioId": CARLOS, "p256dh": P256}
    if code is not None: a["statusCode"] = code
    return run("push:procesarFalloEnvio", a)["resultado"]

sid = None
try:
    sid = run("push:guardarSubscription", {"token": TC, "endpoint": ENDPOINT, "p256dh": P256, "auth": AUTH})
    # HTTP 500 → no poda, no incrementa
    r = proc(sid, 500)
    ok(r == "http" and fde(sid) == 0, "prod: HTTP 500 → no poda ni incrementa (fallosRed=0)")
    # 3 errores sin código → poda
    a, b = proc(sid), proc(sid)
    c = proc(sid)
    ok(a == "red" and b == "red" and c == "podada" and fde(sid) is None,
       "prod: 3 errores sin código HTTP → poda la sub muerta")
    sid = None
except Exception as e:
    ok(False, f"excepción: {str(e)[:300]}")
finally:
    if sid is not None:
        try: run("push:borrarSubscription", {"token": TC, "endpoint": ENDPOINT})
        except Exception as e: print(f"OJO limpieza: {e}")
    try: run("auth:cerrarSesion", {"token": TC})
    except Exception: pass

n_pass = sum(1 for r in res if r.startswith("PASS"))
print(f"\n{n_pass} PASS / {len(fallos)} FAIL")
sys.exit(1 if fallos else 0)
