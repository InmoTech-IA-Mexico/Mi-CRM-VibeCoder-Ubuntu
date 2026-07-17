#!/usr/bin/env python3
# Driver 36 — JUA-33 B-1/B-2 (dictamen v1): la RECLAMACIÓN respeta la AUDIENCIA
# materializada de cada fila y la preferencia VIGENTE del destinatario. Cierra el
# defecto: una fila de admin ya no se reasigna al responsable, y una pref cambiada a
# "ninguna" tras encolar no se envía. Ejerce dinámicamente los ramos de inactivo.
# Uso: ADMIN_PASS=.. CARLOS_PASS=.. python3 driver-36-audiencia.py <reporte.txt>
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-b1b2.txt")
AP, CP = os.environ.get("ADMIN_PASS"), os.environ.get("CARLOS_PASS")
SOFIA = "j570t8dpsvdjayqytts4psjbbd8a9q75"; SEG = "jn73ncnmefjay53tv9f8q4e8bn8a9150"
CARLOS = "js79sd3wf64tmnaz6abv0symtn8a939x"; MARTA = "js75cv777hf0tj8khrcx0rwx9x8a8jhb"
VEND2 = "js78w3zwb99wtq00n1by49rzsx8amgr3"; DIA = 86400000
NOMBRE = {CARLOS: "Carlos", MARTA: "Marta", VEND2: "Vendedor Dos"}

def run(fn, a):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a)], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0: raise RuntimeError((o.stderr or o.stdout).strip()[-300:])
    s = o.stdout.strip(); return json.loads(s) if s else None
resultados, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m; print(l, flush=True); resultados.append(l)
    if not c: fallos.append(m)
def nm(ids): return sorted(NOMBRE.get(i, i[:6]) for i in ids)

if not AP or not CP: print("faltan creds"); sys.exit(2)
TA = run("auth:iniciarSesion", {"email": "marta@demo.mx", "password": AP})["token"]   # admin
TC = run("auth:iniciarSesion", {"email": "carlos@demo.mx", "password": CP})["token"]  # operativo

def pref(token, p): run("push:guardarPreferenciaFrio", {"token": token, "pref": p})
def responsable(rid): run("clientes:asignarResponsable", {"token": TA, "clienteId": SOFIA, "responsableId": rid})
def set_estado(uid, e): run("notificaciones:qaSetEstadoUsuario", {"usuarioId": uid, "estado": e})
def notifs():   return [n for n in run("notificaciones:qaListarNotifs", {}) if n["clienteId"] == SOFIA]
def reclamar(): return [x["usuarioId"] for x in (run("notificaciones:reclamarLote", {}) or []) if x["clienteId"] == SOFIA]
def fila_de(ns, uid): return next((n for n in ns if n["usuarioId"] == uid), None)

def cycle():
    # recicla a Sofía a fría (conserva ultimaInteraccion vieja) → dispara el encolado
    run("notificaciones:qaPurgarNotifs", {})
    run("clientes:cambiarEstado", {"token": TA, "clienteId": SOFIA, "estado": "activo"})
    run("seguimientos:reprogramar", {"token": TA, "seguimientoId": SEG, "fecha": int(time.time()*1000)-5*DIA})
    run("clientes:sincronizarInactividad", {"token": TA})

