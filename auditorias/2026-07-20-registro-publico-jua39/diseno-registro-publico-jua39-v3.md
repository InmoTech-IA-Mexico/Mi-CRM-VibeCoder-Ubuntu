# Diseño — Registro público autoservicio (JUA-39) · v3

Fecha: 2026-07-20 · Responde al **NO-GO de diseño v2** (B-1 frontera, B-2 contrato Turnstile, B-3 índices/cotas).
Base: `b0e428f` (JUA-129 activo). Enfoque: **construir e implementar inerte** (sin claves → `/registro`
deshabilitado), activar cuando el operador cree la frontera Cloudflare + Turnstile.

---

## 0. Cambio de arquitectura respecto a v2

v2 exponía `registro.solicitar` como **action pública de Convex** → invocable directo, sin pasar por
Cloudflare (B-1). v3 mueve la escritura pública a una **frontera de servidor detrás de Cloudflare**; Convex
**solo** acepta la creación del pendiente vía una **credencial de servidor** (no desde el navegador).

## 1. Frontera pública (cierre de B-1)

**Un único punto de entrada de escritura, que SÍ pasa por Cloudflare:** un **Route Handler de Next.js**
`POST /api/registro`, servido bajo un **dominio propio proxeado por Cloudflare** (naranja), p. ej.
`app.inmotechia.mx` → Railway (CNAME proxied). *(Alternativa equivalente: un Cloudflare Worker en una ruta de
`inmotechia.mx`; se elige el Route Handler por reutilizar el stack.)*

```
Navegador (/registro, con widget Turnstile)
   │  POST https://app.inmotechia.mx/api/registro   { turnstileToken, nombreNegocio, nombreAdmin, email, password, zona }
   ▼
[ Cloudflare ]  ── Rate Limiting rule por IP/origen sobre /api/registro (enforce en el edge)
                ── Transform Rule: inyecta header  X-Edge-Auth: <EDGE_SECRET>  (prueba de origen-edge)
                ── (opcional) Managed Challenge/Bot Fight
   ▼
[ Next.js Route Handler /api/registro  (servidor Railway) ]
   1. Rechaza si falta/!= X-Edge-Auth  → cierra el bypass directo a la URL *.up.railway.app
   2. Verifica Turnstile (Siteverify, contrato §2), remoteip = CF-Connecting-IP (de confianza por el paso 1)
   3. Llama a Convex registro.crearPendiente con REGISTRO_SERVER_SECRET (credencial SOLO de servidor)
   ▼
[ Convex  registro.crearPendiente  (mutation guardada por secreto) ]
   · exige args.secret === REGISTRO_SERVER_SECRET (el navegador no lo tiene → no invocable directo)
   · cotas de input → throttle por email → fusible global → supersede → hashea → inserta pendiente → encola email
```

**Por qué cierra B-1:**
- El endpoint de escritura de Convex (`crearPendiente`) **no es invocable desde el navegador**: exige
  `REGISTRO_SERVER_SECRET`, que solo tiene el Route Handler (atestación de servidor no falsificable).
- El Route Handler **solo acepta tráfico que pasó por Cloudflare** (header `X-Edge-Auth`), donde viven el
  **rate-limit por IP** (regla de Cloudflare, enforce en el edge) y el reto Turnstile. La URL directa de
  Railway sin ese header → rechazada.
- La **IP nunca viene del payload web**; el rate-limit por IP lo aplica **Cloudflare** (con `CF-Connecting-IP`
  fiable tras verificar `X-Edge-Auth`), no Convex.
- Ninguna capa por sí sola basta: aunque se sortee una, quedan Turnstile server-verified + throttle por email
  + fusible global en Convex.

## 2. Contrato de Turnstile (cierre de B-2)

El Route Handler valida **cada token** contra Siteverify en servidor (secreto solo en entorno):

- `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` con
  `{ secret: TURNSTILE_SECRET_KEY, response: <token>, remoteip: <CF-Connecting-IP>, idempotency_key: <uuid> }`.
- **Cotas de entrada:** `response` (token) ≤ **2048** chars y no vacío antes de llamar.
- **Aceptar solo si** `success === true` **∧** `hostname === HOST_ESPERADO` (por entorno, p. ej.
  `app.inmotechia.mx`) **∧** `action === "registro_negocio"` (el widget se configura con ese `action` fijo).
- **Fail-closed:** timeout de `fetch` (~5 s); ante error de red, JSON no parseable, `error-codes`
  (incl. **`timeout-or-duplicate`** = token expirado/reusado), o clave ausente → **rechaza**.
