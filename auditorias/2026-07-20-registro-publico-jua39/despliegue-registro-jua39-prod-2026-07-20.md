# Acta de despliegue INERTE — Registro público (JUA-39)

Fecha: 2026-07-20
Commit desplegado: `013e70d` (rango `3048e00..013e70d`: impl + remediación B-1). Base previa: `b0e428f`.
Convex prod: `glad-bird-297`. Frontend: Railway. Dictamen habilitante: **impl v2 = GO con observaciones**.
Modo: **INERTE** — sin secretos de registro/Turnstile → el registro público está **deshabilitado**.

--------------------------------------------------------------------

## Orden ejecutado

1. **Prod inerte verificado:** `REGISTRO_SERVER_SECRET`, `TURNSTILE_SECRET_KEY`, `EDGE_SECRET`, `QA_HELPERS`
   **ausentes** en prod.
2. **Convex primero:** `npx convex deploy` (pseudo-TTY): tabla `registrosPendientes` (+ índices
   `por_token`/`por_email_creado`/`por_creado`/`por_expira`), `emailsSalientes` extendida (tipo
   `verificacion_registro` + `registroPendienteId` + índice `por_registro`), httpAction `/registro/crear`,
   funciones `registro.*`, cron `purgar-registros-pendientes`. **Aditivo**: no toca los flujos vivos de JUA-129.
3. **Contrato verificado en prod** (`function-spec --prod`): `registro.crearPendiente/confirmar/porToken/
   purgarPendientes` + httpAction `/registro/crear`. `confirmar` con token inválido → `ConvexError` controlado.
   QA helpers gateados (`QA_HELPERS` ausente).
4. **Frontend:** `git push` (`b0e428f..013e70d`) → build de Railway.

## Verificación de inercia en prod

- `POST /api/registro` → **503** ("registro deshabilitado") — sin secretos, la frontera no procesa.
- `GET /registro` → **200**, pantalla "Registro no disponible" (sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
- Cabeceras (control 6) presentes: `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`,
  `Cache-Control: no-store`.
- `GET /login` → **200** (sin cambios; el enlace "Crea tu cuenta" oculto sin site key).

## Estado

JUA-39 **en producción en modo inerte**: el código está desplegado y **no** altera la experiencia actual
(el registro público está cerrado). El onboarding sigue por CLI (JUA-41). **La activación pública** requiere
la infra de Cloudflare + Turnstile + secretos + pruebas de integración/vivas (ver runbook en el README del
archivo). Hasta entonces, fallo cerrado (503/oculto).

## Higiene

Sin secretos en repo/logs/evidencia. Contraseña solo hasheada en el pendiente. El esquema es aditivo y
retrocompatible con los eventos de correo existentes (JUA-129).
