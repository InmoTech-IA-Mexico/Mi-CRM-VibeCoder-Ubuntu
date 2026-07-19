# Acta de despliegue + prueba en vivo — Integración de email (Resend, JUA-129)

Fecha: 2026-07-18
Commit desplegado: `3d398a3` (rango `2bb15ab..3d398a3`: impl + 4 remediaciones). Base previa en prod: `8c2dda0`.
Convex prod: `glad-bird-297`. Dictamen habilitante: **v5 = GO con observaciones — despliegue inerte controlado**.
Modo: **INERTE** — sin `RESEND_API_KEY` en prod → la cola no reclama; los flujos conservan "copiar enlace".

--------------------------------------------------------------------

## Prueba en vivo previa (dev, Resend real) — salvaguarda 5 del dictamen

Con `RESEND_API_KEY` + `EMAIL_FROM` (`InmoTech IA <onboarding@resend.dev>`) + `APP_BASE_URL`
(`http://localhost:3000`) en Convex **dev**, y destinatario autorizado (`onboarding@resend.dev` solo
entrega al correo de la cuenta de Resend):

- **Invitación real:** alta de negocio → `flush` → **correo entregado** (`ok_200`), recibido y verificado
  en bandeja (asunto/botón/validez correctos).
- **Recuperación real:** `recuperacion.solicitar` (usuario activo) → `flush` → **correo entregado**
  (`ok_200`), recibido y verificado en bandeja.
- Ambos eventos quedaron `enviado` `ok_200`, sin token en la fila. Limpieza posterior de dev (negocio QA
  borrado, eventos purgados).
- La clasificación de errores (config/transitorio/terminal, reanudación, no-duplicados) quedó probada de
  forma **determinista** en driver-45 (16/16); el enlace `/activar`·`/nueva-password` apunta a localhost,
  no abrible desde otro dispositivo (en prod será la URL real) — la prueba viva valida la **entrega**.

## Orden ejecutado (salvaguardas del dictamen)

1. **Prod inerte (salvaguarda 4):** verificado `QA_HELPERS`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`
   **ausentes** en prod → `flush` no reclama.
2. **Convex primero (salvaguarda 2):** `npx convex deploy` (pseudo-TTY): esquema con **tabla
   `emailsSalientes`** + índices `por_estado_intento`/`por_estado_creado`/`por_invitacion`/`por_recuperacion`;
   crons `flush-emails` (5 min) y `purgar-emails-antiguos` (diario); actions `emailEnvio.flush` + mutaciones
   `emailCola.*`.
3. **Contrato verificado en prod (salvaguarda 3):** `function-spec --prod` lista
   `emailCola.reclamarLote/registrarResultado/purgarAntiguos` y `emailEnvio.flush`. `emailEnvio:flush --prod`
   → **`{reclamados:0, enviados:0, fallidos:0}`** (inerte). `qaListarEmails --prod` → **"QA helpers
   deshabilitados"** (gateado, `QA_HELPERS` ausente).
4. **Repo:** `git push` (`8c2dda0..3d398a3`). Sin cambios funcionales de frontend (JUA-129 es todo backend;
   "copiar enlace" intacto).

## Estado

JUA-129 **desplegado en prod en modo inerte**: el código (outbox durable + Resend) está en producción y no
altera la experiencia actual (invitaciones/recuperación siguen con "copiar enlace"). El **envío real en
prod** queda pendiente de:

1. **Dominio verificado** en Resend (bloqueo externo, el mismo de JUA-7): `onboarding@resend.dev` solo
   entrega al dueño de la cuenta; para escribir a usuarios reales hace falta un dominio propio.
2. Cargar en Convex prod `RESEND_API_KEY` + `EMAIL_FROM` (del dominio) + `APP_BASE_URL` (URL de Railway) y
   **verificar con un QA revocable** antes de declarar JUA-129 Done (salvaguarda 5).

## Nota de escala (no bloqueante)

En modo inerte, `encolar` sigue insertando filas `pendiente` que no se envían ni purgan (la purga solo toca
terminales). Volumen bajo (invitaciones/recuperaciones esporádicas); se drenan al activar. OBS futura: purgar
también pendientes cuyo recurso ya caducó, si el modo inerte se prolonga.

## Higiene

`RESEND_API_KEY` solo en el entorno (dev), nunca en repo ni evidencia. Sin tokens, claves ni el correo del
operador en logs/reportes versionados.
