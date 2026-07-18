# Acta de auditoría — Login con Google (JUA-40) · implementación completa + verificación en vivo (dev) · v3

Fecha: 2026-07-18
Commits: `0e0dc92` (backend) + `39854f1` (frontend) + `9f492c1` (B-1 nonce) + `8082b99` (OBS-2) +
`60b1771` (desvincular / OBS-1), sobre `809fc94`.
Estado: construido, verificado en dev y **probado EN VIVO en dev con una cuenta de Google real**. **NO
desplegado a prod aún.**
Referencia: diseño v2 = GO con 6 controles; implementación v1 = NO-GO por B-1 de nonce; remediación v2 = **GO
con observaciones**.

--------------------------------------------------------------------

## Alcance entregado

Google **solo autentica** (no registra), **en `/login`** + **vincular/desvincular desde el Perfil**.
Identidad por **`googleSub`** (no email). Activación sigue con contraseña; sesión de 8 h; convive con
email+contraseña.

## Componentes

- **`convex/google.ts`:** registro de nonces **consumidos** (anti-replay sin emisión pública), login/vínculo
  por `sub` (consumo atómico), `estadoVinculo`, **`desvincularGoogle`**, purga (cron). QA helpers gateados.
- **`convex/googleAction.ts` (`"use node"`, `google-auth-library`):** verifica el ID token en **servidor**
  (firma JWKS, `iss`, `aud` = `GOOGLE_CLIENT_ID` del entorno, `exp`, `email_verified`, `sub`, `nonce`; cotas
  de longitud OBS-2) y delega.
- **Frontend (`@react-oauth/google`):** botón en `/login` (login) y tarjeta "Cuenta de Google" en Perfil
  (vincular / estado / **desvincular**). Oculto sin Client ID.

## Estado de los bloqueantes y observaciones

- **B-1 (DoS de nonce) — RESUELTO (`9f492c1`):** no se emiten nonces del servidor; el cliente los genera y se
  registran **consumidos** solo tras verificar una credencial de Google válida → sin ruta anónima que llenar.
- **OBS-1 (desvinculación protegida) — APLICADA (`60b1771`):** `desvincularGoogle` requiere sesión + que el
  usuario conserve contraseña (no quedar sin acceso). Botón en Perfil.
- **OBS-2 (cotas de entrada) — APLICADA (`8082b99`):** rechaza `idToken` > 8192 / `nonce` > 128 o vacío.
- **OBS-3/4 (escala de `noncesConsumidos`; UI en navegador):** la UI queda **verificada en vivo** (ver
  abajo); el volumen a escala se observará en operación.

## Verificación

### En vivo (dev, cuenta de Google real) — el hito

Con `GOOGLE_CLIENT_ID` (Convex dev) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (`.env.local`) y una **cuenta de Google
real** (usuario de prueba), en el navegador:

1. **Vincular:** sesión de Carlos (contraseña) → Perfil → botón de Google → autorizar → **"vinculada"**.
   Confirmado en BD: el usuario quedó con `googleSub` (valor no reproducido, higiene).
2. **Entrar con Google:** cerrar sesión → `/login` → "Continuar con Google" → **entró directo** como Carlos
   (sesión 8 h, sin contraseña).
3. **Desvincular:** `estadoVinculo` `true` → `desvincularGoogle` → `false` (limpió el residuo de la prueba).

Esto ejercita la **criptografía real** (GIS + `google-auth-library` + verificación server-side), no solo el
verificador simulado.

### Núcleo (dev, driver-44, 9/9, verificador simulado)

`tmp/drivers-jua40/reporte-google-auth-dev.txt`: vínculo, sub ya de otro, login por sub, sin vínculo,
inactivo, replay, cross-operación, purga, ausencia de emisión pública de nonce. Sin tokens/sub/email en el
reporte.

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK    convex dev --once  OK
```

## Pendiente (condiciones del dictamen para el cierre)

1. Cargar el Client ID en **prod**: `GOOGLE_CLIENT_ID` (Convex prod) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   (Railway). El Client ID es **público** (no secreto).
2. **Convex primero** + verificar contrato en prod → `git push`.
3. **Verificación en vivo en prod** con cuenta **revocable**: vincular → cerrar sesión → entrar por Google →
   (credencial no vinculada → rechazo genérico) → **desvincular** (limpieza).
4. Archivar evidencia sanitizada → cerrar JUA-40.

## Constancia

Módulos nuevos + esquema (índices/tablas opcionales) + deps `google-auth-library`, `@react-oauth/google`.
Client ID (público) cargado en dev; **no** desplegado a prod. Sin secretos ni `sub`/tokens en repo/actas.
