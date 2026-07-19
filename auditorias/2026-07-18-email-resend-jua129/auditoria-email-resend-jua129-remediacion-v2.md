# Acta de remediación — Integración de email (Resend, JUA-129) · v2 (outbox durable)

Fecha: 2026-07-18
Responde a: dictamen de **diseño v1 = NO-GO** (B-1 recuperación sin fallback, B-2 token en argumentos
del scheduler, B-3 reintentos sin idempotencia).
Estado: implementado en dev; **sin desplegar**; transporte **inerte** sin `RESEND_API_KEY`.
Verificación: unit-test de plantillas **15/15**, driver-45 (protocolo durable) **10/10**.

---

## Resumen

Se rehízo la arquitectura sobre una **cola durable** (`emailsSalientes`), calcada del patrón de la cola
de push (JUA-33: lease, recuperación de leases vencidos, reintentos con backoff, estado terminal). Con
esto los tres bloqueantes quedan cerrados y la entrega de recuperación —que NO tiene fallback "copiar
enlace"— es durable.

## Cierre de los bloqueantes

### B-1 — Recuperación sin fallback → outbox durable para los 4 flujos

- Nueva tabla `emailsSalientes` (`convex/schema.ts`): `tipo`, referencia de dominio, `idempotencyKey`,
  `estado` (pendiente→enviando→enviado/descartado), `intentos`, `proximoIntento`, `leaseHasta`,
  `resultado`. Índices `por_estado_intento` (reclamo por rango), `por_invitacion`, `por_recuperacion`.
- `convex/emailCola.ts`: `reclamarLote` (recupera leases vencidos, reclama pendientes elegibles por
  rango, revalida y descarta obsoletas, mueve a `enviando` con lease e `intentos+1`),
  `registrarResultado` (idempotente por `intentos`; ok→`enviado`; transitorio→backoff hasta
  `MAX_INTENTOS=3`, luego `descartado`; 4xx no-429→`descartado`).
- `convex/emailEnvio.ts` (`"use node"`): `flush` reclama, envía, registra. Lo dispara el `runAfter(0)`
  de `encolar` (latencia baja) **y** el cron `flush-emails` cada 5 min (durabilidad: recupera
  pendientes por backoff y leases vencidos). Ya **no** depende de un `runAfter` *at-most-once*.
- Driver-45 T5 (backoff→descartado), T6 (recuperación de lease). **PASS.**

### B-2 — El token no viaja en argumentos del scheduler

- `encolar` agenda **solo** `runAfter(0, internal.emailEnvio.flush, {})` — **sin datos**. La fila guarda
  una **referencia no secreta** (`invitacionId`/`recuperacionId`), nunca el token ni el email.
- Al reclamar, `reclamarLote` (internal) **revalida** el recurso y **deriva** en memoria el token y el
  destinatario **vigentes**; se usan solo para componer y llamar a Resend. No hay token en argumentos de
  tareas programadas, ni en la fila, ni en logs (`[email] <tipo> resultado=<...>`), ni en el reporte.
- Revalidación al reclamar: invitación aún `pendiente` y no vencida; recuperación no usada/no expirada;
  usuario `activo`. Carrera de reenvío resuelta por supersesión (B-3).
- Driver-45 T3a (deriva token+destinatario+key en memoria) y **T3b (la fila/lista NO expone el token;
  `tieneIdempotencyKey=true`)**. T7 (usuario inactivo→descartado). **PASS.**

### B-3 — Idempotencia contra correos duplicados

- Cada evento lleva `idempotencyKey` (hex 128 bits, no secreta) enviada en el header **`Idempotency-Key`**
  de Resend en **todos** los intentos y **entre flushes** → un reintento tras un envío ya aceptado no
  duplica (Resend deduplica 24 h).
- Reenvío = **evento nuevo**: `encolar` **supersede** los eventos vivos de la misma referencia
  (`estado="descartado", resultado="reemplazado"`) y crea uno nuevo con clave propia; no se reutiliza el
  id de invitación.
- Driver-45 T9 (supersesión) + T3a (presencia de la clave). **PASS.**

## Controles conservados del dictamen

- **Anti-enumeración:** `recuperacion.solicitar` sigue devolviendo `{ok:true}` genérico; `encolar` se
  invoca **solo dentro** del bloque de usuario activo con contraseña. Driver-45 **T1** (email inexistente
  → 0 eventos). **PASS.**
- **Validación al iniciar la action:** si falta `RESEND_API_KEY` **o** `APP_BASE_URL`, `flush` **no
  reclama** (no quema intentos; la cola espera). Driver-45 **T10** (inerte, 0 reclamados). **PASS.**
- **HTML escapado / texto plano / sin secretos en el cliente:** `escaparHtml` en todo dato interpolado.
  Unit-test 15/15 (incl. intento de inyección `<script>` en nombre/negocio → escapado).
- **`fetch` sin SDK**, `from/to/subject/html/text`, Bearer. Remitente por `EMAIL_FROM`
  (dev: `onboarding@resend.dev`), base por `APP_BASE_URL`.

## Alcance y cableado

4 flujos, todos vía `encolar` (conservan su firma y el "copiar enlace"/retorno como acción del admin):
`usuarios.invitar`, `usuarios.reenviar`, `usuarios.reactivar`, `recuperacion.solicitar`,
`negocios.crearInvitacionAdmin` (alta + reemisión del primer admin). Registro público (JUA-39) fuera.

## Verificación

- **Unit (`node --experimental-strip-types`):** `tmp/drivers-jua129/test-plantillas.ts` — **15/15**
  (escape, no-inyección, enlaces, copy por rol/tipo, validez temporal).
- **Protocolo durable (dev, QA_HELPERS=1, SIN key → transporte inerte):**
  `tmp/drivers-jua129/driver-45-email-cola.py` — **10/10**. Reporte
  `tmp/drivers-jua129/reporte-email-cola-dev.txt`. Dev limpio tras la corrida (0 eventos, negocio QA
  cancelado, carlos activo).
- **lint / tsc / build:** 0 errores.

## Pendiente (no bloqueante / externo)

- **Prueba en vivo real** con `RESEND_API_KEY` (a tu propio correo con `onboarding@resend.dev`, sin
  dominio): invitar/recuperar → llega el correo → el enlace activa/restablece. Requiere que el operador
  cree la cuenta de Resend.
- **Producción a terceros:** requiere **dominio verificado** (`EMAIL_FROM` del dominio). Desplegable
  **inerte** sin riesgo mientras tanto (como JUA-40 sin Client ID).

## Higiene

Sin claves, tokens, `sub`, ni correos reales en logs/reportes. La `RESEND_API_KEY` vivirá solo en el
entorno (Convex dev/prod), nunca en el repo ni en la evidencia.
