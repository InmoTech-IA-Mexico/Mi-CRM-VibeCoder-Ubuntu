# Acta de remediación — Housekeeping push (JUA-127) · B-1 + OBS-1

Fecha: 2026-07-17
Commit candidato: `529bbe9` sobre `cfde304` (base productiva `6cb7dda`).
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen JUA-127/128 v1 = **NO-GO** por B-1 (JUA-128 quedó CONFORME).
Veredicto propuesto: **B-1 remediado + OBS-1 aplicada; se solicita re-auditoría.**

--------------------------------------------------------------------

## B-1 — El emisor contaba respuestas HTTP como fallos de red → REMEDIADO

**El defecto (confirmado):** en `enviarAUsuario`, tras separar 404/410, la rama `else` llamaba a
`contarFalloRed` para **cualquier** otro error — incluidos los que traen `statusCode` (429, 5xx, 401, 403).
Esos casos **no** prueban un endpoint muerto: un 429/5xx es saturación transitoria y un 401/403 una config
VAPID errónea que, con la lógica anterior, **podaría en masa** las suscripciones sanas tras 3 ciclos.

**La remediación (`529bbe9`):** la clasificación pasa a una **única mutación testeable**
`push.procesarFalloEnvio(id, usuarioId, p256dh, statusCode?)`, condicional por `id+usuarioId+p256dh`:

| Código | Resultado | Efecto |
|---|---|---|
| **404 / 410** | `caducada` | borra la sub (endpoint inexistente) |
| **sin `statusCode`** (error de RED) | `red` → `podada` al 3.º | cuenta consecutivos; poda solo la sub muerta |
| **cualquier otra respuesta HTTP** (429/5xx/401/403…) | `http` | **NO poda**; **reinicia** la racha de red; transitorio |

El emisor cuenta `caducada`/`podada` como **caducadas** (sin reintento) y `red`/`http` como **fallidas**
(la notificación reintenta con backoff). Una respuesta HTTP demuestra conectividad, por lo que **reinicia
`fallosRed`** → "consecutivos" es literal (punto 4 de la remediación exigida). Se eliminan `contarFalloRed`
y `borrarSubCaducada` (integrados en `procesarFalloEnvio`).

## OBS-1 — Re-suscribir reinicia el contador → APLICADO

`guardarSubscription` ahora incluye `fallosRed: 0` en el upsert del endpoint existente: una re-suscripción
no hereda fallos antiguos y no se poda al primer error de red posterior.

## Evidencia (dev, driver-41 v2, 8/8) — por clase de error, ejerciendo la clasificación

Reporte `tmp/drivers-jua33-housekeeping/reporte-poda-sub-dev.txt`. El driver invoca `procesarFalloEnvio`
(lo que llama el emisor), por lo que **ejerce la clasificación**, no solo el contador. Subs fake de dev,
limpiadas.

| Exigido por el dictamen | Prueba | Resultado |
|---|---|---|
| 404/410 borra | T1/T1b | `caducada` + sub borrada |
| 3 errores **sin código** podan | T2 | `red`(1), `red`(2), `podada` (borrada) |
| **429, 5xx, 401/403 NO incrementan ni borran** | T3 | `http`, `fallosRed=0`, sub intacta (5 códigos) |
| "consecutivos" literal (una respuesta HTTP reinicia la racha) | T4 | tras `red`×2, un `500` reinicia; luego `red`=1 |
| Éxito reinicia | T5 | `resetFalloRed` → `fallosRed=0` |
| Guard por versión | T6 | `p256dh` no coincidente → no actúa |
| OBS-1 re-suscripción reinicia | T7 | re-`guardarSubscription` mismo endpoint → `fallosRed=0` |

**JUA-128** se mantiene CONFORME (sin cambios); driver-42 (3/3) y driver-36 (7/7) sin regresión.

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK    convex dev --once  OK
```

## Constancia

Cambios en `convex/push.ts` + `convex/pushEnvio.ts`. No desplegado, sin `git push`, sin tocar prod/remoto.
`procesarFalloEnvio` es `internal*`; se ejecuta desde el emisor (action), no desde el cliente.
