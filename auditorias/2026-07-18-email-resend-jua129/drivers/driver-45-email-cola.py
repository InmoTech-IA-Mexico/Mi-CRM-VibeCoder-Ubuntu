#!/usr/bin/env python3
# Driver 45 — JUA-129: protocolo DURABLE de la cola de correo (outbox). Ejercita, contra
# dev (QA_HELPERS=1, SIN RESEND_API_KEY → transporte inerte), la cola con mutaciones de
# dominio REALES: B-1 anti-enumeración, B-2 token fuera de fila/scheduler, B-3 supersesión
# + idempotencia + clasificación (config NO descarta y se reanuda; terminal descarta),
# lease-recovery, backoff→descartado, revalidación (usuario inactivo), inerte.
import subprocess, json, sys, os, time
REPO = os.environ.get("REPO_DIR", "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM")
REPORTE = next((a for a in sys.argv[1:] if a.endswith(".txt")), "/tmp/reporte-jua129.txt")
TS = int(time.time())
CARLOS_EMAIL = "carlos@demo.mx"
CARLOS_ID = "js79sd3wf64tmnaz6abv0symtn8a939x"  # dev demo (mismo que driver-44)

def run(fn, a=None):
    o = subprocess.run(["npx", "convex", "run", fn, json.dumps(a or {})], cwd=REPO, capture_output=True, text=True)
    if o.returncode != 0:
        raise RuntimeError((o.stderr or o.stdout).strip()[-400:])
    s = o.stdout.strip()
    return json.loads(s) if s else None

res, fallos = [], []
def ok(c, m):
    l = ("PASS" if c else "FAIL") + " — " + m
    print(l, flush=True); res.append(l)
    if not c: fallos.append(m)

def eventos():
    return run("emailCola:qaListarEmails")

def por_id(eid):
    return next((e for e in eventos() if e["id"] == eid), None)

def nuevo_evento(recuperacionId=None, invitacionId=None, estado="pendiente"):
    for e in eventos():  # ordenados por creadoEn desc
        if e["estado"] != estado: continue
        if recuperacionId and e.get("recuperacionId") != recuperacionId: continue
        if invitacionId and e.get("invitacionId") != invitacionId: continue
        return e
    return None

def reclamar_mio(eid):
    return next((x for x in run("emailCola:reclamarLote") if x["id"] == eid), None)

