#!/usr/bin/env python3
# Driver 39 — JUA-41 recorrido en PRODUCCIÓN con negocio QA revocable (condición 4).
# crear -> reemitir -> cambiar correo -> cancelarNegocioVacio (deja prod sin residuo).
# NO imprime tokens/enlaces (OBS-3): solo estados y emails de prueba (@test.mx).
import subprocess, json, sys, time
REPO = "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM"
TS = int(time.time())
E1 = f"qa-alta-prod-{TS}@test.mx"; E2 = f"qa-alta-prod2-{TS}@test.mx"

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a), "--prod"], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-300:])
    s = o.stdout.strip(); return json.loads(s) if s else None

res, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); res.append(l)
    if not c: fallos.append(m)
def estado(tok): return run("invitaciones:porToken", {"token": tok})["estado"]
def fila(nid): return next((n for n in run("negocios:listarNegocios", {}) if n["negocioId"] == nid), None)

nid = None
try:
    r = run("negocios:crearNegocio", {"nombre": "QA Alta Prod", "emailAdmin": E1}); nid = r["negocioId"]; t1 = r["token"]
    ok(bool(t1) and fila(nid) and fila(nid)["admin"] == "pendiente", "crearNegocio en prod → negocio + admin pendiente")

    r2 = run("negocios:reemitirAdminInicial", {"negocioId": nid}); t2 = r2["token"]
    ok(estado(t1) == "expirada" and estado(t2) == "pendiente", "reemitir invalida el token viejo; nuevo pendiente")

    r3 = run("negocios:reemitirAdminInicial", {"negocioId": nid, "emailAdmin": E2}); t3 = r3["token"]
    ok(fila(nid)["emailAdmin"] == E2 and estado(t3) == "pendiente" and estado(t2) == "expirada",
       "cambia el correo del admin; invitación nueva para el correo nuevo")

    run("negocios:cancelarNegocioVacio", {"negocioId": nid})
    ok(fila(nid) is None, "cancelarNegocioVacio deja prod SIN residuo")
    nid = None
except Exception as e:
    ok(False, f"excepción: {str(e)[:300]}")
finally:
    if nid:
        try:
            run("negocios:cancelarNegocioVacio", {"negocioId": nid}); print("limpieza: negocio cancelado")
        except Exception as e:
            print(f"OJO — limpieza falló, revisar prod: {e}")

# doble verificación: no queda ningún negocio de esta corrida
try:
    rest = [n for n in run("negocios:listarNegocios", {}) if str(TS) in n["emailAdmin"]]
    ok(len(rest) == 0, "sin negocios QA residuales de esta corrida")
except Exception:
    pass

n_pass = sum(1 for r in res if r.startswith("PASS"))
print(f"\n{n_pass} PASS / {len(fallos)} FAIL")
sys.exit(1 if fallos else 0)