try:
    # T1 — responsable 'cartera' + admin 'negocio' → DOS filas a destinatarios DISTINTOS
    responsable(CARLOS); pref(TC, "cartera"); pref(TA, "negocio")
    cycle()
    ns = notifs()
    aud_ok = (fila_de(ns, CARLOS) or {}).get("audiencia") == "responsable" and \
             (fila_de(ns, MARTA) or {}).get("audiencia") == "admin_negocio"
    rec = reclamar()
    ok(aud_ok and sorted(rec) == sorted([CARLOS, MARTA]),
       f"T1: audiencias materializadas y ambas filas reclaman a distinto usuario ({nm(rec)})")

    # T2 — admin 'negocio' → 'ninguna' TRAS encolar: su fila se DESCARTA, no se redirige al responsable
    responsable(CARLOS); pref(TC, "cartera"); pref(TA, "negocio")
    cycle()
    pref(TA, "ninguna")               # cambia la preferencia después de encolar
    rec = reclamar(); ns = notifs()
    fila_marta = fila_de(ns, MARTA)
    ok(rec == [CARLOS] and fila_marta and fila_marta["estado"] == "descartada"
       and fila_marta["resultado"] == "excluido_por_preferencia",
       f"T2: admin que pasó a 'ninguna' se descarta (no se redirige); Carlos NO duplica ({nm(rec)})")

    # T3 — reasignación: la fila del responsable ANTERIOR se redirige al ACTUAL; la de admin_negocio NO
    responsable(CARLOS); pref(TC, "cartera"); pref(TA, "negocio")
    cycle()
    responsable(VEND2)                # reasigna Sofía a otro responsable
    rec = reclamar()
    ok(sorted(rec) == sorted([VEND2, MARTA]) and CARLOS not in rec,
       f"T3: responsable redirigido al actual; admin_negocio permanece admin ({nm(rec)})")

    # T4a — admin 'pool' y el cliente PASA a tener responsable → la fila admin_pool se descarta
    responsable(None); pref(TA, "pool")
    cycle()
    responsable(CARLOS)               # ya no está en el pool
    rec = reclamar(); ns = notifs()
    fila_marta = fila_de(ns, MARTA)
    ok(MARTA not in rec and fila_marta and fila_marta["estado"] == "descartada"
       and fila_marta["resultado"] == "destinatario_no_corresponde",
       "T4a: admin_pool se descarta cuando el cliente deja de estar sin asignar")

    # T4b — admin 'pool' → 'ninguna' tras encolar: la fila admin_pool se descarta por preferencia
    responsable(None); pref(TA, "pool")
    cycle()
    pref(TA, "ninguna")
    rec = reclamar(); ns = notifs()
    fila_marta = fila_de(ns, MARTA)
    ok(MARTA not in rec and fila_marta and fila_marta["estado"] == "descartada"
       and fila_marta["resultado"] == "excluido_por_preferencia",
       "T4b: admin_pool se descarta cuando el admin pasa a 'ninguna'")

    # T5a — RESPONSABLE INACTIVO (dinámico): su fila se descarta
    responsable(VEND2); pref(TA, "ninguna")   # sin ruido de admin
    cycle()
    set_estado(VEND2, "inactivo")
    rec = reclamar(); ns = notifs()
    fila_vd = fila_de(ns, VEND2)
    ok(VEND2 not in rec and fila_vd and fila_vd["estado"] == "descartada"
       and fila_vd["resultado"] == "responsable_inactivo",
       "T5a: responsable inactivo → fila descartada (ejecutado dinámicamente)")
    set_estado(VEND2, "activo")

    # T5b — POOL SIN ADMIN VÁLIDO (dinámico): admin del pool inactivo → fila descartada
    responsable(None); pref(TA, "pool")
    cycle()
    set_estado(MARTA, "inactivo")
    rec = reclamar(); ns = notifs()
    fila_marta = fila_de(ns, MARTA)
    ok(MARTA not in rec and fila_marta and fila_marta["estado"] == "descartada"
       and fila_marta["resultado"] == "destinatario_no_corresponde",
       "T5b: pool con admin inactivo → fila descartada (ejecutado dinámicamente)")
except Exception as e:
    ok(False, f"excepción: {str(e)[:300]}")
finally:
    # 1) estados por CLI (sin token): imprescindible ANTES de usar tokens
    try: set_estado(MARTA, "activo")
    except Exception: pass
    try: set_estado(VEND2, "activo")
    except Exception: pass
    # 2) restaurar prefs, responsable, recordatorio y purgar
    try: pref(TC, "cartera")
    except Exception: pass
    try: pref(TA, "ninguna")
    except Exception: pass
    try: responsable(CARLOS)
    except Exception: pass
    try: run("seguimientos:reprogramar", {"token": TA, "seguimientoId": SEG, "fecha": 1784350182771})
    except Exception: pass
    try: run("notificaciones:qaPurgarNotifs", {})
    except Exception: pass
    for t in (TA, TC):
        try: run("auth:cerrarSesion", {"token": t})
        except Exception: pass

n_pass = sum(1 for r in resultados if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-36 B-1/B-2 audiencia + preferencia vigente (JUA-33)",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "helpers QA (dev); usuarios/prefs/responsable/recordatorio restaurados; sin secretos.", "", *resultados,
    ]) + "\n")
print(f"\nReporte en {REPORTE}"); sys.exit(1 if fallos else 0)
