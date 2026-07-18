# Acta de despliegue + verificación en producción — Login con Google (JUA-40)

Fecha: 2026-07-18
Commit desplegado: `1ebeb48` (main) — backend `0e0dc92` + frontend `39854f1` + B-1 `9f492c1` + OBS-2 `8082b99`
+ desvincular `60b1771` + OBS-3 `1ebeb48`. Base previa en prod: `809fc94`.
Convex prod: `glad-bird-297`. Frontend: Railway `Mi-CRM-VibeCoder-Ubuntu`.
Dictamen habilitante: v3 = **GO con observaciones no bloqueantes — despliegue controlado autorizado**.

--------------------------------------------------------------------

## Orden ejecutado (salvaguardas del dictamen)

1. **Client ID (público) cargado (salvaguarda 1):** `GOOGLE_CLIENT_ID` en Convex prod + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   en Railway. (El Client ID **no** se incluye en esta acta ni en la evidencia versionada, por indicación del
   dictamen; el "client secret" no interviene en este flujo.)
2. **Convex primero (salvaguarda 2):** `npx convex deploy` con pseudo-TTY (push completo): funciones subidas,
   esquema validado, **índices añadidos** (`noncesConsumidos.por_nonce`/`por_expira`, `usuarios.por_google_sub`).
   **Contrato verificado en prod** (`function-spec --prod`): `estadoVinculo`, `desvincularGoogle`,
   `consumirNonceLoginGoogle`, `consumirNonceVincular`, `purgarNoncesExpirados`, `googleAction.iniciarSesionGoogle`,
   `googleAction.vincularGoogle`. **`emitirNonceLogin`/`emitirNonceVincular` AUSENTES** (B-1 remediado en prod).
   `QA_HELPERS` **ausente**.
3. **Frontend después:** `git push` (`9f327ae..1ebeb48`) → build de Railway con la clave pública inyectada
   (verificado: el Client ID aparece en el bundle de `/login` de prod).

## Verificación en vivo en producción (salvaguarda 3)

Con una **cuenta demo (Carlos prod)** y una **cuenta de Google real** (usuario de prueba del Client ID),
en el navegador, verificado por el operador:

- **Vincular:** Perfil → botón de Google → autorizar → "vinculada". Confirmado por `estadoVinculo` (prod) = `true`.
- **Entrar con Google:** cerrar sesión → "Continuar con Google" → **entró como Carlos** (sesión 8 h, sin contraseña).
- **Desvincular:** Perfil → "Desvincular Google" → confirmado por `estadoVinculo` (prod) = **`false`**.

**Prod queda limpio** (Carlos sin `googleSub`; sin residuo). No se reproducen tokens, `sub`, email ni el Client ID.

## Estado

JUA-40 **desplegado y verificado en producción**: login con Google como método alternativo (no registra),
identidad por `googleSub`, vínculo/desvínculo desde el Perfil, sesión 8 h, y el anti-replay por nonce
**consumido** (sin emisión anónima, B-1 remediado) confirmado en el contrato de prod.

Observación diferida (no bloquea): **OBS-4** — observar el tamaño de `noncesConsumidos` a escala y ajustar
paginación/cadencia de la purga si el volumen de logins lo exige.

## Constancia

Despliegue con GO del dictamen v3. Client ID (público) cargado por el operador, **no** versionado con la
evidencia. Prod sin residuos (vínculo QA deshecho; demo intacto). Evidencia sanitizada a archivar en
`auditorias/2026-07-18-login-google-jua40/`.
