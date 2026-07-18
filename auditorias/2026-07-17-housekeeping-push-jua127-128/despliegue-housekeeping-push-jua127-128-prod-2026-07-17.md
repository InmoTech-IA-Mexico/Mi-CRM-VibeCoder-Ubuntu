# Acta de despliegue + verificación en producción — Housekeeping push (JUA-127 + JUA-128)

Fecha: 2026-07-17
Commit desplegado: `809fc94` (main) — housekeeping `cfde304` + remediación B-1 `529bbe9` + formato `809fc94`.
Base previa en prod: `6cb7dda`. Convex prod: `glad-bird-297`.
Dictamen habilitante: JUA-127/128 v2 = **GO con observaciones no bloqueantes**.

--------------------------------------------------------------------

## Orden ejecutado (condiciones del dictamen)

1. **Convex desplegado (cond. 1):** `npx convex deploy` con pseudo-TTY (push completo): funciones subidas,
   esquema validado, **índice `notificacionesPush.por_estado_intento` añadido**. **Contrato verificado en
   prod** (`function-spec --prod`): `push.procesarFalloEnvio` y `push.resetFalloRed` **presentes**;
   `push.contarFalloRed` y `push.borrarSubCaducada` **retiradas**; `notificaciones.reclamarLote` presente.
2. **`git push`:** `4bcaae1..809fc94` (incluye el add+revert de JUA-39, que se anulan — el tip **no** tiene
   `/registro`; backend puro, sin cambios de frontend efectivos).
3. **Verificación en vivo en prod (cond. 2):** con **sub QA revocable** sobre Carlos (demo), sin exponer
   endpoints. Driver-43, **2/2**:
   - `procesarFalloEnvio(statusCode=500)` → **`http`**: **no poda ni incrementa** (`fallosRed=0`, sub intacta).
   - `procesarFalloEnvio()` (sin código) ×3 → `red`, `red`, **`podada`** (sub eliminada).
   La sub QA quedó **podada** por la propia prueba → **prod sin residuo**.

## Estado

JUA-127 (poda solo ante error de RED, con clasificación por código) y JUA-128 (reclamo por índice
`por_estado_intento`) **desplegados y verificados en producción**. La corrección B-1 queda **confirmada en
vivo**: una respuesta HTTP (500/429/401/403…) ya **no** puede podar suscripciones sanas.

## Constancia

Despliegue con GO del dictamen v2. Backend puro; sin secretos en repo/drivers/actas; no se imprimieron
endpoints ni claves de suscripción. Prod quedó sin residuos (sub QA podada; cuentas demo intactas).
Evidencia sanitizada archivada en `auditorias/2026-07-17-housekeeping-push-jua127-128/`.
