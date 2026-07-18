# Diseño / preparación del terreno — Login con Google (JUA-40) · v2

Fecha: 2026-07-17
Estado: **diseño para revisión** (aún sin código). Base productiva: `809fc94`.
Referencia: dictamen de diseño v1 = **NO-GO** por B-1 (activación) y B-2 (identidad por email).
Objetivo: "Continuar con Google" como **método de autenticación alternativo**, sin crear cuentas; sesión
de 8 h como el login tradicional; convive con email+contraseña.

--------------------------------------------------------------------

## Cambios respecto a v1 (remediación del NO-GO de diseño)

- **B-1 — Google solo en `/login` esta iteración.** La activación (`/activar`) sigue con **contraseña** (el
  invitado aún no es usuario; un botón de Google ahí solo podría dar "sin acceso"). Vincular Google se hace
  **desde el perfil, ya autenticado** (prueba de control). Un flujo de Google-en-activación se diseñará
  aparte si se pide.
- **B-2 — Identidad por `googleSub`, no por email.** El identificador estable de una cuenta de Google es
  `sub` (el email puede cambiar y no siempre Google es autoridad sobre él). El login por Google resuelve por
  **`googleSub`**; el email solo es informativo / para el primer vínculo.

## Modelo de identidad y vinculación

- **Esquema:** `usuarios.googleSub` (opcional) + índice `por_google_sub`. Unicidad global reforzada en
  código (un `sub` ↔ un usuario) antes de vincular.
- **Primer vínculo (Perfil → "Vincular Google"), con PRUEBA DE CONTROL:** el usuario, **ya con sesión**
  (contraseña), autoriza en Google → el backend verifica el ID token → fija `googleSub` en SU usuario, si
  ese `sub` no está ya vinculado a otro. Regla ante email distinto: se **permite** (el `sub` es la
  identidad); el email de Google es informativo (se puede mostrar como aviso).
- **Login por Google (`/login`):** verifica el ID token → busca usuario por **`googleSub`** → si existe y
  **activo** → sesión (8 h). Si no hay vínculo → error **genérico** ("No pudimos iniciar sesión con Google")
  sin revelar si el email existe, está inactivo o sin vincular. (El usuario primero vincula desde su perfil.)

> **Nota sobre el criterio de aceptación.** "Entrar con Google con el mismo email de la invitación" se cumple
> mediante un **vínculo único** (desde el perfil autenticado) y luego login por `sub`. El acceso por Google
> **sin vínculo previo**, resolviendo por email, se descarta por seguridad (B-2). *(Mejora futura opcional:
> auto-vínculo en el primer login solo si el email es de dominio Google-autoritativo —`@gmail.com` o `hd` de
> Workspace— y coincide con un único usuario activo sin vínculo; queda fuera de esta iteración.)*

## Controles de seguridad (para el auditor)

- **Verificación en servidor** (action `"use node"` con `google-auth-library`): firma (JWKS de Google),
  `iss`, **`aud` = `GOOGLE_CLIENT_ID` del entorno** (nunca una audiencia enviada por el navegador), `exp`, y
  **`email_verified === true`** (exigido, pero **no** sustituye la vinculación por `sub`).
- **Anti-replay con nonce:** el frontend pide un **nonce** (mutación que lo emite y guarda con TTL corto en
  una tabla `noncesLogin`), lo pasa a GIS (va en el claim `nonce` del ID token), y el backend **verifica y
  consume** ese nonce una sola vez. Un ID token reenviado (bearer válido hasta `exp`) falla porque su nonce
  ya se consumió.
- **No crea cuentas:** jamás inserta en `usuarios`; solo login o vínculo de un usuario existente y activo.
- **Errores genéricos:** no se revela estado de usuarios (inactivo / no vinculado); el detalle "sin acceso"
  solo tras una credencial de Google **válida**, y sin filtrar más.
- **Sin logging sensible:** no se registran ID tokens, payloads, `sub`, emails ni respuestas de Google en
  drivers, consola ni actas.
- **No exponer IDs elegibles al cliente:** la resolución por `sub`/email es server-side; el cliente solo
  recibe un token de sesión o un error genérico.
- **Bloqueo por intentos** (contraseña) no aplica a OAuth; el usuario **inactivo** se rechaza igual.

## Esquema (cambios)

- `usuarios.googleSub: v.optional(v.string())` + `.index("por_google_sub", ["googleSub"])`.
- Tabla `noncesLogin` (`nonce`, `expiraEn`) con índice `por_nonce`, para el anti-replay. (Opcionales →
  sin migración disruptiva; usuarios existentes quedan sin vínculo hasta que lo hagan desde su perfil.)

## Dependencias e integración

- **Backend:** `google-auth-library` en actions `"use node"`; verifican el ID token y delegan
  lectura/vinculación/sesión en `internalMutation`/`internalQuery` (una action no toca la BD directamente).
- **Frontend:** GIS (`@react-oauth/google` o el script oficial) con el `client_id` público; botón conforme a
  las directrices de marca de Google. Botón en `/login` (esta iteración) y en Perfil ("Vincular Google").

## Lo que necesitas montar TÚ en Google Cloud (prerrequisito)

1. **Google Cloud Console → APIs y servicios → Pantalla de consentimiento OAuth** (Externo; nombre, email de
   soporte; scopes `openid`, `email`, `profile`; en pruebas, modo Testing con usuarios de prueba).
2. **Credenciales → Crear → ID de cliente OAuth 2.0 → "Aplicación web"**. **Orígenes de JavaScript
   autorizados:** `http://localhost:3000` (dev) y `https://mi-crm-vibecoder-ubuntu-production.up.railway.app`
   (prod). (Flujo de ID token: no requiere URI de redirección.)
3. Copia el **Client ID** (público). **No hace falta client secret** en este flujo.

### Variables de entorno (al implementar/desplegar)

- Frontend (Railway + `.env.local`): `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Convex (dev y prod): `GOOGLE_CLIENT_ID` (para la `aud`). Sin secretos en el repo.

## Decisiones a confirmar

1. **Alcance:** Google **solo en `/login`** + **vincular desde Perfil** esta iteración (activación con
   contraseña se mantiene). ¿Ok?
2. **Identidad por `googleSub`** con primer vínculo autenticado (no acceso por email sin vínculo). ¿Ok?
3. **Flujo ID token de GIS** (sin client secret) y **solo Google** (Microsoft/otros fuera). ¿Ok?

## Plan de implementación (tras GO al diseño + Client ID cargado)

1. Esquema: `googleSub` + índice; tabla `noncesLogin`.
2. Backend: `auth.emitirNonceLogin` (mutación) · `auth.vincularGoogle` (action, sesión requerida) ·
   `auth.iniciarSesionGoogle` (action, por `sub`) + internas de lectura/vínculo/sesión.
3. Frontend: proveedor GIS; botón en `/login` (login) y Perfil (vincular); errores genéricos.
4. Driver (dev, tokens simulados/mock del verificador): válido+vinculado → sesión; sin vínculo → error;
   inactivo → error; `aud` incorrecta / `iss` / `exp` / `email_verified:false` → rechazo; replay (nonce
   consumido) → rechazo; primer vínculo con sesión → fija `sub`; `sub` ya vinculado a otro → rechazo.
5. Acta → auditoría → GO → despliegue controlado (`GOOGLE_CLIENT_ID` en Convex prod +
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` en Railway; deploy; verificación en vivo).

## Constancia

Documento de diseño; sin cambios de código ni de esquema todavía. No desplegado.
