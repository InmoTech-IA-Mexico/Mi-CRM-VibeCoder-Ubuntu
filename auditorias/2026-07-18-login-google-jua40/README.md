# Login con Google (JUA-40) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-17 (diseño/impl) → 2026-07-18 (Client ID + despliegue).
**Resultado:** diseño NO-GO v1 → GO v2 → impl NO-GO v1 (nonce/DoS) → remediado → **GO v2/v3** → **DESPLEGADO Y VERIFICADO EN VIVO (prod)**.
**Commit desplegado:** `1ebeb48` (main). **Base productiva previa:** `809fc94`.
**Prod:** Convex `glad-bird-297` + Railway `Mi-CRM-VibeCoder-Ubuntu`.

## Qué se entregó

**"Continuar con Google"** como método de autenticación **alternativo** (no registra; el acceso sigue por
invitación). Solo en `/login`; **vincular/desvincular desde el Perfil**. Identidad por **`googleSub`** (no
email). Convive con email+contraseña; sesión de 8 h.

- **`convex/google.ts`:** anti-replay por **nonce consumido** (el cliente lo genera, se registra solo tras
  verificar la credencial → sin emisión anónima), login/vínculo por `sub` (consumo atómico), `estadoVinculo`,
  `desvincularGoogle` (protegida: exige contraseña), purga por cron. QA helpers gateados.
- **`convex/googleAction.ts` (`"use node"`, `google-auth-library`):** verifica el ID token en **servidor**
  (firma/`iss`/`aud` del entorno/`exp`/`email_verified`/`sub`/`nonce`; cotas de longitud).
- **Frontend (`@react-oauth/google`):** botón en `/login` y tarjeta "Cuenta de Google" en Perfil. Oculto sin
  Client ID.
- **Esquema:** `usuarios.googleSub` + índice; tabla `noncesConsumidos`.

## Diseño y bloqueantes

- **Diseño (NO-GO v1 → GO v2):** B-1 (Google en activación sin flujo posible) → Google solo en `/login`; B-2
  (email como identidad) → identidad por `googleSub` con primer vínculo autenticado. GO con 6 controles.
- **Implementación (NO-GO v1 → GO v2/v3):** **B-1 (DoS de nonce)** — la emisión pública de nonces con cuota
  global permitía bloquear el login → remediado con **nonce consumido** (`9f492c1`). Observaciones aplicadas:
  OBS-1 desvincular (`60b1771`), OBS-2 cotas de entrada (`8082b99`), OBS-3 confirmación al desvincular
  (`1ebeb48`). OBS-4 (escala de `noncesConsumidos`) diferida.

## Verificación

- **Dev — núcleo:** driver-44 **10/10** (`reporte-google-auth-dev.txt`), verificador simulado: vínculo, sub
  ya de otro, login por sub, sin vínculo, inactivo, replay, cross-operación, purga, ausencia de emisión
  pública, desvincular.
- **Dev — en vivo (cuenta de Google real):** vincular → login → desvincular (`reporte-verificacion-viva-dev.txt`).
- **Producción (glad-bird-297) — en vivo:** `npx convex deploy` + contrato verificado (`function-spec --prod`;
  emisión pública **ausente**; `QA_HELPERS` ausente) + índices. Prueba real con cuenta demo + Google real:
  vincular (`estadoVinculo`=true) → login por Google → **desvincular** (`estadoVinculo`=false). **Prod sin
  residuo.** Detalle en `despliegue-login-google-jua40-prod-2026-07-18.md`.

## Nota

El **Client ID** de Google (público) **no** se versiona en esta evidencia (indicación del dictamen). El
"client secret" no interviene en el flujo (ID token de GIS). No se registran tokens, `sub` ni email.

## Archivos

- `diseno-login-google-jua40.md` — diseño (v2).
- `auditoria-login-google-jua40-*.md` — actas de implementación, remediación B-1 y final.
- `despliegue-login-google-jua40-prod-2026-07-18.md` — despliegue + verificación en vivo.
- `dictamen-login-google-jua40-1ebeb48-go-v3.md` — dictamen final (GO).
- `drivers/` — driver-44 + reportes sanitizados (núcleo y verificación viva). Sin tokens/sub/email/Client ID.
