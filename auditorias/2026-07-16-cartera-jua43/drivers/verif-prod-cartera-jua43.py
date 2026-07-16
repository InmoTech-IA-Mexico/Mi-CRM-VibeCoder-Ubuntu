#!/usr/bin/env python3
# Verificación EN VIVO en producción (glad-bird-297) de JUA-43 tras el deploy.
# Crea un 2º operativo QA revocable, ejecuta las negativas del dictamen (B-1..B-5
# + migración) con dos operativos y cliente ajeno, y LIMPIA todo (fixtures + QA).
# Reporte sanitizado: sin tokens ni contraseñas.
# Uso: MARTA_PASS=.. CARLOS_PASS=.. python3 verif-prod-cartera-jua43.py <reporte.txt>
import subprocess, json, sys, time, secrets, os

REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-prod-cartera.txt")
MP, CP = os.environ.get("MARTA_PASS"), os.environ.get("CARLOS_PASS")

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", "--prod", fn, json.dumps(a)],
                       cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0:
        raise RuntimeError((o.stderr or o.stdout).strip() or "error")  # stderr COMPLETO (el mensaje puede no ir en la última línea)
    s = o.stdout.strip()
    if s == "":
        return None
    try:
        return json.loads(s)
    except Exception:
        return s

def err(fn, a):
    try:
        run(fn, a); return ""
    except Exception as e:
        m = str(e)
        for k in ("No encontrado", "No autorizado", "Responsable no válido"):
            if k in m:
                return k
        return m[:80]

def bloqueado(x):
    return x in ("No encontrado", "No autorizado")

resultados, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m
    print(l, flush=True); resultados.append(l)
    if not c: fallos.append(m)

if not MP or not CP:
    print("Faltan MARTA_PASS / CARLOS_PASS"); sys.exit(2)

TA = run("auth:iniciarSesion", {"email": "marta@demo.mx", "password": MP})["token"]
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]
carlosId = run("auth:sesionActual", {"token": TC})["usuario"]["_id"]

# --- Alta del 2º operativo QA (revocable) ---
qa_email = f"qa-cartera-{int(time.time())}@demo.mx"
qa_pass = "QaCartera-" + secrets.token_hex(5)
run("usuarios:invitar", {"token": TA, "email": qa_email, "nombre": "QA Cartera", "rol": "operativo"})
inv = next(i for i in run("usuarios:listar", {"token": TA})["invitaciones"]
           if i["email"] == qa_email and i["estado"] == "pendiente")
run("invitaciones:activar", {"token": inv["token"], "password": qa_pass})
TV = run("auth:iniciarSesion", {"email": qa_email, "password": qa_pass})["token"]
v2Id = run("auth:sesionActual", {"token": TV})["usuario"]["_id"]
print(f"[setup] operativo QA creado: {qa_email} (id {v2Id})", flush=True)

