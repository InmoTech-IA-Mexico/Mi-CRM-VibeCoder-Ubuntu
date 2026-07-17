#!/usr/bin/env python3
# Driver 37 — JUA-41: alta automatizada de negocio (negocios.crearNegocio + listarNegocios)
# + activación real del admin (flujo JUA-8) + guards + limpieza. Corre contra dev.
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-jua41.txt")
BASE = "https://ejemplo.test"
EMAIL = f"qa-negocio-{int(time.time())}@test.mx"

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

negocioId = None; sesion = None
try:
    # T1 — crearNegocio válido: negocio + invitación admin + enlace
    r = run("negocios:crearNegocio", {"nombre": "Inmobiliaria QA", "emailAdmin": EMAIL, "baseUrl": BASE})
    negocioId = r["negocioId"]; token = r["token"]
    ok(bool(token) and r["enlaceActivacion"] == f"{BASE}/activar?token={token}" and r["emailAdmin"] == EMAIL,
       "T1: crea negocio + invitación admin + enlace de activación")

    # T1b — porToken ve la invitación pendiente del admin
    pt = run("invitaciones:porToken", {"token": token})
    ok(pt["estado"] == "pendiente" and pt["rol"] == "admin" and pt["requiereZona"] is True and pt["email"] == EMAIL,
       f"T1b: porToken → pendiente/admin/requiereZona ({pt['estado']})")

    # T2 — listarNegocios incluye el nuevo con admin 'pendiente'
    fila = next((n for n in run("negocios:listarNegocios", {}) if n["negocioId"] == negocioId), None)
    ok(bool(fila) and fila["admin"] == "pendiente" and fila["emailAdmin"] == EMAIL and fila["estado"] == "activo",
       "T2: aparece en el listado con admin 'pendiente'")

    # T3 — guards (deben FALLAR)
    ok(run_fail("negocios:crearNegocio", {"nombre": "Otro", "emailAdmin": EMAIL}), "T3a: rechaza emailAdmin duplicado")
    ok(run_fail("negocios:crearNegocio", {"nombre": "Otro", "emailAdmin": "marta@demo.mx"}), "T3b: rechaza email de usuario existente")
    ok(run_fail("negocios:crearNegocio", {"nombre": "Otro", "emailAdmin": "no-es-email"}), "T3c: rechaza email inválido")
    ok(run_fail("negocios:crearNegocio", {"nombre": "   ", "emailAdmin": "qa-vacio@test.mx"}), "T3d: rechaza nombre vacío")

    # T4 — activación real del admin (fija contraseña + zona + nombre)
    act = run("invitaciones:activar", {"token": token, "password": "claveSegura8",
                                       "zonaHoraria": "America/Monterrey", "negocioNombre": "Inmobiliaria QA MTY"})
    sesion = act["token"]
    f2 = next((n for n in run("negocios:listarNegocios", {}) if n["negocioId"] == negocioId), None)
    ok(bool(sesion) and f2 and f2["admin"] == "activo" and f2["usuarios"] == 1
       and f2["zonaHoraria"] == "America/Monterrey" and f2["nombre"] == "Inmobiliaria QA MTY",
       "T4: activar crea el admin y fija zona/nombre; listado → admin 'activo'")

    # T5 — tras activar, el email ya es de un usuario → rechazo
    ok(run_fail("negocios:crearNegocio", {"nombre": "Otro", "emailAdmin": EMAIL}), "T5: tras activar, rechaza el email (ya hay cuenta)")
except Exception as e:
    ok(False, f"excepción: {str(e)[:300]}")
finally:
    try:
        if sesion: run("auth:cerrarSesion", {"token": sesion})
    except Exception: pass
    try:
        if negocioId:
            d = run("negocios:qaBorrarNegocio", {"negocioId": negocioId}); print(f"limpieza: {d}")
    except Exception as e:
        print(f"limpieza falló: {e}")

try:
    quedan = [n for n in run("negocios:listarNegocios", {}) if n.get("negocioId") == negocioId]
    ok(len(quedan) == 0, "limpieza: el negocio de prueba fue borrado")
except Exception:
    pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-37 JUA-41 alta automatizada de negocio (Opción B, CLI)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "helpers QA (dev); negocio de prueba borrado; sin secretos.", "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
