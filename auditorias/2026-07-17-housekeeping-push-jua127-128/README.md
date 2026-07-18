# Housekeeping de la cola push (JUA-127 + JUA-128) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-17
**Resultado:** NO-GO (v1, B-1) → remediado → **GO con observaciones** (v2) → **DESPLEGADO Y VERIFICADO EN VIVO (prod)**.
**Commit desplegado:** `809fc94` (main). **Base productiva previa:** `6cb7dda`.
**Prod:** Convex `glad-bird-297` (backend puro, sin frontend ni envs nuevas).

## Qué se entregó (cierra las OBS-4 diferidas del ciclo JUA-33)

- **JUA-127 — poda de suscripción muerta por fallos de RED consecutivos.** `pushSubscriptions.fallosRed`
  + `push.procesarFalloEnvio` (clasifica por código): 404/410 → caducada (borra); **sin `statusCode`** (red)
  → cuenta consecutivos y poda al 3.º; **cualquier otra respuesta HTTP** (429/5xx/401/403) → **NO poda**,
  reinicia la racha, transitorio. Éxito y re-suscripción reinician el contador.
- **JUA-128 — reclamo por rango indexado.** Índice `notificacionesPush.por_estado_intento`
  `[estado, proximoIntento]`; `reclamarLote` reclama por rango (`.eq("estado","pendiente").lte("proximoIntento",ahora).take(50)`).

## Bloqueante y observaciones

- **B-1 (v1, RESUELTO en `529bbe9`):** el emisor contaba **cualquier** error no-404/410 (incluidos 429/5xx/
  401/403) como fallo de red → podaba subs sanas. Corregido con clasificación por código en
  `procesarFalloEnvio`. Una respuesta HTTP reinicia la racha ("consecutivos" literal).
- **OBS-1 (v1, RESUELTA):** `guardarSubscription` reinicia `fallosRed:0` al re-suscribir.
- **OBS formato (v2, `809fc94`):** línea en blanco final de `push.ts` eliminada.
- **OBS evidencia durable (v2):** esta carpeta.

## Verificación

- **Dev:** driver-41 v2 **8/8** (clasificación por clase de error, ejerciendo `procesarFalloEnvio`);
  driver-42 **3/3** (índice: futuro excluido / pasado incluido); driver-36 **7/7** sin regresión de
  `reclamarLote`.
- **Producción (glad-bird-297) — en vivo:** `npx convex deploy` con push completo + contrato verificado
  (`function-spec --prod`: `procesarFalloEnvio`/`resetFalloRed` presentes; `contarFalloRed`/
  `borrarSubCaducada` retiradas) + índice `por_estado_intento`. Verificación con **sub QA revocable**
  sobre Carlos (driver-43, **2/2**): HTTP 500 → no poda ni incrementa; 3 sin código → poda. **Prod sin
  residuo** (sub QA podada), sin exponer endpoints. Detalle en
  `despliegue-housekeeping-push-jua127-128-prod-2026-07-17.md`.

## Archivos

- `auditoria-housekeeping-push-jua127-jua128-v1.md` — acta de entrega (ambas issues).
- `auditoria-housekeeping-push-jua127-remediacion-b1.md` — acta de remediación del bloqueante B-1 + OBS-1.
- `despliegue-housekeeping-push-jua127-128-prod-2026-07-17.md` — acta de despliegue + verificación en vivo.
- `dictamen-…-no-go-v1.md` / `dictamen-…-go-v2.md` — dictámenes del auditor.
- `drivers/` — driver-41 (poda/clasificación), driver-42 (índice), driver-43 (verificación prod) + reportes
  sanitizados. Sin endpoints, claves ni secretos.
