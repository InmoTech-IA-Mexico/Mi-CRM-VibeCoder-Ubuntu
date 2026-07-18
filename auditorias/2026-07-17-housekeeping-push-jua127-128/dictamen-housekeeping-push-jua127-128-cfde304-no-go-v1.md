# Acta de auditoría — Housekeeping de la cola push (JUA-127 + JUA-128) · v1

Fecha: 2026-07-17
Commit auditado: `cfde304`
Base declarada: `ff9f3a8` sobre producción `6cb7dda`
Estado revisado: candidato local y Convex dev; no desplegado por esta auditoría
Veredicto: **NO-GO — B-1: PODA SUSCRIPCIONES VÁLIDAS ANTE ERRORES HTTP TRANSITORIOS O DE CONFIGURACIÓN**

---

## Resultado

JUA-128 está correctamente planteada: el índice `[estado, proximoIntento]` permite reclamar el lote elegible sin recorrer todas las filas pendientes. JUA-127 incorpora contador, condición de versión y reinicio tras éxito, pero el emisor no implementa la clasificación de errores que declara el acta.

No procede desplegar la serie mientras esa diferencia pueda borrar suscripciones válidas.

## B-1 — La implementación cuenta errores HTTP como fallos de red

**Estado: ABIERTO — BLOQUEANTE.**

En `pushEnvio.ts`, tras separar 404/410, la rama `else` llama incondicionalmente a `contarFalloRed` para
**cualquier otro error**. Por tanto, tres respuestas HTTP 429, 500, 503, 401 o 403 pueden incrementar el
contador y eliminar la suscripción. Esos casos no prueban que el endpoint esté muerto:

- 429/5xx pueden ser saturación o indisponibilidad temporal del push service.
- 401/403 pueden revelar una configuración VAPID incorrecta o una incidencia global; el efecto sería podar
  en masa las suscripciones sanas tras tres ciclos.

### Remediación requerida

1. 404/410: borrar como caducada.
2. Sin `statusCode`: incrementar; podar solo al tercer fallo consecutivo de red.
3. Cualquier respuesta HTTP distinta: no podar (transitorio / config).
4. Una respuesta HTTP demuestra conectividad; para que "consecutivos" sea literal, reiniciar `fallosRed`.

La evidencia debe simular/inyectar 429, 5xx y 401/403 y confirmar que no incrementan ni borran, además de
conservar el caso de tres errores sin código que sí poda, ejerciendo `enviarAUsuario`.

## JUA-128 — Reclamo por rango indexado

**Estado: CONFORME.** `reclamarLote` consulta `estado=pendiente ∧ proximoIntento<=ahora` con `take(LOTE_MAX)`.
La recuperación de leases sigue por `enviando` (conjunto acotado). Driver 42 confirma exclusión de futuro e
inclusión de pasado.

## Observaciones no bloqueantes

- **OBS-1:** `guardarSubscription` no reinicia `fallosRed` en el upsert; una re-suscripción hereda fallos
  antiguos. Incluir `fallosRed: 0` y cubrirlo con prueba.
- **OBS-2:** archivar drivers/reportes sanitizados en `auditorias/` al cierre.

## Dictamen

No desplegar `cfde304`. Corregir B-1 en el emisor y añadir pruebas por clase de error.