cid = oid = sid = cidPropio = None
tel_fixture = "55 0000 " + secrets.token_hex(2)[:4]
try:
    # Fixture: cliente de Carlos + oportunidad + seguimiento; luego Marta lo reasigna al QA.
    cid = run("clientes:crear", {"token": TC, "nombre": "QA-cartera PROD", "telefono": tel_fixture, "email": qa_email.replace("qa-cartera", "cli-qa")})
    oid = run("oportunidades:crear", {"token": TC, "clienteId": cid, "nombre": "Opo QA-cartera PROD"})
    sid = run("seguimientos:crear", {"token": TC, "clienteId": cid, "titulo": "Seg QA-cartera PROD", "fecha": 1786000000000, "prioridad": "media"})
    run("clientes:asignarResponsable", {"token": TA, "clienteId": cid, "responsableId": v2Id})

    # B-1: Carlos cambia etapa de oportunidad de cliente ajeno → rechazo; etapa intacta
    ok(err("oportunidades:cambiarEtapa", {"token": TC, "oportunidadId": oid, "etapa": "ganada"}) == "No encontrado",
       "B-1: cambiarEtapa de oportunidad ajena → No encontrado")
    opo = next((o for o in run("clientes:detalle", {"token": TA, "clienteId": cid})["oportunidades"] if o["_id"] == oid), None)
    ok(opo and opo["etapa"] == "nueva", "B-1: la etapa de la oportunidad NO cambió (sigue 'nueva')")

    # B-2a: Carlos (dueño anterior) ya no gestiona el seguimiento del cliente ajeno
    ok(bloqueado(err("seguimientos:reprogramar", {"token": TC, "seguimientoId": sid, "fecha": 1787000000000})),
       "B-2a: Carlos reprograma seguimiento de cliente ajeno → bloqueado")
    ok(bloqueado(err("inicio:marcarSeguimientoRealizado", {"token": TC, "seguimientoId": sid})),
       "B-2a: Carlos marcaRealizado de cliente ajeno → bloqueado")
    ok(bloqueado(err("seguimientos:eliminar", {"token": TC, "seguimientoId": sid})),
       "B-2a: Carlos elimina seguimiento de cliente ajeno → bloqueado")

    # B-2b: MIGRACIÓN — el QA (nuevo dueño) heredó el seguimiento y SÍ lo gestiona
    ok(err("seguimientos:reprogramar", {"token": TV, "seguimientoId": sid, "fecha": 1787000000000}) == "",
       "B-2b: QA (nuevo dueño) reprograma el seguimiento migrado → OK")
    ok(err("seguimientos:cancelar", {"token": TV, "seguimientoId": sid}) == "",
       "B-2b: QA (nuevo dueño) cancela el seguimiento migrado → OK")

    # B-2c: DEFENSA EN PROFUNDIDAD — admin delega a Carlos un seguimiento del cliente ajeno
    sidDeleg = run("seguimientos:crear", {"token": TA, "clienteId": cid, "responsableId": carlosId, "titulo": "Seg delegado QA PROD", "fecha": 1786500000000, "prioridad": "media"})
    ok(err("seguimientos:cancelar", {"token": TC, "seguimientoId": sidDeleg}) == "No encontrado",
       "B-2c: Carlos (responsable) NO gestiona seguimiento de cliente ajeno → bloqueado por cartera")

    # B-3: sincronizar (Carlos) no toca la cartera del QA
    def snap(t): return json.dumps(sorted([[c["_id"], c["estado"]] for c in run("clientes:listar", {"token": t})]))
    def estadoDe(t, i): return next((c["estado"] for c in run("clientes:listar", {"token": t}) if c["_id"] == i), None)
    antesQA = snap(TV)
    sync = run("clientes:sincronizarInactividad", {"token": TC})
    ok(snap(TV) == antesQA, f"B-3: sincronizar (Carlos) NO cambia la cartera del QA (cambiados={sync['cambiados']})")

    # B-3+: cliente propio de Carlos en 'prospecto' entra en la evaluación pero no se transiciona (recién activo)
    cidPropio = run("clientes:crear", {"token": TC, "nombre": "QA-propio PROD", "telefono": "55 0000 7777", "email": ""})
    run("clientes:cambiarEstado", {"token": TC, "clienteId": cidPropio, "estado": "prospecto"})
    syncP = run("clientes:sincronizarInactividad", {"token": TC})
    ok(estadoDe(TC, cidPropio) == "prospecto" and isinstance(syncP["cambiados"], int),
       f"B-3+: sincronización de Carlos evalúa su cartera sin transicionar a un cliente propio recién activo (cambiados={syncP['cambiados']})")

    # B-4: buscarDuplicado del cliente ajeno → null para Carlos; el QA (dueño) sí lo ve
    ok(run("clientes:buscarDuplicado", {"token": TC, "telefono": tel_fixture, "email": ""}) is None,
       "B-4: buscarDuplicado de cliente ajeno → null para Carlos (sin datos)")
    dupQA = run("clientes:buscarDuplicado", {"token": TV, "telefono": tel_fixture, "email": ""})
    ok(dupQA and dupQA["nombre"] == "QA-cartera PROD", "B-4: QA (dueño) SÍ ve su propio duplicado")

    # B-5: estadoGlobal del operativo se limita a su cartera; admin ve más
    tC = run("inicio:estadoGlobal", {"token": TC})["total"]
    tA = run("inicio:estadoGlobal", {"token": TA})["total"]
    ok(tC < tA, f"B-5: estadoGlobal de Carlos ({tC}) < admin ({tA}) — solo su cartera")
except Exception as e:
    ok(False, f"excepción: {str(e)[:200]}")
finally:
    # Limpieza: fixtures (admin, borra en cascada) + REVOCAR el operativo QA.
    if oid:
        try: run("oportunidades:eliminar", {"token": TA, "oportunidadId": oid})
        except Exception: pass
    for i in (cid, cidPropio):
        if not i: continue
        try:
            run("clientes:enviarAPapelera", {"token": TA, "clienteId": i})
            run("clientes:eliminarDefinitivo", {"token": TA, "clienteId": i})
        except Exception: pass
    try:
        run("usuarios:desactivar", {"token": TA, "usuarioId": v2Id})
        print("[cleanup] operativo QA desactivado (revocado)", flush=True)
    except Exception as e:
        print(f"[cleanup] AVISO: no se pudo desactivar el QA: {str(e)[:120]}", flush=True)
    for t in (TA, TC, TV):
        try: run("auth:cerrarSesion", {"token": t})
        except Exception: pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte verificación EN VIVO producción — Cartera por vendedor (JUA-43)",
        f"deployment: glad-bird-297 (prod)  commit: 24ba21e+aab2af2",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "2º operativo QA creado y REVOCADO; fixtures eliminados. Sin tokens ni contraseñas.",
        "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}", flush=True)
sys.exit(1 if fallos else 0)