- **`remoteip`** solo se envía si proviene de la frontera Cloudflare de confianza; **nunca** del payload.
- **`idempotency_key`** propia por intento, para reintentar Siteverify sin doble consumo.
- Los tokens de Turnstile expiran a los **5 min** y son de **un solo uso** (por eso el fail-closed en
  `timeout-or-duplicate` y no reutilizar tokens).

## 3. Esquema, índices y cotas (cierre de B-3)

### Tabla `registrosPendientes`
```
{ nombreNegocio, nombreAdmin, email, passwordHash, zonaHoraria, token, expiraEn, creadoEn }
```
- **Sin estado "usado":** `confirmar` **borra** la fila (consumo = borrado, un solo uso). No se acumulan
  filas usadas. Un token reusado no encuentra fila → "no válido".
- **`passwordHash`** hasheada al crear (nunca en claro); **se borra** al confirmar o al purgar; **no** se
  expone en queries/logs/drivers/emails.
- **Índices por TIEMPO (acotados, sin escaneo global):**
  - `por_token` `["token"]` — lookup en confirmar.
  - `por_email_creado` `["email", "creadoEn"]` — throttle por email: rango `.eq(email).gte(ahora−VENTANA)` `.first()`.
  - `por_creado` `["creadoEn"]` — fusible global: rango `.gte(ahora−VENTANA)` `.take(CUOTA+1)` (acotado).
  - `por_expira` `["expiraEn"]` — purga: rango `.lt(ahora)` `.take(LOTE)` (acotado).

### Cotas de input (ANTES de `scrypt`, que es caro)
`nombreNegocio` ≤ 80 · `nombreAdmin` ≤ 80 · `email` ≤ 254 (RFC) + regex · `password` **8–128** (cota alta
antes de hashear, evita DoS por contraseña gigante) · `zona` IANA válida · `turnstileToken` ≤ 2048.
Se valida **todo** antes de llamar a `hashPassword`.

### Ventanas/límites (números explícitos, todos como fusibles, no como único control)
- Throttle por email: `VENTANA_EMAIL` = 5 min (no reemitir si hay pendiente reciente del mismo email).
- Fusible global: `CUOTA` = p. ej. 60 pendientes / `VENTANA_GLOBAL` = 1 min (alto; solo corta bajo flood;
  no bloquea a terceros porque no es un lock de app, solo rechaza **nuevas** solicitudes en esa ventana).
- Purga: cron cada 15 min, `por_expira` rango, `LOTE` = 200. TTL del pendiente = 24 h.

## 4. Confirmación (`registro.confirmar`, mutación pública)

Una sola mutación **atómica**: valida token (`por_token`; existe, no expirado) → **revalida unicidad global
del email AHORA** (`validarEmailAdminLibre`) → crea **negocio (activo) + admin (activo, `passwordHash` del
pendiente) + sesión** → **borra el pendiente**. Si el email se ocupó durante la espera → **no crea nada** y
devuelve un resultado que la UI explica ("ese email ya tiene una cuenta") **sin** revelar nada a quien no
posea el token. Sesión de 8 h; negocio aislado por `negocioId` desde el primer momento.

## 5. Email de verificación (reutiliza la cola durable de JUA-129)

- `emailsSalientes`: nuevo `tipo` **`"verificacion_registro"`** + referencia no secreta
  `registroPendienteId`. `reclamarLote`/revalidar: el pendiente sigue **vigente y sin usar**; destinatario =
  `pendiente.email`; enlace `/registro/confirmar?token=…` (24 h). Nueva plantilla "Confirma tu registro".
- **Supersesión (precisión 3):** al crear un pendiente nuevo para un email, se **borra** el pendiente anterior
  de ese email y su evento de correo se **supersede** en la outbox (`reemplazado`) → sin enlaces paralelos.
  Máximo **un** pendiente activo por email (acota la tabla por identidad).

## 6. Precisiones del dictamen (incorporadas)

1. **Normalización única del email** (`trim().toLowerCase()`), la MISMA política en solicitar/confirmar/login/
   recuperación/invitaciones (ya es la regla de `validarEmailAdminLibre`/`por_email`). Unicidad **solo** al
   confirmar, atómica.
2. **Cuenta existente → misma respuesta genérica**, sin crear pendiente ni revelar identidad. Errores de
   **formato** sí pueden ser locales/claros (longitud, password), pero no distinguen identidad existente.
3. **Supersesión por email** (§5).
4. **`confirmar` crea negocio+usuario+sesión+consumo en una sola mutación**; email ocupado en la espera → no
   crea nada, resultado explicable sin fuga.
5. **`/registro/confirmar` sin `SessionProvider`**; tras consumir, **limpia el token de la URL** con
   `history.replaceState`. Ambas rutas públicas con **`Referrer-Policy: no-referrer`** y **`noindex`**.
