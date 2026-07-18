# Acta de auditoría — Housekeeping push (JUA-127) · v2

Fecha: 2026-07-17
Commits auditados: `cfde304` + `529bbe9`
Base productiva: `6cb7dda`
Estado revisado: candidato local; no desplegado por esta auditoría
Referencia: dictamen v1 = **NO-GO** por B-1; JUA-128 conforme
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado

Se levanta el NO-GO de JUA-127. La remediación `529bbe9` corrige el error que permitía tratar respuestas
HTTP como fallos de red y eliminar suscripciones válidas tras tres ciclos. JUA-128 se mantiene conforme.

## Revisión del bloqueante B-1

**Estado: RESUELTO.** `push.procesarFalloEnvio` centraliza la clasificación y conserva la guarda por
`id + usuarioId + p256dh`:

- 404/410: elimina la suscripción como caducada.
- Ausencia de `statusCode`: incrementa `fallosRed` y poda únicamente al tercer fallo consecutivo.
- Cualquier otra respuesta HTTP: no elimina ni incrementa; reinicia una racha previa de fallos de red.

El emisor consume la clasificación: solo `caducada` y `podada` evitan el reintento; `red` y `http` conservan
el reintento con backoff. Cubre expresamente 429, 5xx, 401 y 403, que ya no pueden provocar poda masiva.

## OBS-1 — Re-suscripción

**Estado: RESUELTA.** El upsert de `guardarSubscription` fija `fallosRed: 0`.

## Evidencia revisada

Driver 41 v2 declara **8 PASS / 0 FAIL** invocando `procesarFalloEnvio` (la mutación que consume el emisor):
eliminación con 404/410; poda tras tres errores sin código; 429/500/503/401/403 sin incremento ni borrado;
reinicio de racha por respuesta HTTP; reinicio por éxito; guarda por `p256dh`; reinicio al re-suscribirse.

## JUA-128

**CONFORME, sin cambios.** `reclamarLote` por `por_estado_intento`; recuperación de leases por `enviando`.

## Observaciones no bloqueantes

1. **Formato:** eliminar la línea en blanco final de `convex/push.ts` (`git diff --check`).
2. **Evidencia durable:** copiar drivers, reportes y verificación viva sanitizados a `auditorias/`.

## Condiciones para el despliegue

1. Desplegar Convex y verificar en prod el índice y las funciones esperadas.
2. Confirmar en prod que un error HTTP no modifica `fallosRed` ni borra la suscripción; con datos QA
   revocables y sin exponer endpoints.
3. Archivar la evidencia sanitizada y limpiar cualquier suscripción QA antes del cierre.

## Dictamen

Se autoriza el despliegue controlado de JUA-127/JUA-128.
