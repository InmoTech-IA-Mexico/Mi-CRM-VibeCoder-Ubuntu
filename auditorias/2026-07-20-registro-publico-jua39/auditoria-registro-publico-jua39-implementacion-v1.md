# Acta de implementación — Registro público autoservicio (JUA-39) · v1

Fecha: 2026-07-20
Base: diseño v3 = **GO con controles obligatorios**. Commit: `3048e00` (sobre `b0e428f`).
Estado: implementado en dev; **sin desplegar**; **inerte** sin claves de Turnstile/secretos.
Verificación: tsc 0 · eslint 0 · next build 0 · unit 15/15 · driver-46 (backend) 11/11.

---

## Arquitectura construida

- **Frontera (B-1):** `src/app/api/registro/route.ts` (Route Handler, runtime nodejs). Único punto de
  escritura. Debe llegar por Cloudflare. La creación NO es función pública de Convex: es la httpAction
  `convex/http.ts` (`POST /registro/crear`) guardada por `REGISTRO_SERVER_SECRET` → `internal.registro.crearPendiente`.
- **Turnstile (B-2):** `src/lib/turnstile.ts` (verificador con clasificador puro `evaluarTurnstile`).
- **Dominio (B-3):** `convex/registro.ts` (`crearPendiente` internal, `confirmar`, `porToken`, `purgarPendientes`)
  + tabla `registrosPendientes` (índices por tiempo) + cron. Correo por la cola durable de JUA-129
  (tipo `verificacion_registro`).
- **Frontend:** `/registro` (form + widget Turnstile) y `/registro/confirmar`. Enlace desde `/login`.

## Controles obligatorios del GO (uno por uno)

1. **Autenticación del origen Cloudflare.** El Route Handler: solo `POST` (Next devuelve 405 al resto);
   `X-Edge-Auth` comparado en **tiempo constante** (`timingSafeEqual`), **rechaza (401) ANTES** de leer
   `CF-Connecting-IP`, el cuerpo o Turnstile. `EDGE_SECRET` y `REGISTRO_SERVER_SECRET` son **variables
   distintas**, solo de entorno (nunca cliente/repo/logs). Documentado: la Transform Rule debe **SET/REPLACE**
   `X-Edge-Auth` (no add), y ambos secretos ≥256 bits aleatorios.
2. **Límite de borde.** Regla de Rate Limiting de Cloudflare sobre el host proxeado + exactamente
   `POST /api/registro` (config de operación; el Route Handler además rechaza sin `X-Edge-Auth`, cerrando el
   acceso directo a la URL de Railway). Verificación operativa incluida en las condiciones de despliegue.
3. **Fusible global = cortacircuito.** Reformulado: `CUOTA=60/min` es la **última barrera**; bajo ataque
   distribuido **puede** rechazar altas legítimas durante la ventana. La defensa primaria es borde + Turnstile
   + throttle por email. (Corregido respecto al v2, que decía "no bloquea a terceros".)
4. **Supersesión en una transacción.** `crearPendiente` borra el pendiente anterior del mismo email y marca
   su correo de salida `reemplazado` en la MISMA mutación. Un correo ya reclamado/enviado no se puede
   deshacer (aceptado); la revalidación de la outbox impide enviar los que sigan **pendientes**. Driver-46 T4.
5. **`confirmar` atómico y sin fuga.** Una mutación: valida token+expiración, revalida unicidad normalizada,
   crea negocio+usuario+sesión y **borra** el pendiente. Errores `ConvexError` seguros para el portador del
   token (sin token/hash/email ajeno/datos de tenant). Driver-46 T6/T7/T8.
6. **Cabeceras y telemetría.** `next.config.ts` emite en `/registro`, `/registro/:path*` y `/api/registro`:
   `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`
   (y el Route Handler los repite en sus respuestas). Las páginas llevan `robots noindex` en su metadata y
   `/registro/confirmar` limpia el token de la URL (`history.replaceState`). Sin logs de PII/tokens/hashes.

## Cierre de los bloqueantes de diseño (como se construyó)

- **B-1:** la identidad del email se reserva SOLO en `confirmar`; `crearPendiente` no crea negocio/usuario
  (driver-46 **T1**: pendiente creado, 0 negocios, 0 usuarios). Frontera server-only (httpAction + secreto).
- **B-2:** contrato completo de Siteverify (success+hostname+action, cota 2048, timeout 5 s, idempotency_key,
  fail-closed incl. `timeout-or-duplicate`); `remoteip` = `CF-Connecting-IP` de la frontera, nunca del payload.
  Unit 15/15.
- **B-3:** índices `por_token`/`por_email_creado`/`por_creado`/`por_expira`; throttle/fusible/purga por rango
  acotado (`.take`), cotas de input (password 8–128, nombre ≤80, email ≤254, token ≤2048) **antes de scrypt**,
  borrado-al-confirmar. Driver-46 T3/T4/T5/T9.

## Estado de la prueba mínima exigida

1. **Unit del verificador Turnstile** — **HECHO** (15/15): success:false, hostname/action erróneos,
   `timeout-or-duplicate`, respuesta nula, surface de error-codes; + plantilla (escape/inyección, enlace, 24 h).
2. **Integración del handler** (directo a Railway sin header rechazado; header de cliente no sustituye al
   inyectado; Turnstile falla → no llega a Convex) — **PENDIENTE**: requiere el Route Handler desplegado tras
   la frontera Cloudflare + claves de prueba de Turnstile. Es parte de la verificación previa a la activación.
3. **Driver de servidor** — **HECHO** (driver-46 **11/11**): solicitar no crea negocio/usuario; supersesión;
   confirmación única; token usado; email ocupado entre solicitud y confirmación; throttle; fusible; purga;
   aislamiento de la sesión creada. Reporte en `tmp/drivers-jua39/`.
4. **Prueba viva controlada** — **PENDIENTE**: con dominio naranja, regla de límite efectiva, claves de prueba
   de Turnstile, correo real de verificación (JUA-129), confirmación y sesión de 8 h; limpiar el tenant QA.

Los pasos 2 y 4 se ejecutarán al activar (con la infra de Cloudflare + claves de prueba de Turnstile), igual
que las pruebas vivas de JUA-40/129. El código es **inerte** hasta entonces (fallo cerrado sin secretos).

## Condición de despliegue (del dictamen)

`/registro` no se habilita hasta contar con: dominio proxeado por Cloudflare, Transform Rule que **reemplaza**
`X-Edge-Auth`, regla de rate limiting sobre `POST /api/registro`, widget Turnstile, y las variables separadas:
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Railway) · `TURNSTILE_SECRET_KEY` (Railway) · `TURNSTILE_HOSTNAME` (Railway)
· `EDGE_SECRET` (Cloudflare + Railway) · `REGISTRO_SERVER_SECRET` (Railway + Convex). Sin ellas, inerte (503).

## Higiene

Contraseña solo hasheada (scrypt) en el pendiente, borrada al confirmar/purgar; nunca en claro, queries,
logs, drivers ni emails. Tokens y secretos nunca versionados. La `RESEND_API_KEY` de dev se quitó y restauró
durante el driver (para flush inerte determinista) sin exponerla.
