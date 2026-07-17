# Alta automatizada de negocio (JUA-41) — ciclo de auditoría y despliegue

**Fecha:** 2026-07-17
**Resultado:** NO-GO (v1, B-1) → remediado → **GO con observaciones** (v2) → **DESPLEGADO Y VERIFICADO EN VIVO (prod)**.
**Commit desplegado:** `6cb7dda` (main). **Base productiva previa:** `a99952f` (raíz `6a693cc`).
**Prod:** Convex `glad-bird-297` (backend puro; sin cambios de frontend, sin envs nuevas).

## Qué se entregó

Alta y **soporte inicial** de negocios **sin acceso directo a la base de datos** (criterios JUA-41), por
**Opción B (CLI vía `internalMutation`)** — sin endpoint público. El registro público autoservicio es otra
tarea (JUA-39).

- **`crearNegocio`** — crea el negocio + la invitación del primer admin y devuelve el enlace de activación.
  Valida nombre, zona (IANA), `baseUrl` (https) y unicidad global del email. El admin fija contraseña +
  zona + nombre al activar (`invitaciones.activar`, flujo JUA-8).
- **`reemitirAdminInicial`** / **`cancelarNegocioVacio`** — recuperación del alta inicial sin tocar la BD
  (remediación B-1): reemite/invalida la invitación, corrige el correo, o cancela un alta aún vacía.
- **`listarNegocios`** — negocios con estado y onboarding del admin (activo / pendiente / sin_invitacion).
- **`qaBorrarNegocio`** — limpieza de pruebas (dev), gateada por `QA_HELPERS` y restringida a `@test.mx`.
- **Esquema:** índice `negocios.por_email_admin`.

## Bloqueante y observaciones

- **B-1 (v1, RESUELTO en `6cb7dda`):** el onboarding inicial no tenía ruta de recuperación por CLI
  (invitación expirada / email equivocado / email tomado antes de activar) → `reemitirAdminInicial` +
  `cancelarNegocioVacio`.
- **OBS-1 (v2):** conteo del acta alineado a 10/10; caso de vencimiento literal como prueba futura.
- **OBS-2:** ampliar la limpieza QA si futuros drivers crean otras dependencias. Diferida.
- **OBS-3:** el token/enlace de activación es credencial temporal — no publicarlo. Aplicado (los drivers no
  imprimen tokens).
- **OBS-4:** N+1 de `listarNegocios` a revisar a escala. Diferida.

## Verificación

- **Dev:** driver-37 (nominal) **10/10**; driver-38 (recuperación B-1 + validadores OBS-1) **10/10**.
- **Producción (glad-bird-297) — en vivo:** `npx convex deploy` con push completo + contrato verificado
  (`function-spec --prod`) + índice `por_email_admin`; `QA_HELPERS` ausente. Recorrido real con negocio QA
  revocable (driver-39, **5/5**): crear → reemitir → cambiar correo → `cancelarNegocioVacio`; **prod sin
  residuo**, sin publicar tokens. Detalle en `despliegue-alta-negocio-jua41-prod-2026-07-17.md`.

## Nota operativa

`qaBorrarNegocio` es **inerte en prod** (sin `QA_HELPERS`); por eso el recorrido en prod usa la ruta de
**cancelación** (`cancelarNegocioVacio`) para limpiar un alta vacía. El envío de email por Resend sigue
pendiente en el proyecto: estas funciones crean la invitación y devuelven el enlace para compartirlo.

## Archivos

- `auditoria-alta-negocio-jua41-v1.md` — acta de entrega (Opción B).
- `auditoria-alta-negocio-jua41-remediacion-b1.md` — acta de remediación del bloqueante B-1 + OBS.
- `despliegue-alta-negocio-jua41-prod-2026-07-17.md` — acta de despliegue + verificación en vivo.
- `dictamen-…-no-go-v1.md` / `dictamen-…-go-v2.md` — dictámenes del auditor.
- `drivers/` — driver-37 (nominal), driver-38 (recuperación), driver-39 (recorrido prod) + reportes
  sanitizados (dev). Sin tokens ni secretos.