6. **Telemetría** solo de clase de resultado + ventana (+ id efímero de Turnstile); **nunca** emails, hashes,
   tokens, contraseñas, IPs completas ni payloads.

## 7. Configuración / entorno (nunca en el repo)

| Variable | Dónde | Nota |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Railway | Pública (widget). Sin ella, `/registro` oculto. |
| `TURNSTILE_SECRET_KEY` | Railway (Route Handler) | Secreta. Verifica Siteverify. |
| `REGISTRO_SERVER_SECRET` | Railway + Convex | Credencial servidor↔Convex; sin ella, `crearPendiente` rechaza (inerte). |
| `EDGE_SECRET` | Cloudflare (Transform Rule) + Railway | Prueba de origen-edge; sin ella el Route Handler rechaza. |
| (email) | ya configurado | Reutiliza JUA-129 (Resend/`inmotechia.mx`). |

**Degradación inerte:** sin `REGISTRO_SERVER_SECRET`/Turnstile, el registro queda **deshabilitado** (fallo
cerrado, despliegue sin riesgo, patrón JUA-40/129).

## 8. Frontend

- **`/registro`** (grupo `(auth)`): formulario (negocio, tu nombre, email, contraseña x2 + medidor JUA-124,
  zona) + **widget Turnstile** (`action="registro_negocio"`). Validación de formato en cliente antes de enviar
  (no gastar el token en errores triviales; el servidor revalida). Envía a `/api/registro`. Oculto sin site key.
- **`/registro/confirmar`**: llama `registro.confirmar`; éxito → guarda sesión → `/inicio`; limpia el token de
  la URL; maneja expirado/usado/email-ocupado. Sin `SessionProvider`, `noindex`, `no-referrer`.
- Enlace desde `/login` visible solo si el registro está habilitado.

## 9. Dependencias externas de operación (una sola vez)

1. **Dominio proxeado** en Cloudflare apuntando a Railway (p. ej. `app.inmotechia.mx`, CNAME naranja).
2. **Widget Turnstile** (site key + secret key) con `action=registro_negocio`, dominio = el anterior.
3. **Regla de Rate Limiting** de Cloudflare sobre `/api/registro` (por IP).
4. **Transform Rule** que inyecta `X-Edge-Auth: <EDGE_SECRET>` en el dominio proxeado.
5. Cargar las 4 variables (§7). *(Yo proporciono todo el código; esto es config de Cloudflare/Railway.)*

## 10. Verificación prevista (según la prueba mínima del dictamen)

- **Unit del verificador Turnstile** (función pura + transporte simulado): hostname/action erróneos, token
  vacío/>2048, timeout, respuesta no-JSON, `timeout-or-duplicate`, clave ausente → **todos fail-closed**.
- **Driver de servidor contra la frontera real** (`/api/registro`): sin `X-Edge-Auth` → rechazo; **no crea
  negocio en solicitar**; confirma **una sola vez**; revalida **email ocupado** (en solicitar y confirmar); **no
  fuga tenant**; throttle por email; fusible por ventana; purga por índices. Limpieza en `finally`.
- **Turnstile con claves de PRUEBA de Cloudflare** (respuestas controladas) antes del widget de producción.
- **Cotas antes de `scrypt`** (password 129 chars, token 2049 → rechazo previo).
- **Prueba viva:** email real de verificación (JUA-129) → confirmar → sesión 8 h → aislamiento → rate-limit
  efectivo en el endpoint de escritura.
- lint/tsc/build 0.

## 11. Decisiones a confirmar

1. **Frontera = Route Handler `/api/registro` bajo dominio proxeado por Cloudflare** (+ `X-Edge-Auth`), en vez
   de action pública de Convex. (Alternativa: Cloudflare Worker.) ✅/✍️
2. **Contrato Turnstile completo** (action `registro_negocio` + hostname + fail-closed + idempotency). ✅/✍️
3. **Esquema con índices por tiempo** + cotas de input + fusibles acotados + borrado-al-confirmar. ✅/✍️
4. **Reutilizar la cola de JUA-129** (tipo `verificacion_registro` + supersesión por email). ✅/✍️
5. **Contraseña en el paso 1** (hasheada en el pendiente, borrada al confirmar/purgar). ✅/✍️

## 12. Nota de alcance (honesta)

Este es el issue con **más superficie de infraestructura** del backlog: un endpoint **público sin sesión** que
crea tenants exige frontera de red, antibot server-verified y cuotas acotadas. La mayor parte es **config de
Cloudflare/Railway de una sola vez** (yo aporto el código). Es proporcional al riesgo (alta pública de
negocios), pero es legítimo **valorar si conviene ahora** o dejar JUA-39 para cuando de verdad se quiera abrir
el CRM a terceros — hoy el alta por CLI (JUA-41) cubre el onboarding controlado.
