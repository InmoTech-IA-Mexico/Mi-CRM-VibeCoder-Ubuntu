#!/usr/bin/env python3
# Driver 38 — JUA-41 remediación B-1: recuperación del alta inicial sin tocar la BD
# (reemitirAdminInicial + cancelarNegocioVacio) + validadores OBS-1. Corre contra dev.
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-jua41-b1.txt")
BASE = "https://ejemplo.test"
TS = int(time.time())
A = f"qa-neg-a-{TS}@test.mx"; B = f"qa-neg-b-{TS}@test.mx"
C = f"qa-neg-c-{TS}@test.mx"; D = f"qa-neg-d-{TS}@test.mx"; E = f"qa-neg-e-{TS}@test.mx"

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-300:])
    s = o.stdout.strip(); return json.loads(s) if s else None

def run_fail(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    return o.returncode != 0

resultados, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); resultados.append(l)
    if not c: fallos.append(m)

def estado_token(tok): return run("invitaciones:porToken", {"token": tok})["estado"]
def fila(nid): return next((n for n in run("negocios:listarNegocios", {}) if n["negocioId"] == nid), None)

neg1 = neg2 = None
try:
    # --- R1: reemisión tras invitación pendiente (invalida la vieja, sin paralelas) ---
    r = run("negocios:crearNegocio", {"nombre": "Neg1", "emailAdmin": A, "baseUrl": BASE}); neg1 = r["negocioId"]; t1 = r["token"]
    r2 = run("negocios:reemitirAdminInicial", {"negocioId": neg1, "baseUrl": BASE}); t2 = r2["token"]
    ok(estado_token(t1) == "expirada" and estado_token(t2) == "pendiente" and t2 != t1,
       "R1: reemitir invalida el token viejo y deja uno nuevo pendiente")

    # --- R2: corrección de correo del admin inicial ---
    r3 = run("negocios:reemitirAdminInicial", {"negocioId": neg1, "emailAdmin": B, "baseUrl": BASE}); t3 = r3["token"]
    f1 = fila(neg1); pt3 = run("invitaciones:porToken", {"token": t3})
    ok(f1 and f1["emailAdmin"] == B and pt3["email"] == B and estado_token(t2) == "expirada" and pt3["estado"] == "pendiente",
       "R2: corrige el email del admin; invitación nueva para el correo nuevo, la anterior invalidada")

    # --- R3: con admin ACTIVO ya no se reemite ---
    run("invitaciones:activar", {"token": t3, "password": "claveSegura8", "zonaHoraria": "America/Monterrey", "negocioNombre": "Neg1 MTY"})
    ok(run_fail("negocios:reemitirAdminInicial", {"negocioId": neg1}), "R3: rechaza reemitir si el negocio ya tiene admin activo")

    # --- R4: reemisión revalida unicidad global (email tomado → rechazo; email libre → recupera) ---
    rc = run("negocios:crearNegocio", {"nombre": "Neg2", "emailAdmin": C, "baseUrl": BASE}); neg2 = rc["negocioId"]
    ok(run_fail("negocios:reemitirAdminInicial", {"negocioId": neg2, "emailAdmin": "marta@demo.mx"}),
       "R4a: reemitir rechaza un email ya tomado por otra cuenta")
    rd = run("negocios:reemitirAdminInicial", {"negocioId": neg2, "emailAdmin": D})
    ok(fila(neg2)["emailAdmin"] == D and estado_token(rd["token"]) == "pendiente",
       "R4b: reemitir con un email libre recupera el alta (correo corregido)")

    # --- R5: cancelación segura de un negocio vacío; nunca de uno con datos ---
    re = run("negocios:crearNegocio", {"nombre": "Neg3", "emailAdmin": E, "baseUrl": BASE}); neg3 = re["negocioId"]
    run("negocios:cancelarNegocioVacio", {"negocioId": neg3})
    ok(fila(neg3) is None, "R5a: cancelarNegocioVacio borra un negocio sin usuarios/clientes")
    ok(run_fail("negocios:cancelarNegocioVacio", {"negocioId": neg1}), "R5b: rechaza cancelar un negocio con usuarios")

    # --- OBS-1: validación de zona IANA y baseUrl https ---
    ok(run_fail("negocios:crearNegocio", {"nombre": "X", "emailAdmin": f"qa-z-{TS}@test.mx", "zonaHoraria": "Zona/Inexistente"}),
       "OBS-1a: rechaza zona horaria IANA inválida")
    ok(run_fail("negocios:crearNegocio", {"nombre": "X", "emailAdmin": f"qa-u-{TS}@test.mx", "baseUrl": "http://inseguro.test"}),
       "OBS-1b: rechaza baseUrl no https")
except Exception as ex:
    ok(False, f"excepción: {str(ex)[:300]}")
finally:
    for nid in (neg1, neg2):
        try:
            if nid: run("negocios:qaBorrarNegocio", {"negocioId": nid})
        except Exception as ex:
            print(f"limpieza {nid} falló: {ex}")

# verificación de limpieza
try:
    restantes = [n for n in run("negocios:listarNegocios", {}) if n["emailAdmin"].startswith("qa-neg-") and str(TS) in n["emailAdmin"]]
    ok(len(restantes) == 0, "limpieza: sin negocios de prueba residuales")
except Exception:
    pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-38 JUA-41 remediación B-1 (recuperación del alta inicial) + OBS-1",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "helpers QA (dev); negocios de prueba borrados; sin secretos.", "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
