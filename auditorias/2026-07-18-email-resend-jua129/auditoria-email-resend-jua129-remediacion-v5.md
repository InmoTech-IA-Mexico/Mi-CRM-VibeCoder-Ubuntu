# Acta de remediación — Integración de email (Resend, JUA-129) · v5

Fecha: 2026-07-18
Responde a: dictamen de **implementación v4 = NO-GO** (B-4: los bloqueos de config contaminaban el
presupuesto de reintentos transitorios).
Commit candidato: **`2bb15ab..3d398a3`** (`main`, árbol limpio; sin desplegar).
Verificación: tsc 0 · eslint 0 · next build 0 · unit **30/30** · driver-45 **16/16**.

---

## Cierre del bloqueante B-4

**Problema (confirmado):** `intentos` cumplía dos funciones — (1) secuencia de reclamación para la
guarda idempotente del lease (`e.intentos !== intentos`), y (2) presupuesto de fallos transitorios
(`intentos >= MAX_INTENTOS`). Como `reclamarLote` incrementa `intentos` en cada reclamación —incluida
la de un bloqueo `config`— tras 3 respuestas 401/403 el evento quedaba con `intentos = 3`. Al corregir
la config, **un único** 429/5xx/red posterior caía en `intentos >= MAX_INTENTOS` y se descartaba como
`fallo_persistente` sin conceder ningún reintento transitorio. Grave para recuperación (sin fallback).

**Remediación (`3d398a3`):** se **separan los dos contadores**.

- **`intentos`** (schema): nº de RECLAMACIONES, secuencia **monotónica**. Sigue siendo la clave de la
  guarda idempotente del lease en `registrarResultado` (un resultado tardío de un lease perdido no casa
  con la reclamación vigente). Config y recuperación de lease lo incrementan, como debe ser.
- **`fallosTransitorios`** (schema, nuevo, opcional): presupuesto de transitorios. Lo incrementa **solo**
  un `transitorio` (429/5xx/red). El tope `MAX_INTENTOS` se mide **exclusivamente** con este contador.
  `config`, `ok`, `terminal` y la recuperación de lease **no** lo tocan. El backoff se calcula sobre él.

Resultado: un evento reanudado tras corregir la config conserva **íntegros** sus reintentos transitorios.

## Prueba dinámica del caso B-4 (la que pedía el dictamen)

driver-45 **T6c**: se encola una recuperación y se le aplican **3 respuestas `config` (401)** seguidas
(reclamando entre cada una) → el evento queda `pendiente` con `intentos ≥ 3` y `fallosTransitorios = 0`.
Entonces, con el entorno "corregido", el siguiente envío recibe un **`transitorio` (503)** → el evento
**sigue `pendiente`** con `fallosTransitorios = 1` y backoff futuro, **no** `descartado`. Es decir, recibe
sus reintentos transitorios normales pese a los 3 bloqueos previos. **PASS.**

Complementos:
- **T5a/T5b:** el tope de transitorios se mide con `fallosTransitorios` (1 → … → 3 = `fallo_persistente`),
  no con `intentos`.
- **T6a/T6b:** `config` no descarta y el mismo evento se reanuda a `enviado` al corregir el entorno.

## Observaciones del dictamen v4 (no bloqueantes)

- **Prueba real de Resend en dev:** sigue pendiente (externo: requiere la cuenta). Es la condición
  práctica antes de habilitar credenciales para usuarios reales.
- **Observabilidad de `bloqueado_config`:** hoy se representa como `pendiente` + `resultado` sanitizado.
  Si se requiere, se puede exponer un conteo administrativo (sin destinatarios ni tokens) — anotado como
  mejora futura, no se implementa ahora.
- **Archivo de evidencia:** al cerrar (tras GO) se copia sanitizada a `auditorias/`.

## Bloqueantes previos (ratificados por los dictámenes anteriores)

- v1 B-1/B-2/B-3 (outbox durable, token fuera del scheduler, idempotencia+supersesión).
- v2 B-1 (tsc/build) y B-2 (`APP_BASE_URL` validada + HTML escapado).
- v3 B-3 (config no descarta; `EMAIL_FROM` obligatorio) + OBS-1 (índice de purga).

## Verificación (árbol limpio, con el driver presente)

```
npx tsc --noEmit    → 0
npx eslint convex/  → 0
npm run build       → exit 0 (25 rutas)
unit test plantillas → 30/30
driver-45           → 16/16 (B-1/B-2/B-3/B-4, config-no-descarta-reanuda, tope por
                              fallosTransitorios, terminal-descarta, lease-recovery,
                              revalidación, supersesión, inerte)
```
Dev limpio tras la corrida (0 eventos, negocio QA cancelado, carlos activo).

## Pendiente (no bloqueante / externo)

- **Prueba en vivo real con Resend en dev** (obs.): con `RESEND_API_KEY` + `EMAIL_FROM`
  (`onboarding@resend.dev`) a un correo autorizado — invitación y recuperación reales,
  activación/restablecimiento, un 4xx terminal, un 429/5xx reintentable y la reanudación tras corregir
  una config — sin registrar tokens ni claves. Requiere que el operador cree la cuenta de Resend.
- **Producción a terceros:** requiere **dominio verificado**. Desplegable **inerte** sin riesgo hasta
  entonces. Orden de despliegue: variables solo en Convex; Convex antes que el frontend; verificar
  contrato productivo; `QA_HELPERS` ausente en prod; QA revocable.

## Higiene

Sin claves, tokens, `sub` ni correos reales en código, logs, reportes ni evidencia. La `RESEND_API_KEY`
vivirá solo en el entorno.
