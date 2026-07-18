# Acta de auditoría — Login con Google (JUA-40) · implementación (backend + frontend) · v1

Fecha: 2026-07-17
Commits candidatos: `0e0dc92` (backend) + `39854f1` (frontend), sobre `809fc94`.
Estado: construido y verificado en local + dev de Convex. **NO desplegado; sin Client ID cargado aún.**
Referencia: dictamen de diseño v2 = **GO con 6 controles obligatorios de implementación**.

--------------------------------------------------------------------

## Alcance de esta iteración

Google **solo autentica** (no registra), **solo en `/login`** + **vincular desde el Perfil**. Identidad por
**`googleSub`** (no email). La activación sigue con contraseña. Convive con email+contraseña; sesión de 8 h.

## Backend (`0e0dc92`)

**Esquema:** `usuarios.googleSub` (opcional) + índice `por_google_sub`; tabla `noncesLogin`
(`nonce`, `expiraEn`, `operacion: login|vincular`, `usuarioId?`) + índices `por_nonce`, `por_expira`.

**`convex/google.ts` (runtime Convex):**
- `emitirNonceLogin` (público, anónimo): purga perezosa + tope de nonces vivos + TTL 5 min.
- `emitirNonceVincular` (público, **requiere sesión** = prueba de control): nonce atado al `usuarioId`.
- `consumirNonceLoginGoogle` (interna): consume nonce **+ resuelve por `googleSub` + crea sesión**,
  atómico; solo usuario activo; `ok:false` genérico ante cualquier fallo.
- `consumirNonceVincular` (interna): consume **+ fija `googleSub` con unicidad global**, atómico.
- `estadoVinculo` (query): ¿el usuario tiene Google vinculado? (para el Perfil; no expone el `sub`).
- `purgarNoncesExpirados` (interna) + **cron horario**.

**`convex/googleAction.ts` (`"use node"`, `google-auth-library`):** `iniciarSesionGoogle` / `vincularGoogle`
verifican el ID token en **servidor** (firma JWKS, `iss`, `aud = GOOGLE_CLIENT_ID` del entorno, `exp`,
`email_verified`, `sub`, claim `nonce`) y delegan. Errores genéricos.

## Frontend (`39854f1`)

- **`components/auth/boton-google.tsx`:** envuelve GIS (`@react-oauth/google`). Pide un nonce, lo pasa a
  Google (viaja en el ID token) y llama a la action (verificación server-side). Modos `login` y `vincular`;
  reintenta con nonce nuevo si se consumió/expiró. **Se oculta si falta `NEXT_PUBLIC_GOOGLE_CLIENT_ID`**
  (el código va seguro sin el Client ID, como la tarjeta de push sin VAPID).
- **`/login`:** botón "Continuar con Google" bajo un separador "o" (solo si hay Client ID).
- **Perfil:** tarjeta "Cuenta de Google" — estado vinculado (query `estadoVinculo`) o botón "Vincular Google".

## Cobertura de los 6 controles obligatorios (dictamen de diseño v2)

| Control | Cómo |
|---|---|
| 1. Nonce contextual de un solo uso | `operacion` (+ `usuarioId` en vínculo); se valida y consume una vez |
| 2. Consumo atómico | consumir nonce **y** crear sesión / fijar vínculo en la MISMA internal mutation |
| 3. Ciclo de vida / abuso | TTL 5 min; purga perezosa + cron; tope de nonces vivos; vínculo exige sesión |
| 4. Verificación estricta server-side | `aud` del entorno; firma/`iss`/`exp`/`nonce`/`sub`/`email_verified`; el navegador no decide |
| 5. Vínculo único y transaccional | `sub` no usado + patch en una mutación; si es de otro, error genérico |
| 6. Higiene de datos | no se registran tokens, payloads, nonces, `sub` ni email; drivers con verificador simulado |

## Verificación (dev)

- **Backend — driver-44 (11/11)** con verificador simulado (`tmp/drivers-jua40/reporte-google-auth-dev.txt`):
  vínculo; sub ya de otro; login por sub; sin vínculo; inactivo; **replay**; **nonces cruzados** por
  operación y por usuario; **expiración**; **purga**. Estado demo restaurado (JSON: sin `googleSub`
  residual). Sin tokens/sub/email en el reporte.
- **Frontend:** `/login` sirve **200** con el botón **oculto** (sin Client ID, correcto). tsc/eslint/build
  en verde (26 rutas). La prueba E2E del botón (credencial real de Google → sesión / vínculo) se hará en
  vivo tras cargar el Client ID.

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK    convex dev --once  OK (índices + tablas)
```

## Interpretación del criterio (recordatorio del diseño aprobado)

"Entrar con Google con el mismo email de la invitación" se cumple con un **vínculo único desde el perfil**
(sesión con contraseña) y luego login por `sub`. No hay acceso por email sin vínculo previo (B-2).

## Pendiente (para el despliegue)

- **Prerrequisito externo:** el **Client ID** de Google (lo crea el operador) → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  (Railway/`.env.local`) + `GOOGLE_CLIENT_ID` (Convex dev/prod).
- **Verificación en vivo** con una credencial real de Google (login + vínculo) tras cargar el Client ID.

## Constancia

Módulos nuevos (`google.ts`, `googleAction.ts`, `boton-google.tsx`) + esquema (índices/tabla opcionales, sin
migración) + deps `google-auth-library` y `@react-oauth/google`. No desplegado, sin `git push`, sin tocar
prod/remoto. Helpers QA gateados por `QA_HELPERS` (inertes en prod).