negocio_qa = None
try:
    run("emailCola:qaPurgarEmails")  # estado limpio
    run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS_ID, "estado": "activo"})

    # T1 — B-1: solicitar recuperación de un email INEXISTENTE no crea evento (anti-enumeración).
    antes = len(eventos())
    r = run("recuperacion:solicitar", {"email": f"nadie-{TS}@inexistente.mx"})
    ok(r == {"ok": True} and len(eventos()) == antes, "T1 (B-1): email inexistente → respuesta genérica y 0 eventos")

    # T2 — solicitar recuperación de un usuario ACTIVO real sí crea un evento pendiente.
    run("recuperacion:solicitar", {"email": CARLOS_EMAIL})
    ev = nuevo_evento(estado="pendiente")
    recId = ev and ev.get("recuperacionId")
    ok(ev is not None and ev["tipo"] == "recuperacion" and recId is not None, "T2: usuario activo → evento recuperacion pendiente")

    # T3 — B-2: al reclamar, token y destinatario se DERIVAN en memoria; la fila NO guarda el token.
    mio = reclamar_mio(ev["id"])
    tiene = bool(mio) and isinstance(mio.get("token"), str) and len(mio["token"]) >= 32 and "@" in (mio.get("para") or "") and len(mio.get("idempotencyKey", "")) > 0
    ok(tiene, "T3a (B-2): reclamo deriva token + destinatario + idempotencyKey en memoria")
    listado = por_id(ev["id"])
    ok(listado and "token" not in listado and listado.get("tieneIdempotencyKey") is True and listado["estado"] == "enviando",
       "T3b (B-2): la fila/lista NO expone el token; queda 'enviando' con lease")

    # T4 — clase 'ok' → estado terminal 'enviado'.
    run("emailCola:registrarResultado", {"id": ev["id"], "intentos": mio["intentos"], "clase": "ok", "status": 200})
    ok((por_id(ev["id"]) or {}).get("estado") == "enviado", "T4: clase ok → 'enviado'")

    # T5 — transitorio: reintenta con backoff; al 3.º fallo transitorio se descarta. El tope se
    #      mide con `fallosTransitorios`, no con `intentos` (la secuencia de reclamación).
    run("emailCola:qaEncolar", {"tipo": "recuperacion", "recuperacionId": recId})
    e5 = nuevo_evento(recuperacionId=recId, estado="pendiente")
    c5 = reclamar_mio(e5["id"])
    run("emailCola:registrarResultado", {"id": e5["id"], "intentos": c5["intentos"], "clase": "transitorio", "status": 503})
    b = por_id(e5["id"])
    ok(b and b["estado"] == "pendiente" and b["fallosTransitorios"] == 1 and b["proximoIntentoFuturo"] is True, "T5a: transitorio → 'pendiente' (fallosTransitorios=1) con backoff futuro")
    run("emailCola:qaAjustarEmail", {"id": e5["id"], "estado": "pendiente", "fallosTransitorios": 2, "proximoIntento": 0})
    c5b = reclamar_mio(e5["id"])
    run("emailCola:registrarResultado", {"id": e5["id"], "intentos": c5b["intentos"], "clase": "transitorio", "status": 503})
    b2 = por_id(e5["id"])
    ok(b2 and b2["estado"] == "descartado" and b2["resultado"] == "fallo_persistente", "T5b: 3.º fallo transitorio → 'descartado' (fallo_persistente)")

    # T6 — B-3: config (401/403) NO descarta; vuelve a pendiente 'bloqueado_config' y se REANUDA
    #      al corregir el entorno, con el MISMO evento (sin emitir token nuevo).
    run("emailCola:qaEncolar", {"tipo": "recuperacion", "recuperacionId": recId})
    e6 = nuevo_evento(recuperacionId=recId, estado="pendiente")
    c6 = reclamar_mio(e6["id"])
    run("emailCola:registrarResultado", {"id": e6["id"], "intentos": c6["intentos"], "clase": "config", "status": 403})
    b6 = por_id(e6["id"])
    ok(b6 and b6["estado"] == "pendiente" and b6["resultado"] == "bloqueado_config" and b6["proximoIntentoFuturo"] is True,
       "T6a (B-3): config 403 → 'pendiente' (bloqueado_config), NO descartado")
    run("emailCola:qaAjustarEmail", {"id": e6["id"], "proximoIntento": 0})  # entorno corregido → ya elegible
    c6b = reclamar_mio(e6["id"])
    run("emailCola:registrarResultado", {"id": e6["id"], "intentos": c6b["intentos"], "clase": "ok", "status": 200})
    b6b = por_id(e6["id"])
    ok(c6b and b6b and b6b["estado"] == "enviado" and b6b["id"] == e6["id"], "T6b (B-3): al corregir el entorno el MISMO evento se reanuda → 'enviado'")

    # T6c — B-4: los bloqueos de config NO consumen el presupuesto de transitorios. Tras 3
    #        config seguidos (intentos↑, fallosTransitorios=0), un transitorio posterior AÚN
    #        recibe su reintento normal (pendiente), no se descarta como fallo_persistente.
    run("emailCola:qaEncolar", {"tipo": "recuperacion", "recuperacionId": recId})
    eb4 = nuevo_evento(recuperacionId=recId, estado="pendiente")
    for _ in range(3):
        cc = reclamar_mio(eb4["id"])
        run("emailCola:registrarResultado", {"id": eb4["id"], "intentos": cc["intentos"], "clase": "config", "status": 401})
        run("emailCola:qaAjustarEmail", {"id": eb4["id"], "proximoIntento": 0})
    antes_b4 = por_id(eb4["id"])
    ct = reclamar_mio(eb4["id"])  # entorno corregido; el siguiente envío recibe un transitorio
    run("emailCola:registrarResultado", {"id": eb4["id"], "intentos": ct["intentos"], "clase": "transitorio", "status": 503})
    b4 = por_id(eb4["id"])
    ok(antes_b4 and antes_b4["intentos"] >= 3 and antes_b4["fallosTransitorios"] == 0 and b4 and b4["estado"] == "pendiente" and b4["fallosTransitorios"] == 1 and b4["proximoIntentoFuturo"] is True,
       "T6c (B-4): 3 config no consumen el presupuesto; un transitorio posterior aún se reintenta (pendiente, no descartado)")

    # T7 — terminal (otros 4xx): error real de la petición → descartado.
    run("emailCola:qaEncolar", {"tipo": "recuperacion", "recuperacionId": recId})
    e7 = nuevo_evento(recuperacionId=recId, estado="pendiente")
    c7 = reclamar_mio(e7["id"])
    run("emailCola:registrarResultado", {"id": e7["id"], "intentos": c7["intentos"], "clase": "terminal", "status": 422})
    b7 = por_id(e7["id"])
    ok(b7 and b7["estado"] == "descartado" and b7["resultado"] == "error_422", "T7: terminal 422 → 'descartado' (error_422)")

    # T8 — recuperación de lease: 'enviando' con lease vencido vuelve a la cola y se re-reclama.
    run("emailCola:qaEncolar", {"tipo": "recuperacion", "recuperacionId": recId})
    e8 = nuevo_evento(recuperacionId=recId, estado="pendiente")
    c8 = reclamar_mio(e8["id"])
    run("emailCola:qaAjustarEmail", {"id": e8["id"], "leaseHasta": 1})  # lease en el pasado
    c8b = reclamar_mio(e8["id"])
    ok(c8 and c8["intentos"] == 1 and c8b and c8b["intentos"] == 2, "T8: lease vencido → se recupera y re-reclama (intentos 1→2)")
    run("emailCola:registrarResultado", {"id": e8["id"], "intentos": c8b["intentos"], "clase": "ok"})

    # T9 — revalidación al reclamar: usuario inactivo → descartado (no se envía a una cuenta muerta).
    run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS_ID, "estado": "inactivo"})
    run("emailCola:qaEncolar", {"tipo": "recuperacion", "recuperacionId": recId})
    e9 = nuevo_evento(recuperacionId=recId, estado="pendiente")
    run("emailCola:reclamarLote")
    b9 = por_id(e9["id"])
    ok(b9 and b9["estado"] == "descartado" and b9["resultado"] == "usuario_inactivo", "T9: usuario inactivo al reclamar → 'descartado' (usuario_inactivo)")
    run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS_ID, "estado": "activo"})

    # T10 — invitación (alta de negocio interna): evento invitacion; reclamo deriva correo admin + token.
    alta = run("negocios:crearNegocio", {"nombre": f"QA Email {TS}", "emailAdmin": f"qa-jua129-{TS}@test.mx", "baseUrl": "https://qa.example.com"})
    negocio_qa = alta["negocioId"]; invId = alta["invitacionId"]
    ev10 = nuevo_evento(invitacionId=invId, estado="pendiente")
    c10 = reclamar_mio(ev10["id"])
    ok(ev10 and ev10["tipo"] == "invitacion" and c10 and c10["para"] == f"qa-jua129-{TS}@test.mx" and len(c10["token"]) >= 32,
       "T10: alta de negocio → evento invitacion; reclamo deriva correo del admin + token")

    # T11 — B-3 supersesión: un reenvío de la MISMA invitación descarta el evento vivo y crea uno nuevo.
    run("emailCola:qaEncolar", {"tipo": "invitacion", "invitacionId": invId})
    prev = por_id(ev10["id"]); nuevo = nuevo_evento(invitacionId=invId, estado="pendiente")
    ok(prev and prev["estado"] == "descartado" and prev["resultado"] == "reemplazado" and nuevo and nuevo["id"] != ev10["id"],
       "T11 (B-3): reenvío supersede el evento anterior ('reemplazado') y crea uno nuevo")

    # T12 — inerte sin RESEND_API_KEY: flush NO reclama (no quema intentos); la cola espera.
    f = run("emailEnvio:flush")
    despues = por_id(nuevo["id"])
    ok(f == {"reclamados": 0, "enviados": 0, "fallidos": 0} and despues and despues["estado"] == "pendiente" and despues["intentos"] == nuevo["intentos"],
       "T12: sin RESEND_API_KEY el flush es inerte (0 reclamados; no quema intentos)")

except Exception as e:
    ok(False, f"excepción: {str(e)[:400]}")
finally:
    try: run("emailCola:qaPurgarEmails")
    except Exception: pass
    try:
        if negocio_qa: run("negocios:cancelarNegocioVacio", {"negocioId": negocio_qa})
    except Exception: pass
    try: run("notificaciones:qaSetEstadoUsuario", {"usuarioId": CARLOS_ID, "estado": "activo"})
    except Exception: pass

n_pass = sum(1 for r in res if r.startswith("PASS"))
with open(REPORTE, "w") as f:
    f.write("\n".join([
        "Reporte driver-45 JUA-129 — cola durable de correo (outbox): idempotencia, clasificación, revalidación",
        f"fecha: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        f"entorno: dev, QA_HELPERS=1, SIN RESEND_API_KEY (transporte inerte; se prueba el protocolo)",
        f"resultado: {'OK' if not fallos else 'CON FALLOS'} ({n_pass} PASS / {len(fallos)} FAIL)",
        "sin tokens/correos reales en la fila; negocio QA cancelado; carlos restaurado activo.", "", *res,
    ]) + "\n")
print(f"\nReporte en {REPORTE}")
sys.exit(1 if fallos else 0)
