# Diseño — Integración de envío de email (Resend) · JUA-129

Fecha: 2026-07-18 · Proyecto "InmoTech IA México — Resto del PRD" · Prioridad Medium.
Enfoque acordado con el operador: **construir ahora, inerte sin la key** (patrón JUA-40). Sin
`RESEND_API_KEY` el sistema se comporta EXACTAMENTE como hoy (los enlaces se comparten con "copiar
enlace"); con la key, además, se envían por correo.

---

## 1. Objetivo y alcance

Enviar por email, de forma automática, los enlaces que hoy se comparten a mano ("copiar enlace"):

| # | Flujo | Disparador (mutación existente) | Enlace | Issue |
|---|-------|--------------------------------|--------|-------|
| 1 | Invitación de usuario | `usuarios.invitar`, `usuarios.reenviar` | `/activar?token=` | JUA-8/9 |
| 2 | Primer admin de un negocio | `negocios.crearNegocio`, `negocios.reemitirAdminInicial` | `/activar?token=` | JUA-41 |
| 3 | Recuperación de contraseña | `recuperacion.solicitar` | `/nueva-password?token=` | JUA-7 |
| 4 | Nueva contraseña al reactivar | `usuarios.reactivar` | `/nueva-password?token=` | JUA-125 |

**Fuera de alcance:** la verificación de email del **registro público (JUA-39)** — JUA-39 sigue
aparcada. El módulo de email queda listo para reutilizarse cuando se retome (mismo `enviarEmail`).

**No se retira "copiar enlace":** sigue como *fallback* (envío fallido, o entorno sin key) y como
herramienta del admin. Esta entrega **añade** el correo, no cambia el contrato de las mutaciones.

## 2. Arquitectura (reutiliza el patrón de `pushEnvio.ts`)

**`convex/email.ts`** (`"use node"`, runtime Node como `googleAction`/`pushEnvio`):

- **`enviarEmail(ctx, {para, asunto, html, texto})`** — helper interno. Llama a la **API REST de
  Resend** por `fetch` (`POST https://api.resend.com/emails`, `Authorization: Bearer RESEND_API_KEY`).
  - **Inerte sin key:** si falta `RESEND_API_KEY`, registra UNA línea no sensible
    (`[email] deshabilitado (sin RESEND_API_KEY); se omite <tipo>`) y retorna sin error.
  - **Reintento acotado:** ante red / HTTP 429 / 5xx reintenta hasta 2 veces con backoff corto; ante
    4xx (p. ej. remitente no verificado) no reintenta. Nunca lanza hacia el scheduler (un fallo de
    correo no debe ensuciar los logs con stacktraces ni reintentar la mutación).
- **Acciones internas por tipo**, cada una compone el correo desde datos mínimos y llama a `enviarEmail`:
  - `internal.email.enviarInvitacion({para, nombre, negocioNombre, rol, token})`
  - `internal.email.enviarRecuperacion({para, token})`  (sirve también a "nueva contraseña" de reactivar)
- **Transporte por `fetch`, sin dependencia nueva** (no se añade el SDK `resend`): es auditable línea
  a línea, sin comportamiento oculto, y trivial de dejar inerte. (Se añadirían ~0 paquetes.)

## 3. Disparo: `scheduler.runAfter(0, …)` desde las mutaciones existentes

Cada mutación de la tabla **conserva su firma y su retorno** (el token se sigue devolviendo → "copiar
enlace" intacto) y **añade** una línea:

```ts
await ctx.scheduler.runAfter(0, internal.email.enviarInvitacion, { para, nombre, negocioNombre, rol, token });
```

- El envío ocurre **después** de confirmar la mutación (efecto secundario, patrón recomendado de
  Convex). Si el correo falla, el registro (invitación/recuperación) ya quedó guardado y el enlace
  sigue disponible por "copiar enlace".
- `negocios.*` son `internalMutation` (runtime por defecto) → pueden agendar la action Node sin
  problema (el scheduler cruza runtimes).

## 4. Anti-enumeración (requisito de seguridad)

- **`recuperacion.solicitar`** ya responde genérico `{ok:true}` siempre. El `runAfter` del correo se
  agenda **solo dentro del bloque** `if (usuario activo con contraseña)` — si el email no existe, no se
  envía ni se agenda nada. La respuesta al cliente no cambia. ✔
- Los flujos 1, 2 y 4 los dispara un **admin ya autenticado** (o el CLI de alta): no hay enumeración
  posible por un anónimo.

## 5. Configuración (entorno, nunca en el repo)

| Variable | Dónde | Ejemplo | Notas |
|----------|-------|---------|-------|
| `RESEND_API_KEY` | Convex dev + prod | `re_…` | **Secreta.** Sin ella, todo inerte. |
| `EMAIL_FROM` | Convex dev + prod | dev: `InmoTech IA <onboarding@resend.dev>` · prod: `InmoTech IA <no-reply@DOMINIO>` | Remitente. En dev, `onboarding@resend.dev` permite enviar **a tu propio correo** sin dominio verificado. |
| `APP_BASE_URL` | Convex dev + prod | dev: `http://localhost:3000` · prod: `https://mi-crm-vibecoder-ubuntu-production.up.railway.app` | Base para componer los enlaces **en el servidor** (la action no tiene `window`). Se valida https en prod. |

Ninguna es `NEXT_PUBLIC_*`: todo el envío es de servidor, no toca el bundle del cliente.

## 6. Plantillas (español, HTML mínimo + texto plano)

Tres asuntos/cuerpos, todos con enlace y caducidad explícita:

- **Invitación:** "Te invitaron a {negocio} en InmoTech IA" — botón "Activar mi cuenta" → `/activar?token=`,
  válido 7 días. Copy sensible al rol (admin/operativo) reutilizando el de la pantalla de bienvenida.
- **Recuperación:** "Restablece tu contraseña" — botón → `/nueva-password?token=`, válido 24 h, "si no
  fuiste tú, ignora este correo".
- **Nueva contraseña (reactivar):** variante del anterior — "Tu acceso se reactivó, crea una contraseña".

**Seguridad de plantilla:** todo dato interpolado en el HTML (`nombre`, `negocioNombre`) pasa por
`escaparHtml` (entidades `& < > " '`) → sin inyección de HTML en el correo. El token va en la URL (hex,
seguro). La base es `APP_BASE_URL` fija del entorno → sin *open redirect*. Sin imágenes ni assets
externos (los clientes de correo los bloquean).

## 7. Fallos y durabilidad (decisión de alcance)

**Sin cola durable (outbox).** El envío es puntual, de bajo volumen y siempre con **fallback "copiar
enlace"**; un `runAfter(0)` + reintento acotado dentro de la action cubre el caso común. Un outbox con
lease/reintentos como el de push (JUA-33) sería sobreingeniería aquí. **OBS (no bloqueante):** si el
correo pasa a ser crítico (p. ej. registro público sin operador que comparta el enlace), añadir una
tabla `emailsSalientes` con estado/reintentos y un cron de flush.

## 8. Higiene / logs

- **Nunca** se registran tokens, ni el cuerpo, ni la dirección completa. Los logs de la action solo
  llevan `tipo` + `status` + `resultado` (p. ej. `[email] invitacion enviada status=200`).
- La key vive solo en el entorno. No se versiona con la evidencia (como el Client ID de JUA-40).

## 9. Verificación prevista

- **Núcleo (dev, sin key):** driver que dispara las 4 mutaciones y comprueba que **no fallan** y que la
  action es **inerte** (registra "deshabilitado", retorna sin lanzar) — el contrato no cambia.
- **`escaparHtml`** unit-testeado (como `csv.ts`) con `node --experimental-strip-types`.
- **En vivo (dev, con key de Resend a tu propio correo, `onboarding@resend.dev`):** invitar → llega el
  correo → el enlace activa; solicitar recuperación → llega → `/nueva-password` funciona.
- **Prod:** cuando haya dominio verificado (envío a terceros). Hasta entonces, desplegable **inerte**
  sin riesgo (igual que JUA-40 sin Client ID).

## 10. Decisiones a confirmar

1. **Alcance = 4 flujos** (invitación, primer admin, recuperación, reactivar); registro JUA-39 fuera. ✅/✍️
2. **Transporte = `fetch` a la API REST de Resend** (sin añadir el SDK). ✅/✍️
3. **Disparo = `scheduler.runAfter(0)`** desde las mutaciones actuales, "copiar enlace" se queda. ✅/✍️
4. **Sin cola durable** (fallback = copiar enlace); reintento acotado en la action. OBS para el futuro. ✅/✍️

---

## 11. Remediación del NO-GO de diseño (v2) — outbox durable

El dictamen de diseño v1 dio **NO-GO** por tres bloqueantes. Se rehace la arquitectura con una
**cola durable** (`emailsSalientes`), calcada de la cola de push (JUA-33). Respuesta punto por punto:

- **B-1 (recuperación sin fallback):** correcto — `recuperacion.solicitar` es pública y no revela el
  token, así que "copiar enlace" NO existe para ella. Se añade **outbox durable para los 4 flujos**
  (no solo recuperación): fila con `estado/intentos/proximoIntento/lease/idempotencyKey/resultado`.
  Una mutación reclama con lease y revalida, la action Node entrega, otra mutación registra
  resultado/reintento (backoff hasta `MAX_INTENTOS`, luego `descartado`). El cron `flush-emails` (cada
  5 min) recupera pendientes/leases vencidos → durabilidad real, no *at-most-once*.
- **B-2 (token en argumentos del scheduler):** se agenda **solo el disparo** `runAfter(0, flush)` **sin
  datos**. La fila de la outbox guarda una **referencia no secreta** (`invitacionId`/`recuperacionId`),
  nunca el token. Al reclamar, la action obtiene los datos por `reclamarLote` (internal) que **revalida
  y deriva** el token+destinatario vigentes en memoria; el token solo se usa para componer y llamar a
  Resend, jamás en argumentos del scheduler, la fila, los logs ni el reporte.
- **B-3 (reintentos sin idempotencia → duplicados):** cada evento lleva una `idempotencyKey` estable no
  secreta, enviada en el header **`Idempotency-Key`** de Resend en **todos** los intentos (y entre
  flushes). Un reenvío (token nuevo) **supersede** el evento vivo anterior (`reemplazado`) y crea uno
  **nuevo** con su propia clave — no se reutiliza el id de invitación.

**Además:** validación de `RESEND_API_KEY` + `APP_BASE_URL` al iniciar la action (si falta cualquiera,
**no se reclama** → no se queman intentos, la cola espera); higiene de logs (solo `tipo`+`status`);
anti-enumeración intacta (el evento se encola solo dentro del bloque de usuario activo). Verificado con
driver-45 **10/10** (B-1/B-2/B-3, lease-recovery, backoff→descartado, revalidación, inerte).
